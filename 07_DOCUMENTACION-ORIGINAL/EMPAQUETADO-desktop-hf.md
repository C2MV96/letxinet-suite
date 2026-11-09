# Guía de Empaquetado — LetXipu Desktop HF

Documento completo de referencia para generar el ejecutable Windows de `D:\OTROS\LETXINET-DESKTOP-HF`.
Registra la arquitectura final, los escollos encontrados, las soluciones aplicadas y los pasos exactos para regenerar el instalador/portable de forma fiable.

---

## 1. Arquitectura final

```
LetXipu Desktop HF.exe (Electron app)
├── main process            ← electron/main.cjs
│   └── spawn child node    ← dist/server.cjs (Express backend en 127.0.0.1:43123)
│        ├── /health        ← 200 once ready
│        ├── /              ← sirve index.html + assets (UI React/Vite)
│        └── MCP endpoints   ← proxy HTTP/SSE a 3 servicios REMOTOS:
│             ├── LetXipu V11  → https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp
│             ├── LetXipu OSM  → https://c2mv-letxipu-osm-mcp.hf.space/mcp
│             └── LetXinet     → https://www.letxinet.lat/api/v1/mcp
└── renderer window          ← http://127.0.0.1:43123 (cargada por BrowserWindow)
```

**Regla inviolable**: el .exe NUNCA levanta MCPs locales en puertos 4003/7082. LetXipu, OSM y LetXinet se consumen solo desde endpoints remotos (HF y letxinet.lat). Las claves IA (Gemini, Mistral, NVIDIA, OpenCode) NO se incluyen; el UI las pide al usuario y las guarda en configuración local.

---

## 2. Estructura de archivos relevantes

| Ruta | Rol |
|---|---|
| `electron/main.cjs` | Main process Electron. Spawnea el backend, espera a `/health` 200, abre la ventana. |
| `server.ts` | Backend Express (5,979 líneas). Service workers de los 3 MCP remotos + servir UI. |
| `scripts/install-deps.cjs` | Escribe un `package.json` mínimo de producción en `dist/` y ejecuta `npm install --production` para poblar `dist/node_modules/`. **Crítico para el empaquetado.** |
| `package.json` | Configuración de build (`asar`, `asarUnpack`, targets NSIS+portable). |
| `vite.config.ts` | Build de la UI React hacia `dist/index.html` + `dist/assets/`. |
| `tsconfig.json` | TS config (`tsc --noEmit` para typecheck). |

### `package.json` — bloque `"build"` (NO MODIFICAR sin cuidado)

```json
"build": {
  "appId": "com.c2mv.letxipu.desktophf",
  "productName": "LetXipu Desktop HF",
  "asar": true,
  "asarUnpack": [
    "dist/server.cjs",
    "dist/index.html",
    "dist/assets/**",
    "dist/node_modules/**",
    "dist/package.json"
  ],
  "files": ["dist/**/*", "electron/**/*", "package.json"],
  "win": { "target": ["nsis", "portable"] },
  "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
}
```

`asarUnpack` es **lo que hace que el binario funcione**: server.cjs, los estáticos y los node_modules quedan accesibles por filesystem (no dentro del asar), por lo que `require()` de Node y `express.static()` resuelven correctamente.

---

## 3. Errores encontrados y soluciones (en orden cronológico)

### Error 1 — `stdio: WriteStream` inválido en `spawn`

**Síntoma**:
```
Startup failed: The argument 'stdio' is invalid. Received WriteStream { ... }
```

**Causa**: en `main.cjs` se pasó un `fs.createWriteStream` directamente a `spawn({ stdio: ['ignore', logStream, logStream] })`. La API de `child_process.spawn` solo acepta `'pipe'`, `'ignore'`, `'inherit'` o enteros fd. NO acepta streams.

**Solución**:
```js
spawn(process.execPath, [serverEntry], {
  stdio: ['ignore', 'pipe', 'pipe'],   // siempre strings
  ...
});
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
backend.stdout.on('data', (d) => logStream.write(d));
backend.stderr.on('data', (d) => logStream.write(d));
```

> Si se quiere que el main pipee a un archivo, se deben escuchar los eventos `data` de los pipes y escribir al stream manualmente.

---

### Error 2 — `Cannot find module 'vite'` (unconditional top-level requirement)

**Síntoma**:
```
Error: Cannot find module 'vite'
Require stack:
- ...\app.asar\dist\server.cjs
```

**Causa**: `server.ts` declaraba `import { createServer as createViteServer } from "vite";` en la primera línea. Aunque `vite` solo se invoca dentro del branch `NODE_ENV !== "production"` (dev), el bundle de esbuild con `--packages=external` deja `require("vite")` en la cabeza del archivo, por lo que Node lo ejecuta siempre al cargar `server.cjs`, fallando cuando `node_modules/vite/` no es resoluble dentro del asar.

**Solución**: convertir el import estático en import dinámico dentro de una arrow lazily-evaluated:
```ts
// ANTES
import { createServer as createViteServer } from "vite";

// DESPUÉS
const createViteServer = (...args: any[]) => import("vite").then((m) => m.createServer(...args));
```

El `require("vite")` solo se dispara cuando se llama a `createViteServer()` (solo en dev). En producción `vite` no tiene que estar presente en el runtime del backend empaquetado.

---

### Error 3 — `Cannot find module 'parseurl'` (sub-dependencias de express)

**Síntoma**:
```
Error: Cannot find module 'parseurl'
Require stack:
- ...\app.asar.unpacked\dist\node_modules\finalhandler\index.js
- ...\app.asar.unpacked\dist\node_modules\express\lib\application.js
- ...
```

**Causa**: primer intento de copiar dependencias (`scripts/copy-deps.cjs`) usaba una lista `KEEP` hardcoded que solo copiaba módulos de primer nivel, no las sub-dependencias transitivas (parseurl, finalhandler, qs, mime-types...).

**Solución**: reemplazar el script de copia por `scripts/install-deps.cjs` que escribe un `package.json` de producción completo en `dist/` y ejecuta `npm install --production`, resolviendo el árbol completo transitivo automáticaente:

```js
const prodDeps = {
  "express": "^4.21.2",
  "@google/genai": "^2.4.0",
  "@mistralai/mistralai": "^2.2.5",
  "dotenv": "^17.2.3",
  "@langchain/langgraph": "^1.4.8",
  "@langchain/core": "^1.2.3",
  "pdf-parse": "^2.4.5",
  "vite": "^6.2.3"
};
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify({ ... manifest ... }));
execSync('npm install --production --no-audit --no-fund --no-package-lock', { cwd: distDir, stdio: 'inherit' });
```

> **No volver a usar copia manual**. La lista faltante de subdeps siempre volverá a romper. `npm install --production` es la única forma confiable.

El script está invocado desde `npm run build`:
```
"build": "vite build && esbuild server.ts --bundle ... --outfile=dist/server.cjs && node scripts/install-deps.cjs"
```

Cada `npm run build` reinstala limpio `dist/node_modules/` (~151 paquetes, ~40 segundos).

---

### Error 4 — `ENOENT index.html` (estáticos dentro del asar no servidos)

**Síntoma**:
```
Error: ENOENT: no such file or directory, stat '...\app.asar.unpacked\dist\index.html'
```
El backend arrancaba (log: "running on port 43123", /health devolvía 200) pero `GET /` respondía 404 porque `index.html` no era encontrado.

**Causa**:
1. `asarUnpack` inicialmente solo incluía `dist/server.cjs`, `dist/node_modules/**` y `dist/package.json`. `index.html` y `dist/assets/**` quedaron empaquetados dentro del `app.asar` (acceso virtual), no en el filesystem real.
2. El backend empaquetado usa `app.use(express.static(distPath))` y `res.sendFile(path.join(distPath, "index.html"))`. Estos métodos de Express **requieren rutas físicas**, no hay soporte para rutas virtuales dentro del asar.

**Solución**:
- Ampliar `asarUnpack` para también desempaquetar los estáticos:
```json
"asarUnpack": [
  "dist/server.cjs",
  "dist/index.html",
  "dist/assets/**",
  "dist/node_modules/**",
  "dist/package.json"
]
```
- En `server.ts` usar `__dirname` (no `process.cwd()`) para resolver la carpeta de estáticos, porque cuando el backend está empaquetado, `__dirname` apunta a `app.asar.unpacked/dist/` que es donde están `index.html` y `assets/`:
```ts
const distPath = (process.env.LETXIPU_DESKTOP_STATIC_DIR)
  ? process.env.LETXIPU_DESKTOP_STATIC_DIR
  : (path.resolve(__dirname) === path.resolve(process.cwd())
      ? path.join(__dirname, "..", "dist")   // caso desarrollo: __dirname === dist (cwd=proyecto)
      : path.join(__dirname));               // caso empaquetado: __dirname === app.asar.unpacked/dist
```

> Override disponible: variable de entorno `LETXIPU_DESKTOP_STATIC_DIR` para forzar otra ruta.

---

### Error 5 — `utilityProcess.fork` lanza `bad option: --type=utility`

**Síntoma**:
```
D:\...\LetXipu Desktop HF.exe: bad option: --type=utility
D:\...\LetXipu Desktop HF.exe: bad option: --utility-sub-type=node.mojom.NodeService
...
Backend exited with code 9
```

**Causa**: intenté usar `utilityProcess.fork` (API nativa de Electron para procesos hijos en V8). El ejecutable de este Electron (v37.10.3 con `ELECTRON_RUN_AS_NODE=1`) no soporta los flags que utilityProcess inyecta internamente.

**Solución**: **no usar utilityProcess**. Volver a `child_process.spawn` con `ELECTRON_RUN_AS_NODE=1`. Ese patrón SÍ funciona (verificado en runtime real).

> Para futuro: si se cambia de versión de Electron y `utilityProcess.fork` se vuelve usable, podría reintentarse. Con Electron 37, dejar spawn.

---

### Error 6 — `bad option: --no-sandbox` al spawn del subprocess

**Síntoma**:
```
LetXipu Desktop HF.exe: bad option: --no-sandbox
LetXipu Desktop HF.exe: bad option: --disable-gpu
Backend exited with code 9
```

**Causa**: con `ELECTRON_RUN_AS_NODE=1`, el binary de Electron arranca en modo Node puro y **no acepta flags de Electron/Chromium** (`--no-sandbox`, `--disable-gpu`, `--type=utility`, etc.). Pasarlos como args de spawn rompe el arranque.

**Solución**: spawn con argumentos limpios, solo el path al script:
```js
backend = spawn(process.execPath, [serverEntry], { ... });
```
NUNCA agregar `--no-sandbox`, `--disable-gpu`, ni ningún flag de Chromium al spawn con `ELECTRON_RUN_AS_NODE=1`.

---

### Error 7 — el spawn desde dentro de Electron "silently" falla (backend.log vacío)

**Síntoma**: cuando el backend se lanza manualmente desde PowerShell/elevated `node`, vg , el `require()` funciona y responde 200; pero cuando se lanza como spawn desde el main.cjs dentro del proceso Electron, el `backend.log` queda vacío y `waitForBackend` expira a los 30s.

**Causa real**: `ELECTRON_RUN_AS_NODE=1` estaba siendo propagado al subprocess, pero algunos forks/versiones de Electron **inherit electron flags automáticamente al subprocess** (porque `process.execPath` es el binario Electron que re-suscribe argv). Esto incluía flags como `--user-data-dir`, `--field-trial-handle`, `--enable-features`... que al combinarse con un script que arranca express y npm modules,航道 la inicialización colapsa silenciosamente sin stdout/stderr.

**Solución adoptada**: en el env del spawn, **eliminar variables problemáticas heredadas** y dejar `ELECTRON_RUN_AS_NODE=1` + `ELECTRON_DISABLE_SECURITY_WARNINGS=1`:
```js
const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  NODE_ENV: 'production',
  DESKTOP_HF_ONLY: '1',
  PORT: String(APP_PORT),
  LETXIPU_MCP_URL: 'https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp',
  LETXIPU_OSM_MCP_URL: 'https://c2mv-letxipu-osm-mcp.hf.space/mcp',
  LETXINET_MCP_URL: 'https://www.letxinet.lat/api/v1/mcp',
};
for (const k of ['ORIGINAL_XDG_CURRENT_DESKTOP']) delete env[k];
```
Y usar `windowsVerbatimArguments: false` para que PowerShell/Windows no cite args de forma rara.

**Prueba de diagnóstico rápida para verificar**:
```powershell
# Spawn directo desde node externo (siempre funciona):
node -e "const{spawn}=require('child_process');const env={...process.env,ELECTRON_RUN_AS_NODE:'1'};const p=spawn('D:\\OTROS\\LETXINET-DESKTOP-HF\\dist\\win-unpacked\\LetXipu Desktop HF.exe',['D:\\OTROS\\LETXINET-DESKTOP-HF\\dist\\win-unpacked\\resources\\app.asar.unpacked\\dist\\server.cjs'],{cwd:'D:\\OTROS\\LETXINET-DESKTOP-HF\\dist\\win-unpacked\\resources\\app.asar.unpacked\\dist',env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>process.stdout.write(d));setTimeout(()=>process.exit(0),8000);"
```
Si esto imprime "BOOT Step 1..." entonces el spawn externo está OK y cualquier fallo viene del entorno del main.cjs (herencia de flags de Electron).

---

### Error 8 — el primer spawn (con stdio a WriteStream) funcionaba raro por timeout

Durante la iteración, hubo bridges: el waitForBackend timeout de 30s veces se cumplía aunque el backend terminaba de arrancar (10-15 s). En el back-end log aparecía "running on port 43123" MUCHO más tarde que el timeout.

**Solución**: el `waitForBackend` hereda los 30s. Es suficiente porque arrancar el backend desde el exe empaquetado requiere ~10-25s (imports + dotenv + scraper de modelos). NO bajar ese timeout en producción. 

Log real de tiempos:
```
Electron ready at T+0
Spawn backend at T+10ms
Backend stdout "BOOT Step 2: imports done" at T+2s
Backend stdout "LetXinet MCP Server running on port 43123" at T+6s
Backend healthy (waitForBackend resolved) at T+25s   <-- incluye timeout de NetTCPConnection-listen en waitForBackend
```

---

## 4. Pasos para regenerar el instalador desde cero

### Pre-requisitos

```powershell
# Verificar que estén instalados_node 22+ y npm
node --version    # v22.21.1
npm --version
```

### Secuencia

```powershell
cd D:\OTROS\LETXINET-DESKTOP-HF

# PASO 1 — Instalar dependencias del proyecto (solo la primera vez o tras modificar package.json)
npm install

# PASO 2 — Verificar que TypeScript compila
npm run lint      # tsc --noEmit

# PASO 3 — Limpiar artefactos previos (importante; electron-builder NO sobrescribe de forma fiable)
Get-Process "LetXipu Desktop HF","node","electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked.tmp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\*.exe" -Force -ErrorAction SilentlyContinue
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\*.7z" -Force -ErrorAction SilentlyContinue
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\*.blockmap" -Force -ErrorAction SilentlyContinue

# PASO 4 — Build de la UI + bundle del backend + instalación de node_modules en dist/
npm run build
#    Esto ejecuta en orden:
#    4a) vite build                            → dist/index.html + dist/assets/*
#    4b) esbuild server.ts --bundle ...        → dist/server.cjs (279 KB)
#    4c) node scripts/install-deps.cjs         → dist/package.json + dist/node_modules/ (151 paquetes, ~40s)

# PASO 5 — Generar el instalador NSIS (Setup) y el portable .exe en un solo .exe standalone
npx electron-builder --win nsis
#    Salida:
#      dist\LetXipu Desktop HF Setup 0.0.0.exe           (~601 MB, instalador con elección de carpeta)
#      dist\LetXipu Desktop HF Setup 0.0.0.exe.blockmap
#      dist\letxipu-desktop-hf-0.0.0-x64.nsis.7z          (intermedio)
#      dist\win-unpacked\LetXipu Desktop HF.exe           (.exe portable en su carpeta, no requiere install)

# Alternativa: solo portable (más rápido)
npx electron-builder --win portable
#    Salida: dist\LetXipu Desktop HF 0.0.0.exe          (.exe ejecutable standalone)

# Alternativa: solo la carpeta win-unpacked (lo más rápido, para pruebas)
npx electron-builder --win dir
#    Salida: dist\win-unpacked\LetXipu Desktop HF.exe   (copia portable lista para doble clic)
```

### Atajo eléctrico: comando todo en uno

```powershell
cd D:\OTROS\LETXINET-DESKTOP-HF
Get-Process "LetXipu Desktop HF","node","electron" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked.tmp" -Recurse -Force -ErrorAction SilentlyContinue
npm run build
npx electron-builder --win nsis
```

Total: ~5-10 minutos (incluye 40s de `npm install --production` en dist + ~3-5 min de empaquetado NSIS con firma).

---

## 5. Cómo verificar que el .exe funciona

```powershell
# Limpiar procesos y logs previos
Get-Process "LetXipu Desktop HF" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
Remove-Item "$env:TEMP\letxipu-desktop-main.log" -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\letxipu-desktop-hf\backend.log" -ErrorAction SilentlyContinue

# Lanzar el exe empaquetado
$exe = "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\LetXipu Desktop HF.exe"
$proc = Start-Process -FilePath $exe -PassThru

# Esperar a que arranque el backend (20-30s)
Start-Sleep -Seconds 25

# Verificar logs de arranque
Get-Content "$env:TEMP\letxipu-desktop-main.log"
# Debe contener:
#   [..] Electron main loaded
#   [..] Electron ready
#   [..] Starting backend: ...\app.asar.unpacked\dist\server.cjs
#   [..] Backend cwd: ...\app.asar.unpacked\dist
#   [..] Spawned backend PID=NNNN
#   [..] Backend healthy

Get-Content "$env:APPDATA\letxipu-desktop-hf\backend.log" -Tail 20
# Debe contener:
#   [BOOT] Step 1: imports start
#   [BOOT] Step 2: imports done
#   injected env (0) from .env ...
#   LetXinet MCP Server running on port 43123
#   [MCP-Server] Model Scraper completado: 76 modelos sincronizados.
#   Calling LetXipu MCP: method=tools/list ...
#   LetXipu MCP response received successfully for method=tools/list
#   Loaded 28 tools from LetXipu OSM MCP via direct SSE GET.
#   Cached 59 tools successfully.

# Verificar respuestas HTTP
Invoke-WebRequest -Uri "http://127.0.0.1:43123/health" -UseBasicParsing | Select-Object StatusCode
#  200

Invoke-WebRequest -Uri "http://127.0.0.1:43123/" -UseBasicParsing | Select-Object StatusCode, @{n='Length';e={$_.Content.Length}}
#  200,  409 (HTML)

# Matar procesos
Get-Process "LetXipu Desktop HF" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Logs clave para diagnóstico

Si todo falla:
- **`$env:TEMP\letxipu-desktop-main.log`** → trazas del main process (loader Electron, spawn, waitForBackend, errores no capturados).
- **`$env:APPDATA\letxipu-desktop-hf\backend.log`** → stdout/stderr del backend Express (BOOT steps, credenciales, llamadas MCP).
- **`$env:APPDATA\letxipu-desktop-hf\`** → userData: logs + configuración persistente.

Si backend.log está VACÍOTras esperar 25s = el spawn falla (revisar errores 5/6/7 de arriba).
Si backend.log contiene `BOOT Step 2: imports done` pero NO contiene `running on port` = el backend aborta en una dependencia (revisar `Cannot find module ...`).
Si todo arranca pero health responde 200 y `/` falla = problema de serving de estáticos (ver error 4).

---

## 6. Cambios comunes que se pueden pedir y cómo aplicarlos

### A) Cambiar los endpoints remotos de los MCP

Editar `electron/main.cjs`, función `startBackend`:
```js
const env = {
  ...
  LETXIPU_MCP_URL: 'https://NUEVO_ENDPOINT/api/mcp',
  LETXIPU_OSM_MCP_URL: 'https://NUEVO_OSM/mcp',
  LETXINET_MCP_URL: 'https://NUEVO_LETXINET/api/v1/mcp',
};
```
Luego reempaquetar (`npm run build && npx electron-builder --win nsis`).

### B) Cambiar el puerto del backend local

En `electron/main.cjs` línea 14:
```js
const APP_PORT = Number(process.env.LETXIPU_DESKTOP_PORT || 43123);
```
Cambiar `43123` por el nuevo puerto. Como alternativa, el puerto se puede forzar con la variable de entorno `LETXIPU_DESKTOP_PORT=NNNN` al lanzar el .exe.

### C) Cambiar el título o el nombre del .exe

En `package.json`:
```json
"build": {
  "productName": "LetXipu Desktop HF",   ← nombre del .exe y de la carpeta userData
  "appId": "com.c2mv.letxipu.desktophf"
}
```

> **Cuidado con cambiar `productName`**: el directorio `userData` cambia de `%APPDATA%\LetXipu Desktop HF` a uno nuevo, por lo que las configuraciones guardadas previas se pierden.

### D) Cambiar el título/pestaña del HTML

El HTML raíz se genera en `index.html` (con `<title>My Google AI Studio App</title>`). Para personalizarlo, edita `index.html` directamente y reempaqueta (el `vite build` no regenera `index.html` si no se modifica `vite.config.ts`; el `<title>` vive en `index.html`).

### E) Añadir icono de aplicación (.ico)

Crear `build/icon.ico` con multi-resolución (256x256, 128x128, 64x64, 32x32, 16x16). Añadir al block `"build"`:
```json
"build": {
  "win": { "target": ["nsis", "portable"], "icon": "build/icon.ico" }
}
```
Reempaquetar. El `electron-builder` incrusta el icono automáticamente.

### F) Cambiar dimensiones/título de la ventana

En `electron/main.cjs`, función `createWindow`:
```js
new BrowserWindow({
  width: 1440, height: 920,
  minWidth: 980, minHeight: 700,
  autoHideMenuBar: true,
  title: 'LetXipu Desktop HF',
  webPreferences: { contextIsolation: true, nodeIntegration: false },
});
```

### G) Añadir una nueva dependencia de producción al backend

1. Añadir a `dependencies` en `package.json` principal.
2. **Añadir también a `prodDeps` en `scripts/install-deps.cjs`** (sin esto, NO llegará al empaquetado).
3. Hacer `npm install` en la raíz para tener la tipetion para dev.
4. `npm run build` reinstalará la nueva dependencia en `dist/node_modules/`.
5. Reempaquetar.

> **REGLA**: cualquier módulo cuyo `require()` se ejecuta al arrancar `server.cjs` DEBE estar en `install-deps.cjs`. Los imports estáticos que esbuild deja como `require(...)` al inicio del bundle son los candidatos. Ver header de `dist/server.cjs` para ver los externals reales.

### H) Bump de versión

En `package.json`:
```json
"version": "0.0.0"   ← cambiar a "1.0.0" por ejemplo
```
El nombre del instalador pasa a ser `LetXipu Desktop HF Setup 1.0.0.exe`.

---

## 7. Limitaciones conocidas y notas técnicas

- **Tamaño del .exe**: 601 MB. La mayoría es `dist/node_modules/` (~150 MB) y `electron.asar` framework (~200 MB). Las dependencias incluyen `@napi-rs/canvas` (binarios nativos), `vite` (necesario porque sigue referenciado en runtime en una sola lazy arrow pero se incrusta), todo el clúster de `@langchain` y `@mistralai`. Para reducirse en futuro: sacar `@langchain/langgraph` si no se usa en runtime, mover el `pdf-parse` a dynamic import únicamente en el endpoint que lo usa.

- **Tiempo de arranque del backend**: 8-15 segundos (verificado). El tiempo mayoritario es:
  1. `dotenv` inyecta `.env`
  2. `express` levanta
  3. Scraper de modelos IA (76 modelos) se ejecuta al inicio — 2-3 segundos
  4. Llamada inicial a los 3 MCP remotos (LetXipu + LetXinet + OSM) para listar herramientas — 3-5 segundos

- **Firma digital**: el `electron-builder` intenta firmar con signtool automáticamente pero SI NO hay certificado, simplemente salta el paso con warn (la app funciona igual, solo que Windows Defender mostrará SmartScreen al primer arranque). Para producción real, configurar certificado Authenticode.

- **Claves IA no embebidas**: por diseño. El usuario abre la app, va a la UI, e ingresa manualmente `GEMINI_API_KEY`, `MISTRAL_API_KEY` y similares desde la pantalla de configuración. Estas se guardan en `userData` (carpeta `%APPDATA%\letxipu-desktop-hf\`). Nunca TOCAR servidores locales ni `MCP_API_KEY` del proyecto original.

- **LETXIPU_DESKTOP_STATIC_DIR**: variable de entorno opcional. Útil solo si en una refactor futura el backend se sirve estáticos desde un directorio distinto al de `__dirname`.

- **No incluye `.env`**: el `.gitignore` excluye `.env`. El `.env.example` se mantiene como referencia. SIEMPRE hay que copiarlo manualmente a `.env` para desarrollo si se quieren claves por defecto.

---

## 8. Hash de referencia de los artefactos finales (28/07/2026)

| Archivo | Tamaño | Notas |
|---|---|---|
| `dist\LetXipu Desktop HF Setup 0.0.0.exe` | 601.03 MB | Instalador NSIS final (con elección de carpeta) |
| `dist\LetXipu Desktop HF Setup 0.0.0.exe.blockmap` | 653 KB | BlockMap para updates delta |
| `dist\letxipu-desktop-hf-0.0.0-x64.nsis.7z` | 344 MB | Intermedio comprimido NSIS |
| `dist\win-unpacked\LetXipu Desktop HF.exe` | 205 MB | Portable en carpeta (no requiere instalación) |

---

## 9. Comandos rápidos de troubleshooting

```powershell
# ¿El exe está ahí?
Get-ChildItem "D:\OTROS\LETXINET-DESKTOP-HF\dist" -Recurse -Filter "*.exe" | Select-Object FullName, Length, LastWriteTime

# ¿El backend respondió correctamente al último arranque?
Get-Content "$env:APPDATA\letxipu-desktop-hf\backend.log" -Tail 30

# ¿Qué dijo el main process?
Get-Content "$env:TEMP\letxipu-desktop-main.log" -Tail 30

# ¿El puerto está escuchando?
Get-NetTCPConnection -LocalPort 43123 -State Listen

# ¿Cuántos procesos Electron/Node rodents hay?
Get-Process "LetXipu Desktop HF","node","electron" | Select-Object Id, ProcessName, StartTime

# Matar todo lo del proyecto:
Get-Process "LetXipu Desktop HF","node","electron" -ErrorAction SilentlyContinue | Stop-Process -Force

# Inspeccionar el contenido del asar:
& "D:\OTROS\LETXINET-DESKTOP-HF\node_modules\.bin\asar.cmd" list "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\resources\app.asar" 2>&1 | Select-String -Pattern "server.cjs|index.html|express|pdf-parse|vite"

# Lanzar directo el backend empaquetado sin Electron (test puro del server):
$env:ELECTRON_RUN_AS_NODE='1'; $env:NODE_ENV='production'; $env:DESKTOP_HF_ONLY='1'; $env:PORT='43130'; & "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\LetXipu Desktop HF.exe" "D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\resources\app.asar.unpacked\dist\server.cjs"
# (Ctrl+C para parar)
```

---

## 10. Resumen — checklist mental antes de cualquier cambio

> Antes de regenerar el .exe tras un cambio en el código:

1. **Matar procesos** del exe anterior (suele haber 4-5 PIDs `LetXipu Desktop HF`).
2. **Borrar `dist\win-unpacked` y `*.exe` / `*.7z` previos**. electron-builder NO siempre sobrescribe de forma fiable si el .exe está bloqueado por Permisos.
3. **`npm run build`** — rehace `index.html`, `assets/`, `server.cjs` y reinstala limpio `dist/node_modules/`. NO saltarse este paso tras tocar `server.ts`.
4. Si se añadió una dependencia nueva a `package.json` principal → añadir también a `scripts/install-deps.cjs` (`prodDeps`). Si no, no llegará al empaquetado.
5. Si se mueve o renombra `dist/index.html` o `dist/assets/` → actualizar también `asarUnpack` en `package.json`.
6. Si se añade un `import` estático nueva en `server.ts` que use un paquete no presente en producción → convertir a `import()` dinámico o añadirlo a `install-deps.cjs` y asarUnpack.
7. Reempaquetar: `npx electron-builder --win nsis` (instalador) o `--win portable` (exe standalone).
8. Probar el exe:
   - `Get-Content "$env:TEMP\letxipu-desktop-main.log"` → debe verse "Backend healthy"
   - `Invoke-WebRequest http://127.0.0.1:43123/health` → 200
   - `Invoke-WebRequest http://127.0.0.1:43123/` → 200 (HTML con título)
   - `Get-Content "$env:APPDATA\letxipu-desktop-hf\backend.log" -Tail 20` → deben verse "Loaded N tools from LetXipu OSM MCP" y "Cached N tools successfully"

Si los 4 flags están en verde, el .exe está OK para distribuir.
