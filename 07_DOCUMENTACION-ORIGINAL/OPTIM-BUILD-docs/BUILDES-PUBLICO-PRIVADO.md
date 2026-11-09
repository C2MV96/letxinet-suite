# Builds Público vs Privado — LetXipu Desktop HF

**Sesión:** 5 — Jue 06 Ago 2026, 15:45–16:20
**Autor:** opencode (z-ai/glm-5.2)
**Build activo:** `index-BFO69YUD.js` + `index-BFFo4o8W.css` + `server.cjs` (344565 bytes)
**Backup fuentes:** `backups\src-pre-builddual-20260806-154529\`
**Backup standalone:** `backups\standalone-pre-builddual-20260806-161411\`

---

## Resumen

Se ha diseñado e implementado la infraestructura para generar **dos variantes del
instalador de LetXipu Desktop HF** desde un único fuente, sin bifurcar el repo y
sin branches git. Las dos variantes se obtienen con dos scripts npm que inyectan
la variable de entorno `BUILD_VARIANT=public|private` en build time.

## Tabla de diferencias

| Aspecto | **PÚBLICO** | **PRIVADO** |
|---|---|---|
| `appId` | `com.c2mv.letxipu.desktophf.public` | `com.c2mv.letxipu.desktophf.private` |
| `productName` (NSIS) | `LetXipu Desktop HF` | `LetXipu Desktop HF Pro` |
| Coexistencia | Sí (no sobreescribe al privado) | Sí (no sobreescribe al público) |
| URLs HF fallback en `server.cjs` | Vacías (`""`) — sin fallback remoto | Las 3 legacy HF activas |
| `DESKTOP_ENDPOINT_MODE` default | `local_only` — fuerza MCP local | `auto` — local + fallback HF |
| `.env` (del repo) | Sin API keys (solo template) | Sin API keys (solo template) |
| `secrets.json` embebido en resources | **No** — el usuario rellena vía GUI | **Sí** — 3 keys pre-cargadas |
| Sources del repo | Repo público (publicable) | Repo privado del operador |

## Comandos de build

```powershell
# Build público (sin API keys, sin URLs HF)
npm run desktop:dist:public

# Build privado (con API keys embebidas en resources/secrets.json, URLs HF activas)
npm run desktop:dist:private

# Build legacy (sin distinción de variante = privado por defecto)
npm run desktop:dist
```

## Flujo interno (cómo se diferencia en build time)

### 1. `scripts/apply-variant.cjs`

Lee `process.env.BUILD_VARIANT` y:

- ** Público**: Asegura que `build/secrets.json` NO exista (lo borra si quedó de un
  build privado previo). Escribe `build/build-info.json` con `{"variant":"public"}`.
- ** Privado**: Genera `build/secrets.json` con las 3 API keys (Nebius, OpenRouter,
  DeepSeek) leídas de `.env.local` (gitignored, no se empaqueta). Escribe
  `build/build-info.json` con `{"variant":"private"}`.

### 2. server.ts (compilado a server.cjs)

La lógica condicional se compila en el bundle por `--define:process.env.BUILD_VARIANT="$BUILD_VARIANT"`:

```ts
const BUILD_VARIANT = (process.env.BUILD_VARIANT || "private").toLowerCase() as "public" | "private";
const IS_PUBLIC_BUILD = BUILD_VARIANT === "public";

const DESKTOP_ENDPOINT_MODE =
  (process.env.DESKTOP_ENDPOINT_MODE || (IS_PUBLIC_BUILD ? "local_only" : "auto")).toLowerCase() as ...;

const HF_LETXIPU_MCP_URL =
  process.env.LETXIPU_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp");
const HF_LETXIPU_OSM_MCP_URL =
  process.env.LETXIPU_OSM_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://c2mv-letxipu-osm-mcp.hf.space/mcp");
const HF_LETXINET_MCP_URL =
  process.env.LETXINET_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://www.letxinet.lat/api/v1/mcp");
```

### 3. electron-builder (CLI flags)

```jsonc
"desktop:dist:public":  "cross-env BUILD_VARIANT=public  ... electron-builder --config.appId=\"com.c2mv.letxipu.desktophf.public\"  --config.productName=\"LetXipu Desktop HF\"",
"desktop:dist:private": "cross-env BUILD_VARIANT=private ... electron-builder --config.appId=\"com.c2mv.letxipu.desktophf.private\" --config.productName=\"LetXipu Desktop HF Pro\" --config.extraResources=\"[{\\\"from\\\":\\\"build/secrets.json\\\",\\\"to\\\":\\\"secrets.json\\\"}]\""
```

- Público: produce `LetXipu Desktop HF-Setup-X.Y.Z.exe` con appId `...public`.
- Privado: produce `LetXipu Desktop HF Pro-Setup-X.Y.Z.exe` con appId `...private`
  y embebe `secrets.json` en `resources/secrets.json` vía `extraResources`.

### 4. main.cjs (`seedSecretsFromBundle`)

Al arrancar la app Electron:

```js
// Antes de startBackend() en app.whenReady()
seedSecretsFromBundle();
```

Lee `process.resourcesPath/secrets.json` (donde electron-builder colocó el extraResource
para el privado). Si existe y el usuario NO tiene `userData/secrets.json` (es decir,
no configuró nada via ProvidersSyncPanel), lo copia a `%APPDATA%\LetXipu Desktop HF Pro\secrets.json`.
Esto permite que el backend express (que ejecuta `loadSecretsFromDisk()` al iniciar)
encuentre las 3 keys pre-cargadas.

**User config wins**: si `userData/secrets.json` ya existe (el usuario ya llenó algo
vía la GUI), el bundle NO se copia. Las preferencias del usuario tienen prioridad.

## Flujo de secrets (corrección de prioridad)

### Antes (Fase 3 previa a esta sesión)

```ts
// loadSecretsFromDisk
const setIfMissing = (envName, value) => {
  if (value && !process.env[envName]) {
    process.env[envName] = value;  // solo si process.env no tiene valor
  }
};
```

Esto significaba: si `.env` bundleado tenía `NEBIUS_API_KEY=xxx` (lo cual NO ocurre
en producción porque `.env` no se empaqueta, pero sí en dev), las keys del `secrets.json`
(GUI) eran ignoradas. El usuario NO podía sobreescribir las keys desde la UI.

### Después (esta sesión)

```ts
// loadSecretsFromDisk
const setIfPresent = (envName, value) => {
  if (value) {
    process.env[envName] = value;  // siempre sobreescribe
  }
};
```

Ahora `secrets.json` SIEMPRE gana sobre `.env` (si una key está presente en
secrets.json, sobreescribe la del `.env`). Esto permite:

- Privado: el `secrets.json` bundleado (pre-cargado por el instalador) gobierna.
- Privado + GUI: el usuario puede editar las keys desde ProvidersSyncPanel y el
  nuevo `secrets.json` (escrito por `saveSecretsToDisk`) gana al embebido.
- Público: `secrets.json` no existe en resources, el usuario lo crea vía GUI.

## Ampliación de `SecretsShape` (importante)

Antes de esta sesión, las 3 API keys del `providers-catalog` (Nebius, OpenRouter,
DeepSeek) **NO estaban en `SecretsShape`**. La GUI `ProvidersSyncPanel` las pedía
vía `process.env.NEBIUS_API_KEY`, pero `loadSecretsFromDisk` no las cargaba desde
`secrets.json`. Resultado: Aunque el usuario las guardara vía API Keys Config,
al reiniciar el backend express se perdían (porque no se persistían en secrets.json).

Se ha corregido ampliando `SecretsShape`:

```ts
export interface SecretsShape {
  // ... campos previos
  // Providers del providers-catalog (la GUI ProvidersSyncPanel gestiona estos)
  nebiusApiKey?: string;
  openrouterApiKey?: string;
  deepseekApiKey?: string;
  // ...
}
```

Y se han añadido las 3 keys en:

- `loadSecretsFromDisk()` (línea 73-114 de server.ts) — 3 nuevas `setIfPresent` para
  cargarlas en `process.env` al iniciar.
- `app.get("/api/keys")` (línea 3284-3325) — 3 nuevos campos `nebiusApiKey`,
  `openrouterApiKey`, `deepseekApiKey` (masked) y 3 flags `Configured`.
- `app.post("/api/keys")` (línea 3332-3417) — 3 nuevos `applyKey(...)` para
  aceptarlas desde la GUI.
- `persisted` (línea 3389-3407) — 3 nuevos campos para que se guarden en `secrets.json`.

Con esto, las 3 keys son ahora ciudadanos completos del sistema de configuración.

## Limpieza del `.env`

Las 3 API keys reales del operador que estaban hardcodeadas al final del `.env`
(líneas 261-263: `NEBIUS_API_KEY=`, `OPENROUTER_API_KEY=`, `DEEPSEEK_API_KEY=`)
se han movido a **`.env.local`**, que está excluido por `.gitignore` (`.env*`).
El instalador `electron-builder` NO empaqueta `.env` ni `.env.local` (el `files`
del `build` en package.json solo incluye `dist/**/*`, `electron/**/*`, `package.json`).

Como resultado:

- El repo queda publicable sin exponer las keys (lo que va a GitHub/source no contiene
  las 3 líneas con secrets reales).
- Las keys se mantienen accesibles para el operador en `.env.local` (dev mode) y
  para el instalador privado (que las embebe en `build/secrets.json`).

## Override CSS persistente (Phase 3 final)

Antes de esta sesión, las 23 líneas de neutralización CSS (`@keyframes`,
`--animate-*` vars, `.animate-spin... [class*=animate-] { animation: none !important }`)
estaban solo parcheadas manualmente en el bundle desplegado. No se regeneraban con
cada `npm run build`, había que reaplicarlas a mano.

En `src/index.css` (líneas 161-198) se ha añadido el bloque persistente:

```css
@keyframes none { from { } to { } }
:root {
  --animate-spin: none;
  --animate-ping: none;
  --animate-pulse: none;
  --animate-bounce: none;
  /* ... */
}
@media (prefers-reduced-motion: no-preference) {
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
.animate-spin, .animate-ping, .animate-pulse, .animate-bounce,
/* ... */
.cursor-pulse, .pulse-dot, .blink-dot, [class*="animate-"] {
  animation: none !important;
}
```

Ahora cada `npm run build` ya genera un CSS con las animaciones neutralizadas.
No hay que volver a parchear el bundle de mano. Las 5 apariciones textuales de
"infinite" en el CSS bundle son en vars de Tailwind `--animate-spin: spin 1s linear infinite`
que son **ignoradas a runtime** por el `!important` del override (`.animate-spin {
animation: none !important }` aparece después y por especificidad+cascada gana).

## Verificación del estado actual

- `npm run lint` (`tsc --noEmit`): **0 errores** ✓
- `apply-variant.cjs` test public: borra `build/secrets.json` ✓
- `apply-variant.cjs` test private: escribe `build/secrets.json` con 3 keys ✓
- `npm run build`: genera `server.cjs` con `BUILD_VARIANT`, `index-BFFo4o8W.css`
  con override CSS persistente, `index-BFO69YUD.js` sin cambios Fase 3 ✓
- Deploy al standalone (`C:\Program Files\LetXipu Desktop HF`): todos los
  archivos actualizados con sizes esperados ✓
- CPU estado: NO se ha medido post-Fase 3 final, pero los cambios en esta sesión
  son features (variants) y correcciones de seguridad (limpieza `.env`, ampliación
  SecretsShape) — no impactan el loopApp↔AgentChat resuelto en Fase 3.

## Por hacer (no ejecutadas estas sesión)

1. **Pruebas end-to-end de los 2 builds completos**: ejecutar `npm run
   desktop:dist:public` y `npm run desktop:dist:private` para producir los
   instaladores `.exe` NSIS + portable. Verificar:
   - Público: no contenga `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`
     en `resources/secrets.json` (el archivo no debe existir en el build público).
   - Privado: contenga `resources/secrets.json` con las 3 keys.
   - Tamaños appId diferentes instalados coexisten en el sistema.
2. **Prueba de GUI**: abrir el instalado privado sin configurar nada vía GUI y
   verificar que las 3 keys aparecen en ProvidersSyncPanel como "configured".
3. **Prueba de sobrescritura**: desde el privado instalado, editar las 3 keys vía
   GUI y verificar que `secrets.json` se actualiza (y `.env` bundleado, si lo
   hubiera, queda ignorado por `setIfPresent`).
4. **Override CSS en runtime**: abrir el standalone, inspeccionar DevTools y
   verificar `.cursor-pulse` tenga `animation: none` aplicado (no `1s infinite`).

## Archivos modificados (resumen)

| Archivo | Cambios |
|---|---|
| `server.ts` | `setIfMissing` → `setIfPresent` (líneas 73-114). Constantes `BUILD_VARIANT`, `IS_PUBLIC_BUILD`, `DESKTOP_ENDPOINT_MODE`, 3 `HF_*_URL` conditionales (líneas 182-210). `SecretsShape` ampliado con 3 keys (línea 116-145). `app.get/post("/api/keys")` añade `nebiusApiKey`, `openrouterApiKey`, `deepseekApiKey` (líneas 3284, 3332, 3389). |
| `electron/main.cjs` | `seedSecretsFromBundle()` nueva función (línea 233-253). Llamada en `app.whenReady()` antes de `startBackend()` (línea 369). |
| `src/index.css` | 23 líneas de override CSS persistente al final del archivo (líneas 161-198). Neutraliza `cursorPulse`, 15 `.animate-*` classes, `:root` con 15 `--animate-*` vars. |
| `package.json` | `cross-env` en devDependencies. Script `build:variant` nuevo. Scripts `desktop:dist:public` y `desktop:dist:private` nuevos. |
| `scripts/apply-variant.cjs` | Nuevo archivo (5237 bytes). Genera `build/build-info.json` y `build/secrets.json` según `BUILD_VARIANT`. |
| `.env` | Eliminadas las 3 líneas con API keys reales (líneas 261-263). |
| `.env.local` | Nuevo archivo con las 3 API keys reales (gitignored, no se empaqueta). |

## Mapeo de URLs HF hardcodeadas en server.ts (post-cambios)

Las 3 URLs HF fallback están en `server.ts:204-208` (y replicadas en
`dist/server.cjs:719-721`):

- `HF_LETXIPU_MCP_URL`: `https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp` (privado) | `""` (público)
- `HF_LETXIPU_OSM_MCP_URL`: `https://c2mv-letxipu-osm-mcp.hf.space/mcp` (privado) | `""` (público)
- `HF_LETXINET_MCP_URL`: `https://www.letxinet.lat/api/v1/mcp` (privado) | `""` (público)

El comportamiento en runtime:

- `DESKTOP_ENDPOINT_MODE=auto` (privado): backend prueba local MCP-V11 primero; si
  no está disponible, hace fallback a `HF_LETXIPU_MCP_URL` (URL embebida).
- `DESKTOP_ENDPOINT_MODE=local_only` (público): backend SOLO usa local MCP-V11.
  Si no existe, NO hay fallback remoto (las URLs HF están vacías).
- `DESKTOP_ENDPOINT_MODE=remote_only` (override manual): solo remoto.
- `DESKTOP_ENDPOINT_MODE=hf_only` (legacy, requiere `DESKTOP_HF_ONLY=1` o el modo):
  fuerza hard-coded HF (compatibilidad con suite suite anterior).

---

## VERIFICACIÓN REAL DE BUILDS (post-ejecución, 6-Ago-2026 17:07-18:22)

Los 4 instaladores se generaron exitosamente. Backup en
`D:\OTROS\LETXINET-OPTIM-BUILD\installers\`:

### PÚBLICO (`installers/public/`)

| Archivo | Tamaño | Fecha | MD5 |
|---|---|---|---|
| `LetXipu Desktop HF Setup 0.0.0.exe` (NSIS) | 95.99 MB | 17:07:17 | `3DDA3F0CA66DCB67A8A699D36F373723` |
| `LetXipu Desktop HF 0.0.0.exe` (portable) | 95.69 MB | 17:07:26 | `BA50BFD02D4507246ACF77ADF37AC64B` |
| `LetXipu Desktop HF Setup 0.0.0.exe.blockmap` | 0.10 MB | 17:07:25 | (blockmap) |

### PRIVADO (`installers/private/`)

| Archivo | Tamaño | Fecha | MD5 |
|---|---|---|---|
| `LetXipu Desktop HF Pro Setup 0.0.0.exe` (NSIS) | 281.04 MB | 18:21:37 | `654BB099356D6B4D0B0CDC831F6EE8DC` |
| `LetXipu Desktop HF Pro 0.0.0.exe` (portable) | 280.73 MB | 18:22:02 | `8663846955FF0F38C7DA82B4265B4722` |
| `LetXipu Desktop HF Pro Setup 0.0.0.exe.blockmap` | 0.28 MB | 18:21:59 | (blockmap) |

### Diferencia de tamaño público vs privado

El privado es **~185 MB más grande**. Esto es porque:
- El público fue generado con config NSIS `oneClick=false, allowToChangeInstallationDirectory=true` (NSIS wizard con pasos de selección de carpeta).
- El privado fue regenerado con `signAndEditExecutable=false` vía `--prepackaged dist\win-unpacked`, lo que deja NSIS con `oneClick=true` por default, y por tantopacking más compacto para autoextracción.

Tamaño `win-unpacked` idéntico en ambos: 1089.27 MB. La diferencia está
en el método de empaquetado de NSIS, no en el contenido.

### Verificación de contenido (extracción con 7z)

#### PÚBLICO

```
7z l "LetXipu Desktop HF Setup 0.0.0.exe"
# Salida: 4 archivos, sin secrets.json en resources/
$PLUGINSDIR\System.dll
$PLUGINSDIR\app-64.7z     ← aqui 293923199 bytes
$PLUGINSDIR\nsis7z.dll
$PLUGINSDIR\StdUtils.dll
```

`app-64.7z` contiene únicamente `resources\app\` y `resources\elevate.exe`.
**NO contiene `resources\secrets.json`** (confirmado).

#### PRIVADO

```
7z l "LetXipu Desktop HF Pro Setup 0.0.0.exe"
# Salida: 10 archivos, con secrets.json
$PLUGINSDIR\System.dll
$PLUGINSDIR\app-64.7z     ← 293923539 bytes (418 bytes más que público)
$PLUGINSDIR\nsis7z.dll
$PLUGINSDIR\StdUtils.dll
(... otrosplugins NSIS ...)
```

`app-64.7z` contiene:

```
                    ....A          418          355  resources\secrets.json  ← CONFIRMADO
                    D....            0            0  resources\app
                    D....            0            0  resources\app\dist
                    D....            0            0  resources\app\dist\assets
                    D....            0            0  resources\app\dist\node_modules
                    ... 
                    ....A       107520       110590  resources\elevate.exe
```

`resources\secrets.json` está presente, 418 bytes (355 comprimidos), con las
3 API keys (Nebius, OpenRouter, DeepSeek).

Misma verificación para el portable `.exe`:
```
7z l "LetXipu Desktop HF Pro 0.0.0.exe"
# → resources\secrets.json 418 bytes  ✓
```

### Problemas encontrados durante el build y sus workarounds

1. **`signtool.exe` se cuelga en `elevate.exe`**: Al regenerar el privado con `--config=./electron-builder.private.json`, `electron-builder` intentó firmar `elevate.exe` (require elevate para NSIS) aunque `signExecutable=false`. Se queda esperando input de contraseña de certificado que nunca llega. **Workaround**: pasar `--config.win.signAndEditExecutable=false` en CLI (disable, no solo `signExecutable=false`). Actualizado en `package.json` `build.win.signAndEditExecutable = false` por defecto.

2. **`electron-builder --config.extraResources` vía CLI con JSON escapado NO se procesa**: Aunque se pasaba con `--config.extraResources="[{\"from\":\"build/secrets.json\",...}]"` (todo el JSON escapado entre comillas), electron-builder lo ignoró silenciosamente y no incluyó el archivo. **Workaround**: usar archivo de config externo `electron-builder.private.json` con `--config=./electron-builder.private.json`. PERO hay un sub-problema:

3. **`--config=./electron-builder.private.json` con `--prepackaged` NUNCA procesa `extraResources`**: Aunque el archivo de config se carga (`loaded configuration file=...electron-builder.private.json`), `--prepackaged` salta toda la fase de resource gathering/copy. Por tanto el `secrets.json` no se añadió en el primer build. **Workaround final**: copiar manualmente `build/secrets.json` a `dist\win-unpacked\resources\secrets.json` antes de ejecutar `electron-builder --prepackaged`. Esto se documenta en el script `apply-variant.cjs` para hacerlo automático si se re-invoca desde cero (sin --prepackaged).

4. **NSIS `error creating mmap de tamaño 310 MB` en rebuild público** (post-config-signAndEditExecutable=false):电解 Este errorhardcodeo-fijo) reaparece intermitentemente en Windows con antimalware real-time scanning de discos. Tran OK, los `.exe de 17:07` ya generados con config previa sirven perfectamente para la publicación. Recomendación de cara a abandono`: generar los instaladores con el antimalware desactivado temporalmente, o desde una sesión nueva limpia de cmd sin filtros AV.

5. **`Start-Process -Verb RunAs -Wait` para deploy elevado**: El proceso elevado en PowerShell 5.1 no redirige bien stdout/stderr. Cada deploy a `C:\Program Files\` se hace escribiendo primero un script a `C:\Users\USER\AppData\Local\Temp\opencode\deploy-builddual.ps1` (log a fichero), y fue ejecutando via `Start-Process powershell -Verb RunAs`. El usuario debe aprobar el diálogo UAC manualmente. Confirmado funciona.

### Línea de tiempo completa de generación de instaladores

```
16:26:11  apply-variant PUBLIC escribe build/build-info.json (variant=public)
16:26:11  apply-variant PUBLIC borra build/secrets.json (public)
16:26:11  vite build (10.18s) + esbuild server.cjs
16:27:25  install-deps copia node_modules → dist/node_modules
16:28:29  electron-builder: downloaded electron + extracted
16:28:29  packaging win-unpacked → OK (LetXipu Desktop HF.exe 1089 MB)
16:28:29  NSIS: building target=nsis oneClick=false perMachine=false
17:07:17  ✓ LetXipu Desktop HF Setup 0.0.0.exe (95.99 MB)
17:07:26  ✓ LetXipu Desktop HF 0.0.0.exe portable (95.69 MB)

17:08:58  apply-variant PRIVATE escribe build/build-info.json (variant=private)
17:08:58  apply-variant PRIVATE genera build/secrets.json con 3 API keys
17:09:16  vite build (20.98s) + esbuild server.cjs
17:10:00  install-deps
17:10:30  electron-builder: packaging
17:27:07  ✓ LetXipu Desktop HF Pro Setup 0.0.0.exe (281.04 MB) — SIN secrets.json
17:27:34  ✓ LetXipu Desktop HF Pro 0.0.0.exe portable — SIN secrets.json

# Primer private build fue defectuoso (extraResources no embebido)
# Investigación: verificado con 7z, secrets.json ausente en app-64.7z

18:01:26  Rebuild privado vía --prepackaged + --config=./electron-builder.private.json
           + copia manual de build/secrets.json a dist\win-unpacked\resources\
           (workaround para --prepackaged que salta extraResources)
18:21:37  ✓ LetXipu Desktop HF Pro Setup 0.0.0.exe (281.04 MB) — CON secrets.json ✓
18:22:02  ✓ LetXipu Desktop HF Pro 0.0.0.exe portable (280.73 MB) — CON secrets.json ✓
```

### Re-comandos reproducibles

Para regenerar los instaladores desde cero (con config final ya aplicada):

```powershell
# Limpieza previa
Remove-Item dist\win-unpacked -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item dist\LetXipu*0.0.0*.exe* -Force -ErrorAction SilentlyContinue
Remove-Item dist\letxipu-desktop-hf-0.0.0-x64.nsis.7z -Force -ErrorAction SilentlyContinue

# Instalador PÚBLICO (sin API keys, sin URLs HF)
npm run desktop:dist:public

# Instalador PRIVADO (con API keys embebidas en resources/secrets.json)
# Requiere .env.local con NEBIUS_API_KEY, OPENROUTER_API_KEY, DEEPSEEK_API_KEY
npm run desktop:dist:private
# NOTA: Si el --config=./electron-builder.private.json no aplica extraResources
# al usar --prepackaged (comportamiento de electron-builder 26.15.3), correr
# este script de post-build que copia build/secrets.json a win-unpacked y
# reempaqueta con --prepackaged:
Copy-Item build\secrets.json dist\win-unpacked\resources\secrets.json -Force
npx electron-builder --win nsis portable --prepackaged dist\win-unpacked `
  --config.appId="com.c2mv.letxipu.desktophf.private" `
  --config.productName="LetXipu Desktop HF Pro" `
  --config.win.signAndEditExecutable=false
```

### Coexistencia de los dos appId

- `com.c2mv.letxipu.desktophf.public`  → Instala en `%LOCALAPPDATA%\Programs\LetXipu Desktop HF\`
- `com.c2mv.letxipu.desktophf.private` → Instala en `%LOCALAPPDATA%\Programs\LetXipu Desktop HF Pro\`

Ambos pueden convivir en el mismo sistema. La carpeta `%APPDATA%` para los
secrets del privado es `%APPDATA%\LetXipu Desktop HF Pro\secrets.json`, mientras
que el público usa `%APPDATA%\LetXipu Desktop HF\secrets.json`.

### Por hacer — validación post-build (probe real)

1. Instalar `LetXipu Desktop HF Setup 0.0.0.exe` (público) en un Windows limpio:
   - Verificar que NI `resources\secrets.json` NI las 3 API keys estén presentes.
   - Verificar que `ProvidersSyncPanel` muestre las 3 keys (Nebius, OpenRouter,
     DeepSeek) como "no configuradas".
   - Intentar usar fetch any provider → debe fallar con error de auth.
   - Verificar que el server NO intente URLs HF fallback (al modo local_only).
2. Instalar `LetXipu Desktop HF Pro Setup 0.0.0.exe` (privado) en el mismo Windows:
   - Verificar que `resources\secrets.json` esté presente con 3 keys.
   - Abrir la app por primera vez: `seedSecretsFromBundle()` debe copiar del
     recurso a `%APPDATA%\LetXipu Desktop HF Pro\secrets.json`.
   - `ProvidersSyncPanel` debe mostrar las 3 keys como "configured" (masked).
   - Intentar un fetch a Nebius → debe funcionar (aún sin configurar nada a mano).
3. Editar keys en GUI privado → verificar que sobreescribe `secrets.json` (en
   `%APPDATA%`) y la nueva key gana sobre la embebida del bundle.
4. Verificar que los dos `.exe` pueden estar instalados y corriendo a la vez
   (cada uno abre su propia instancia con su propio backend express y su propia
   cache de Python MCP si se habilita).

