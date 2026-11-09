# Fase 1 — Aplicación de 4 parches quirúrgicos y recompilación

**Fecha:** 2026-07-31 16:30 – 17:05
**Estado:** ✅ COMPLETADA

## Objetivo

Aplicar 4 parches mínimos a los repos fuente para externalizar URLs hardcodeadas y corregir bugs menores, luego recompilar los 3 componentes binarios. El código fuente de cada parche se anexa al final de este log.

---

## Parche P-1 — LetXinet Desktop HF (server.ts + main.cjs)

**Objetivo:** Externalizar 3 URLs remotos hardcodeadas (HF + letxinet.lat) y añadir modo `auto` para que el Desktop HF pruebe primero el MCP-V11 local en `127.0.0.1:4003` y caiga al remoto en fallo.

### Archivo 1: `server.ts` (líneas 123-126)

**Antes:**
```ts
const HF_ONLY_MODE = process.env.DESKTOP_HF_ONLY === "1";
const HF_LETXIPU_MCP_URL = "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp";
const HF_LETXIPU_OSM_MCP_URL = "https://c2mv-letxipu-osm-mcp.hf.space/mcp";
const HF_LETXINET_MCP_URL = "https://www.letxinet.lat/api/v1/mcp";
```

**Después:**
```ts
// Endpoint selection mode (LetXinet Suite):
//   "auto"        — local first, fall back to remote HF on failure (default)
//   "local_only"  — only the local MCP-V11 on 127.0.0.1:4003
//   "remote_only" — only the remote HF/letxinet.lat
//   "hf_only"     — legacy: hard-coded HF (back-compat with DESKTOP_HF_ONLY=1)
const DESKTOP_ENDPOINT_MODE =
  (process.env.DESKTOP_ENDPOINT_MODE || "auto").toLowerCase() as
    "auto" | "local_only" | "remote_only" | "hf_only";
const HF_ONLY_MODE =
  process.env.DESKTOP_HF_ONLY === "1" ||
  DESKTOP_ENDPOINT_MODE === "hf_only";
// LetXinet Suite: externalize remote endpoints via env, fall back to public HF.
const HF_LETXIPU_MCP_URL =
  process.env.LETXIPU_MCP_URL || "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp";
const HF_LETXIPU_OSM_MCP_URL =
  process.env.LETXIPU_OSM_MCP_URL || "https://c2mv-letxipu-osm-mcp.hf.space/mcp";
const HF_LETXINET_MCP_URL =
  process.env.LETXINET_MCP_URL || "https://www.letxinet.lat/api/v1/mcp";
```

### Archivo 1: `server.ts` (función `resolveMcpUrl`)

**Antes:**
```ts
async function resolveMcpUrl(): Promise<string> {
  const useLocal = await probeLocalMcp();
  if (useLocal) return LOCAL_MCP_URL;
  if (HF_ONLY_MODE) return HF_LETXIPU_MCP_URL;
  return process.env.LETXIPU_MCP_URL || HF_LETXIPU_MCP_URL;
}
```

**Después:**
```ts
async function resolveMcpUrl(): Promise<string> {
  switch (DESKTOP_ENDPOINT_MODE) {
    case "local_only":
      return LOCAL_MCP_URL;
    case "remote_only":
    case "hf_only":
      return HF_LETXIPU_MCP_URL;
    case "auto":
    default: {
      const useLocal = await probeLocalMcp();
      if (useLocal) return LOCAL_MCP_URL;
      return process.env.LETXIPU_MCP_URL || HF_LETXIPU_MCP_URL;
    }
  }
}
```

### Archivo 2: `electron/main.cjs` (líneas 95-107)

**Antes:**
```js
const env = {
  ...process.env,
  // ...
  DESKTOP_HF_ONLY: '1',
  PORT: String(APP_PORT),
  LETXIPU_MCP_URL: 'https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp',
  LETXIPU_OSM_MCP_URL: 'https://c2mv-letxipu-osm-mcp.hf.space/mcp',
  LETXINET_MCP_URL: 'https://www.letxinet.lat/api/v1/mcp',
  LETXIPU_DESKTOP_USERDATA: logDir,
};
```

**Después:**
```js
const env = {
  ...process.env,
  // ...
  // LetXinet Suite: when launched by the Suite, DESKTOP_ENDPOINT_MODE is set
  // by shared-env/LetXinet-Suite.env. Default 'auto' = local MCP first,
  // fall back to remote HF/letxinet on failure. Preserve any explicit
  // DESKTOP_ENDPOINT_MODE passed in via process.env, otherwise override
  // the legacy DESKTOP_HF_ONLY=1 to enable auto mode when the user did not
  // explicitly request hf_only.
  DESKTOP_ENDPOINT_MODE: process.env.DESKTOP_ENDPOINT_MODE || 'auto',
  DESKTOP_HF_ONLY: process.env.DESKTOP_ENDPOINT_MODE === 'hf_only' ? '1' : process.env.DESKTOP_HF_ONLY || '',
  PORT: String(APP_PORT),
  LETXIPU_DESKTOP_USERDATA: logDir,
};
```

Las URLs `LETXIPU_*_URL` ya no se hardcodean en el spawn env; `server.ts` las lee de `process.env` (que el launcher del Suite inyecta desde `LetXinet-Suite.env`) con fallback a las HF spaces públicas.

---

## Parche P-2 — MCP-V11-Local (src/routes/pdf.ts)

**Objetivo:** Externalizar los 7 espejos Sci-Hub hardcodeados + la URL de Unpaywall + la URL del DOI resolver para que los operadores puedan actualizarlos editando `LetXinet-Suite.env` sin recompilar.

### Cambio:

**Antes:**
```ts
const SCIHUB_MIRRORS = [
    'https://sci-hub.al',
    'https://sci-hub.mk',
    'https://sci-hub.ru',
    'https://sci-hub.su',
    'https://sci-hub.red',
    'https://sci-hub.st',
    'https://sci-hub.ee',
];
```

**Después:**
```ts
const SCIHUB_MIRRORS_DEFAULT = [
    'https://sci-hub.al', 'https://sci-hub.mk',
    'https://sci-hub.ru', 'https://sci-hub.su',
    'https://sci-hub.red', 'https://sci-hub.st',
    'https://sci-hub.ee',
];
function loadScihubMirrors(): string[] {
    const raw = process.env.SCIHUB_MIRRORS || '';
    if (!raw.trim()) return SCIHUB_MIRRORS_DEFAULT;
    const parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length ? parsed : SCIHUB_MIRRORS_DEFAULT;
}
const SCIHUB_MIRRORS = loadScihubMirrors();

const UNPAYWALL_BASE_URL =
    process.env.UNPAYWALL_BASE_URL || 'https://api.unpaywall.org/v2';
const UNPAYWALL_EMAIL =
    process.env.UNPAYWALL_EMAIL || 'letxipu@search.mcp';
const DOI_RESOLVER_URL =
    process.env.DOI_RESOLVER_URL || 'https://doi.org';
```

Y en el cuerpo de `resolvePdfUrl`:

**Antes:**
```ts
const unpRes = await fetchWithTimeout(`https://api.unpaywall.org/v2/${encodeURIComponent(input)}?email=letxipu@search.mcp`, {}, 8000);
// ...
return `https://doi.org/${input}`;
```

**Después:**
```ts
const unpRes = await fetchWithTimeout(`${UNPAYWALL_BASE_URL}/${encodeURIComponent(input)}?email=${encodeURIComponent(UNPAYWALL_EMAIL)}`, {}, 8000);
// ...
return `${DOI_RESOLVER_URL}/${input}`;
```

**Variables nuevas expuestas a `LetXinet-Suite.env`:**
- `SCIHUB_MIRRORS` — lista CSV de espejos sci-hub (sin rutas, solo hosts)
- `UNPAYWALL_BASE_URL` — base de Unpaywall (sin `/v2/{doi}`)
- `UNPAYWALL_EMAIL` — email de contacto (política de Unpaywall)
- `DOI_RESOLVER_URL` — base del DOI resolver

---

## Parche P-3 — MCP-V11-Local (src/utils/osm-geocoder.ts)

**Objetivo:** Corregir el default erróneo `localhost:7860` (puerto de Gradio antiguo) al puerto real del OSM-MCP del Suite (7082), y usar `127.0.0.1` (no `localhost`) para evitar resolución IPv6 `::1` lenta en Windows.

**Antes:**
```ts
const OSM_MCP_URL = process.env.OSM_MCP_URL || 'http://localhost:7860';
```

**Después:**
```ts
// LetXinet Suite: OSM-MCP runs on port 7082 (not 7860 which was a V15 mistake
// inherited from GRADIO_SERVER_PORT). Use 127.0.0.1 (not localhost) to avoid
// IPv6 ::1 resolution issues on Windows.
const OSM_MCP_URL = process.env.OSM_MCP_URL || 'http://127.0.0.1:7082';
```

El operador puede sobrescribir con `OSM_MCP_URL=` en `LetXinet-Suite.env` si mueve el OSM-MCP a otro puerto.

---

## Parche P-4 — OSM-MCP (pkg/osm/util.go + pkg/tools/osm_health_tool.go)

**Objetivo:** Externalizar el `User-Agent` HTTP (para cumplir la política de Nominatim con contacto real por deployment) y consolidar el health tool para que use los helpers env-aware existentes en lugar de leer variables sueltas.

### Archivo 1: `pkg/osm/util.go`

**Antes:**
```go
// User agent for API requests (required by Nominatim's usage policy)
UserAgent = "osm-mcp-server/0.1.0"

// Earth radius in meters (approximate) - re-exported from geo package
EarthRadius = geo.EarthRadius
)
```

**Después:**
```go
// User agent for API requests (required by Nominatim's usage policy)
// LetXinet Suite: operators may override via OSM_USER_AGENT env (e.g. to
// include a real contact email per Nominatim's policy).
UserAgent = "osm-mcp-server/0.1.0"

// Earth radius in meters (approximate) - re-exported from geo package
EarthRadius = geo.EarthRadius
)

// UserAgentEnv returns the User-Agent string to use for outbound OSM API
// requests. Operators can override the default via the OSM_USER_AGENT
// environment variable so each deployment can declare a real contact.
func UserAgentEnv() string {
	if ua := os.Getenv("OSM_USER_AGENT"); ua != "" {
		return strings.TrimSpace(ua)
	}
	return UserAgent
}
```

### Archivo 2: `pkg/tools/osm_health_tool.go`

**Antes:**
```go
import (
	"context", "encoding/json", "fmt", "net/http", "os", "sync", "time",
	"github.com/mark3labs/mcp-go/mcp"
)

func HandleOSMHealth(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nominatimURL := os.Getenv("NOMINATIM_URL")
	if nominatimURL == "" {
		nominatimURL = "https://nominatim.openstreetmap.org"
	}
	osrmURL := os.Getenv("OSRM_URL")
	if osrmURL == "" {
		osrmURL = "https://router.project-osrm.org"
	}
	overpassURL := os.Getenv("OVERPASS_URL")
	if overpassURL == "" {
		overpassURL = "https://overpass-api.de"
	}
	// ...
	req.Header.Set("User-Agent", "LetXipu-OSM-MCP/1.0 (osm_health probe)")
```

**Después:**
```go
import (
	"context", "encoding/json", "fmt", "net/http", "os", "strings", "sync", "time",
	"github.com/NERVsystems/osmmcp/pkg/osm"
	"github.com/mark3labs/mcp-go/mcp"
)

func HandleOSMHealth(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	nominatimURL := osm.NominatimBaseURLEnv()      // ya existía
	osrmURL := os.Getenv("OSRM_URL")
	if osrmURL == "" {
		osrmURL = osm.ProfileBaseURL("car")          // ya existía
	}
	overpassURL := osm.OverpassBaseURLEnv()         // ya existía
	if strings.HasPrefix(overpassURL, "https://overpass-api.de/api/interpreter") {
		overpassURL = "https://overpass-api.de"
	} else {
		overpassURL = strings.TrimRight(overpassURL, "/")
	}
	// ...
	req.Header.Set("User-Agent", osm.UserAgentEnv())  // nuevo helper
```

**Variables nuevas expuestas a `LetXinet-Suite.env`:**
- `OSM_USER_AGENT` — User-Agent para requests a Nominatim/Overpass/OSRM
- (Las ya existentes `NOMINATIM_URL`, `OVERPASS_URL`, `OSRM_URL`, `OSRM_URL_CAR/BIKE/FOOT`, `TILE_SERVER_URL` ahora se honran también en el health tool, no solo en el API.)

El `main.go` ya soportaba `-user-agent` flag y `SetUserAgent()` runtime, así que el health tool ahora respeta la misma cadena que el resto del server.

---

## Builds de los 3 componentes binarios

### OSM-MCP (`go build`)

```powershell
cd D:\OTROS\letxipu-osm-mcp
go build -o osmmcp-patched.exe ./cmd/osmmcp
```

- **Salida:** `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` (23.55 MB)
- **Tiempo:** ~5 s
- **Tipo-check:** `go build` limpio
- **Resultado:** ✅

### MCP-V11-Local (`tsc` + `pkg`)

Compilación TypeScript:
```powershell
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL
npm run build    # tsc → dist/ (server.js 22.8 KB, actualizado a 16:39)
```
- **Resultado:** ✅ EXIT 0

Compilación a EXE con `@yao-pkg/pkg` 6.21.0:
```powershell
& node_modules\.bin\pkg . --targets node22-win-x64 --output packaging\bin\MCP-V11-Local.exe
```

**Problema inicial:** el remote cache de `yao-pkg/pkg-fetch` devuelve 404 para `node-v20.20.2-win-x64`, lo que dispara la compilación desde source de Node (requiere `patch.exe` de UNIX, ausente en Windows). Probado primero con `node18-win-x64`: mismo error.

**Solución:** descarga manual del prebuilt `node v22.22.3 win-x64` desde el release GitHub `yao-pkg/pkg-fetch v3.6`:
- URL: `https://github.com/yao-pkg/pkg-fetch/releases/download/v3.6/node-v22.22.3-win-x64` (54.8 MB)
- Destino: `%USERPROFILE%\.pkg-cache\v3.6\node-v22.22.3-win-x64`
- Reintento con target `node22-win-x64` → pkg detecta el prebuilt, no compila, empaqueta OK.

- **Salida:** `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\bin\MCP-V11-Local.exe` (93.75 MB)
- **Tiempo:** ~2 min (empaquetar código source V11 en el binario)
- **Resultado:** ✅

**Verificación de parches embebidos** (strings en el EXE):
```
FOUND  7082               @ offset 93376170
FOUND  127.0.0.1:7082     @ offset 93376160
FOUND  UNPAYWALL_BASE_URL @ offset 57808079
FOUND  UNPAYWALL_EMAIL    @ offset 57808115
FOUND  SCIHUB_MIRRORS     @ offset 57808015
FOUND  DOI_RESOLVER_URL   @ offset 57808143
FOUND  loadScihubMirrors  @ offset 57815676
```

Todos los parches P-2 y P-3 están en el bytecode del exe.

### LetXinet Desktop HF (`electron-builder --win dir`)

```powershell
cd D:\OTROS\LETXINET-DESKTOP-HF
npm run build    # vite + esbuild: dist/server.cjs (290 KB), dist/index.html
& node_modules\.bin\electron-builder --win dir
```

**Icono añadido:** antes del build, `icon.ico` (107.6 KB, 16-256 px, fondo `#0b0f1a`) fue copiado a `D:\OTROS\LETXINET-DESKTOP-HF\build\icon.ico`. `package.json` actualizado:
```json
"win": { "target": ["nsis","portable"], "icon": "build/icon.ico",
         "signAndEditExecutable": true, "signExecutable": false,
         "forceCodeSigning": false }
```

Primer intento con `signAndEditExecutable: false` empaquetó OK pero **no incrustó el icono** (warning: "executable resource editing and code signing skipped"). Cambio a `signAndEditExecutable: true, signExecutable: false` → aplica icono + metadata al .exe pero **omite code signing** (compromiso correcto: sin certificado de firma).

- **Salida:** `D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\LetXipu Desktop HF.exe` (195.05 MB, hoy 17:00:37)
- **Tiempo:** ~5 min (descargó Electron 37.10.3, ~120 MB)
- **Verificación del icono:** `System.Drawing.Icon.ExtractAssociatedIcon` devuelve 32x32 px (icono principal extraído del .exe), confirmando que el `.ico` está embebido en los recursos del binario.
- **Resultado:** ✅

---

## Resumen de variables nuevas externalizadas a `LetXinet-Suite.env`

| Variable | Default | Componente | Propósito |
|----------|---------|-----------|-----------|
| `DESKTOP_ENDPOINT_MODE` | `auto` | Desktop HF (P-1) | `auto` / `local_only` / `remote_only` / `hf_only` |
| `LETXIPU_MCP_URL` | (HF space público) | Desktop HF (P-1) | URL del MCP de búsqueda remoto |
| `LETXIPU_OSM_MCP_URL` | (HF space público) | Desktop HF (P-1) | URL del MCP de OSM remoto |
| `LETXINET_MCP_URL` | `https://www.letxinet.lat/api/v1/mcp` | Desktop HF (P-1) | URL del MCP institucional |
| `SCIHUB_MIRRORS` | (7 defaults intégrate) | V11 (P-2) | Lista CSV de hosts sci-hub |
| `UNPAYWALL_BASE_URL` | `https://api.unpaywall.org/v2` | V11 (P-2) | Base Unpaywall sin `/v2/{doi}` |
| `UNPAYWALL_EMAIL` | `letxipu@search.mcp` | V11 (P-2) | Email contacto político |
| `DOI_RESOLVER_URL` | `https://doi.org` | V11 (P-2) | Base DOI resolver |
| `OSM_MCP_URL` | `http://127.0.0.1:7082` | V11 (P-3) | Endpoint del OSM-MCP desde el punto de vista de V11 |
| `OSM_USER_AGENT` | `osm-mcp-server/0.1.0` | OSM-MCP (P-4) | UA para requests a Nominatim/Overpass/OSRM |

---

## Tipo-Check / lint de cada componente

| Componente | Comando | Resultado |
|------------|---------|-----------|
| OSM-MCP | `go build ./cmd/osmmcp` | ✅ Sin errores |
| V11 | `npx tsc --noEmit -p tsconfig.json` | ✅ EXIT 0 |
| Desktop HF | `npx tsc --noEmit -p tsconfig.json` | ✅ EXIT 0 |
| Desktop HF (electron) | `electron-builder` | ✅ EXIT 0 |

---

## Compromiso de diseño: `signAndEditExecutable`

El `electron-builder` aplica icono + metadata al `.exe` solo si `signAndEditExecutable` es `true` (porque la edición de resources requiere parseo del PE y opcionalmente re-firma). `signExecutable: false` excluye solo el código signing paso, manteniendo la edición del icono. `forceCodeSigning: false` ya estaba en el original y permite producción sin cert.

Plan: cualquier distribución pública futura debería firmarse con un cert EV para evitar SmartScreen warnings. El instalador Suite Inno puede firmar el `LetXinet-Suite-1.0-Setup.exe` con `signcode` si se obtiene un certificado.

---

## Estado de disco (fin Fase 1)

| Unidad | Libre | Notas |
|--------|-------|-------|
| D: | 11.36 GB | Liberado espacio (las limpiezas de `%TEMP%` y pkg-cache dieron extra) |
| C: | ~2.65 GB | pkg-cache 54.8 MB ocupado |

Margen muy cómodo para Fase 2 (MarkItDown portátil) + Fase 3 (recolección).

---

## Archivos modificados en los repos fuente (dejarlo así hasta validación Fase 6)

### LetXinet Desktop HF
- `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` (P-1: +14 líneas)
- `D:\OTROS\LETXINET-DESKTOP-HF\electron\main.cjs` (P-1: -3 +8 líneas)
- `D:\OTROS\LETXINET-DESKTOP-HF\package.json` (añadido `icon`,`signExecutable`)
- `D:\OTROS\LETXINET-DESKTOP-HF\build\icon.ico` (nuevo, 107.6 KB)
- `D:\OTROS\LETXINET-DESKTOP-HF\dist\server.cjs` (regenerado)
- `D:\OTROS\LETXINET-DESKTOP-HF\dist\index.html` (regenerado)
- `D:\OTROS\LETXINET-DESKTOP-HF\dist\win-unpacked\LetXipu Desktop HF.exe` (regenerado, 195 MB)

### MCP-V11-Local
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\src\routes\pdf.ts` (P-2: +20 líneas -2)
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\src\utils\osm-geocoder.ts` (P-3: +1 línea comentario -1)
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist\` (regenerado por tsc)
- `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\packaging\bin\MCP-V11-Local.exe` (regenerado, 93.75 MB)

### OSM-MCP
- `D:\OTROS\letxipu-osm-mcp\pkg\osm\util.go` (P-4: +9 líneas)
- `D:\OTROS\letxipu-osm-mcp\pkg\tools\osm_health_tool.go` (P-4: imports + helper calls + UA)
- `D:\OTROS\letxipu-osm-mcp\osmmcp-patched.exe` (nuevo, 23.55 MB)

### MarkItDown
- (Sin cambios en esta fase; no requiere parches de URLs hardcodeadas ya que `mcp-adapter/markitdown-mcp.js` ya externalizaba `MARKITDOWN_API_URL`.)

---

## Próximos pasos

**Fase 2:** build payload MarkItDown API portátil (Python embebido + pymupdf4llm + fastapi/uvicorn), generar `python-3.12.x-embed-amd64.zip` con pip y deps instaladas en target.

---
**Siguiente:** Fase 2 — Build payload MarkItDown portátil
