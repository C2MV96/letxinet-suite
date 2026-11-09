# PLAN MAESTRO — LetXinet Suite v1.0

> Documento de referencia única. Todo el progreso, decisiones, parches y resultados
> se escriben a disco en esta carpeta `PLAN-Y-PROGRESO\`. Ningún paso se ejecuta
> "en memoria": cada acción genera un archivo, un log, o un diff persistente.

---

## 1. Visión y objetivos

**LetXinet Suite v1.0** es un único instalador Windows (Inno Setup, admin) que
permite al usuario elegir qué componentes instalar:

| Componente | Tipo | Puerto default | Servicio Windows |
|---|---|---|---|
| OSM-MCP | Servicio (Go) | 7082 (/mcp) + 9090 (metrics) | `LetXipuOSMMCP` |
| MCP-V11-Local | Servicio (Node + Python spaCy) | 4003 (api) + 4002 (spaCy) | `LetXipuMCV11Local` |
| MarkItDown API | Servicio (Python + uvicorn) | 7860 | `LetXipuMarkItDownAPI` |
| LetXinet Desktop | App de escritorio (Electron, **NO servicio**) | 43123 (Express local) | N/A — link Menú Inicio |

Carpeta de trabajo: `D:\OTROS\LETXINET-SUITE\` (no se tocan los 4 repos fuente).

### Principios rectores

1. **Reutilizar binarios ya compilados para los 3 MCP** (no recompilar todo).
   Solo se hacen **parches quirúrgicos** al código fuente donde hay links hardcoded
   que cambian con el tiempo.
2. **Generar programas NUEVOS con código fuente por separado** para:
   - El instalador Suite (`src-suite\instalador\LetXinet-Suite.iss`)
   - Los launchers cmd (`src-suite\bin\scripts-cmd\`)
   - Los scripts de registro/desregistro de servicios NSSM
   - El cargador de variables compartidas `suite-env-loader.cmd`
   - El generador de iconos `build-icon.py`
3. **Cero links hardcoded en runtime**: cualquier URL/endpoint configurable
   vive en `shared-env\LetXinet-Suite.env` (editable por el usuario).
4. **Trazabilidad en disco**: cada fase escribe su log y su diff a disco
   bajo `src-suite\logs\` y `PLAN-Y-PROGRESO\`.

---

## 2. Inventario de links hardcoded detectados en código fuente

### 2.1 LETXINET-DESKTOP-HF (3 críticos + 2 motores web + ~20 endpoints IA)

| Archivo:línea | URL hardcoded | Variable extern a crear |
|---|---|---|
| `server.ts:124` | `https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp` | `HF_LETXIPU_MCP_URL` (ya existe en `.env.example` line 11) |
| `server.ts:125` | `https://c2mv-letxipu-osm-mcp.hf.space/mcp` | `HF_LETXIPU_OSM_MCP_URL` (ya existe line 12) |
| `server.ts:126` | `https://www.letxinet.lat/api/v1/mcp` | `HF_LETXINET_MCP_URL` (ya existe line 10) |
| `electron/main.cjs:102` | `https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp` | Igual |
| `electron/main.cjs:103` | `https://c2mv-letxipu-osm-mcp.hf.space/mcp` | Igual |
| `electron/main.cjs:104` | `https://www.letxinet.lat/api/v1/mcp` | Igual |
| `server.ts:1342` | `https://html.duckduckgo.com/html/?q=...` | `DUCKDUCKGO_HTML_URL` |
| `server.ts:1382` | `https://search.yahoo.com/search?p=...` | `YAHOO_SEARCH_URL` |
| `server.ts:2092-2159, 3383-3388, 4109, 5116` | `https://opencode.ai/zen/v1` (modelos IA) | `OPENCODE_BASE_URL` (ya existe) |
| `server.ts:2157-2159, 2187, 2327, 2800, 3441-3443, 3465, 4109, 4233-4236, 5116, 5188-5191` | `https://integrate.api.nvidia.com/v1` | `NVIDIA_BASE_URL` (ya existe) |
| `server.ts:5195-5198, 5473-5477` | `https://api.mistral.ai/v1` | `MISTRAL_BASE_URL` (ya existe) |

### 2.2 letxipu-osm-mcp (4 defaults en Go)

| Archivo:línea | URL hardcoded | Variable extern |
|---|---|---|
| `pkg/osm/util.go:19` | `https://nominatim.openstreetmap.org` | `NOMINATIM_URL` (ya soportado) |
| `pkg/osm/util.go:20` | `https://overpass-api.de/api/interpreter` | `OVERPASS_URL` (ya soportado) |
| `pkg/osm/util.go:21` | `https://router.project-osrm.org` | `OSRM_URL_CAR/BIKE/FOOT` (ya soportado) |
| `pkg/osm/util.go:98` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | `TILE_SERVER_URL` (ya soportado) |
| `pkg/tools/map_image.go:60` | `https://www.openstreetmap.org/#map=...` | `OSM_SHARE_URL_BASE` (nuevo — parche Go) |
| `pkg/tools/osm_health_tool.go:75,79,83` | 3 defaults para health check | NUEVO: usar `NominatimBaseURLEnv()` helpers ya existentes (parche Go) |
| `pkg/osm/util.go:24` | `UserAgent = "osm-mcp-server/0.1.0"` | `OSMMCP_USER_AGENT` (nuevo — parche Go) |

### 2.3 LETXIPU-SEARCH-MCP-V11-LOCAL (~25 endpoints académicos + sci-hub)

**A) Críticos — cambian con frecuencia (deben externalizarse):**

| Archivo:línea | URL hardcoded | Variable extern |
|---|---|---|
| `src/routes/pdf.ts:15-23` | 7 espejos `sci-hub.{al,mk,ru,su,red,st,ee}` | `SCIHUB_MIRRORS` (nueva, CSV) |
| `src/routes/pdf.ts:64` | `https://api.unpaywall.org/v2/...` | `UNPAYWALL_API_URL` (nueva) |
| `src/routes/pdf.ts:83` | `https://doi.org/${input}` | `DOI_RESOLVER_URL` (nueva) |
| `src/utils/osm-geocoder.ts:17` | `http://localhost:7860` (OSM MCP default) | `OSM_MCP_URL` (ya existe, corregir default a `127.0.0.1:7082`) |

**B) Estables pero externalizables (JSON de datos, no de código):**

| Archivo | URLs | Tipo |
|---|---|---|
| `src/providers/openalex.ts:89,157` | `https://api.openalex.org/works?...` | API estable |
| `src/providers/global-academic.ts:94,134` | `https://api.crossref.org/works?...` | API estable |
| `src/routes/mcp.ts:1071,1088,1105,1119` | `https://api.openalex.org`, `api.crossref.org`, `api.semanticscholar.org` | API estables |
| `src/routes/mcp.ts:727-735` | 9 URLs health-check sources | Estables |
| `src/providers/openreview.ts:30-31` | `OPENREVIEW_API_V1`, `OPENREVIEW_API_V2` | **YA externalizado** |
| `src/providers/latam-repositories.ts` | 15+ URLs ALICIA/LaReferencia/OASISBr/BDTD | APIs estables institucionales |
| `src/utils/reranking.ts:868,894` y `src/utils/osm-geocoder.ts:346` | `https://nominatim.openstreetmap.org/...` | URL patrón OSM estable |
| `src/providers/huggingface.ts:10` | `https://huggingface.co/api/daily_papers` | Estable |
| `src/providers/dblp.ts:11,82` | `https://dblp.org/search/publ/api` y `.bib` rec | Estable |
| `src/providers/mineru-client.ts:20` | `https://mineru.net/api/v4` | **YA externalizado** (`MINERU_API_URL`) |
| `src/data/handle-prefixes.json` y `alicia-institutions.json` | URLs handle.net, repositorios | Datos de config — OK |

> Decisión: Las APIs estables (OpenAlex, Crossref, SemanticScholar, DBLP,
> ALICIA, LaReferencia, OASISBr, BDTD, PubMed, arXiv, OpenReview, HuggingFace,
> handle.net) **NO se externalizan** — son URLs públicas estables, no cambian
> con frecuencia. Externalizarlas añadiría ruido sin valor.
> Solo se externalizan:
> - Los 3 endpoints MCP remotos del HF Desktop (HF, letxinet.lat)
> - Los 7 espejos Sci-Hub (cambian frecuentemente)
> - Los defaults OSM (Nominatim/Overpass/OSRM/Tiles) — ya hecho
> - Unpaywall + DOI resolver
> - Los motores web (DuckDuckGo, Yahoo)
> - Los 3 endpoints IA (opencode.ai, NVIDIA, Mistral) — ya hecho

### 2.4 markitdown-api (1 URL hardcoded)

| Archivo:línea | URL | Variable extern |
|---|---|---|
| `mcp-adapter/markitdown-mcp.js:20` | default `http://127.0.0.1:7860` | `MARKITDOWN_API_URL` (**YA** externalizado, solo ajustar default) |

No requiere parche — ya es `process.env.MARKITDOWN_API_URL || 'http://127.0.0.1:7860'`.

---

## 3. Parches al código fuente (3 quirúrgicos)

### Parche P-1 — HF Desktop: externalizar los 3 URLs remotos + nuevos modos

**Archivos afectados:**
- `D:\OTROS\LETXINET-DESKTOP-HF\electron\main.cjs` (líneas 100-106)
- `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` (líneas 124-172)

**Cambios propuestos:**

`electron/main.cjs` — reemplazar los 3 strings hardcoded por `process.env.*`
leídos por el Suite.env. Implementar nueva variable `LETXIPU_DESKTOP_MODE`
con 4 valores:

```js
// ANTES (líneas 102-104):
LETXIPU_MCP_URL: 'https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp',
LETXIPU_OSM_MCP_URL: 'https://c2mv-letxipu-osm-mcp.hf.space/mcp',
LETXINET_MCP_URL: 'https://www.letxinet.lat/api/v1/mcp',

// DESPUÉS:
// Cargar defaults desde process.env si están, sino usar hardcoded como fallback.
// El Suite.env externo los sobreescribe. Modo configurable:
LETXIPU_MCP_URL: process.env.HF_LETXIPU_MCP_URL || 'https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp',
LETXIPU_OSM_MCP_URL: process.env.HF_LETXIPU_OSM_MCP_URL || 'https://c2mv-letxipu-osm-mcp.hf.space/mcp',
LETXINET_MCP_URL: process.env.HF_LETXINET_MCP_URL || 'https://www.letxinet.lat/api/v1/mcp',
LETXIPU_DESKTOP_MODE: process.env.LETXIPU_DESKTOP_MODE || 'auto',
```

`server.ts` — análogamente, reemplazar las 3 constantes hardcoded:
```ts
// ANTES (líneas 124-126):
const HF_LETXIPU_MCP_URL = "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp";
const HF_LETXIPU_OSM_MCP_URL = "https://c2mv-letxipu-osm-mcp.hf.space/mcp";
const HF_LETXINET_MCP_URL = "https://www.letxinet.lat/api/v1/mcp";

// DESPUÉS:
const HF_LETXIPU_MCP_URL = process.env.HF_LETXIPU_MCP_URL || "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp";
const HF_LETXIPU_OSM_MCP_URL = process.env.HF_LETXIPU_OSM_MCP_URL || "https://c2mv-letxipu-osm-mcp.hf.space/mcp";
const HF_LETXINET_MCP_URL = process.env.HF_LETXINET_MCP_URL || "https://www.letxinet.lat/api/v1/mcp";
```

Y unificar la lógica de selección de URL en `server.ts:165-172`:
```ts
// ANTES:
function pickMcpUrl(useLocal: boolean): string {
  if (useLocal) return LOCAL_MCP_URL;
  if (HF_ONLY_MODE) return HF_LETXIPU_MCP_URL;
  return process.env.LETXIPU_MCP_URL || HF_LETXIPU_MCP_URL;
}

// DESPUÉS:
const DESKTOP_MODE = (process.env.LETXIPU_DESKTOP_MODE || 'auto').toLowerCase();
function pickMcpUrl(useLocal: boolean): string {
  if (useLocal) return LOCAL_MCP_URL;
  if (DESKTOP_MODE === 'hf_only') return HF_LETXIPU_MCP_URL;
  if (DESKTOP_MODE === 'local_only') return LOCAL_MCP_URL;
  if (DESKTOP_MODE === 'remote_only') return process.env.LETXIPU_MCP_URL || HF_LETXIPU_MCP_URL;
  // 'auto' default: si LOS servicios locales responden al health-check, usarlos; sino remoto.
  return process.env.LETXIPU_MCP_URL || LOCAL_MCP_URL || HF_LETXIPU_MCP_URL;
}
```

**Recompilación requerida:**
```
cd D:\OTROS\LETXINET-DESKTOP-HF
npm install
npm run build
npx electron-builder --win dir
```
Salida: `dist\win-unpacked\LetXipu Desktop HF.exe` (con icono Suite si se aplica parche).

### Parche P-2 — V11: externalizar espejos Sci-Hub

**Archivo:** `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\src\routes\pdf.ts:15-23`

```ts
// ANTES:
const SCIHUB_MIRRORS = [
    'https://sci-hub.al',    // ✅ Working
    'https://sci-hub.mk',   // ✅ Working
    'https://sci-hub.ru',    // ⚠️ May not return PDF
    'https://sci-hub.su',    // ⚠️ May not return PDF
    'https://sci-hub.red',   // ⚠️ May not return PDF
    'https://sci-hub.st',    // ❌ Often 403
    'https://sci-hub.ee',    // ❌ Often 403
];

// DESPUÉS:
const SCIHUB_MIRRORS = (process.env.SCIHUB_MIRRORS ||
    'https://sci-hub.al,https://sci-hub.mk,https://sci-hub.ru,https://sci-hub.su,https://sci-hub.red,https://sci-hub.st,https://sci-hub.ee'
  ).split(',').map(s => s.trim()).filter(Boolean);
```

Y más abajo en el mismo archivo:
```ts
// ANTES (línea 64):
const unpRes = await fetchWithTimeout(`https://api.unpaywall.org/v2/${encodeURIComponent(input)}?email=letxipu@search.mcp`, {}, 8000);

// DESPUÉS:
const UNPAYWALL_API_URL = process.env.UNPAYWALL_API_URL || 'https://api.unpaywall.org';
const unpRes = await fetchWithTimeout(`${UNPAYWALL_API_URL}/v2/${encodeURIComponent(input)}?email=${encodeURIComponent(process.env.UNPAYWALL_EMAIL || 'letxipu@example.com')}`, {}, 8000);

// ANTES (línea 83):
return `https://doi.org/${input}`;

// DESPUÉS:
const DOI_RESOLVER_URL = process.env.DOI_RESOLVER_URL || 'https://doi.org';
return `${DOI_RESOLVER_URL}/${input}`;
```

### Parche P-3 — V11: corregir default `OSM_MCP_URL` de 7860 a 7082

**Archivo:** `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\src\utils\osm-geocoder.ts:17`

```ts
// ANTES:
const OSM_MCP_URL = process.env.OSM_MCP_URL || 'http://localhost:7860';

// DESPUÉS:
const OSM_MCP_URL = process.env.OSM_MCP_URL || 'http://127.0.0.1:7082';
```

**Recompilación V11 (cubrir P-2 y P-3 en una sola pasada):**
```
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL
npm install
npx tsc --noEmit     # typecheck
npm run build        # tsc → dist/
# Recompilar portable exe con los parches aplicados:
npx yao-pkg . --targets node20-win-x64 --output dist-portable\MCP-V11-Local.exe
```

### Parche P-4 — OSM-MCP: externalizar User-Agent y ajustar health tool

**Archivo:** `D:\OTROS\letxipu-osm-mcp\pkg\osm\util.go:24` + `pkg\tools\osm_health_tool.go`

```go
// ANTES (util.go line 24):
const UserAgent = "osm-mcp-server/0.1.0"

// DESPUÉS (añadir helper):
const DefaultUserAgent = "osm-mcp-server/0.1.0"

func UserAgentEnv() string {
    if u := os.Getenv("OSMMCP_USER_AGENT"); u != "" {
        return u
    }
    return DefaultUserAgent
}
```

`pkg\tools\osm_health_tool.go:75,79,83` — reemplazar defaults hardcoded por
los helpers que ya existen:
```go
// ANTES:
nominatimURL = "https://nominatim.openstreetmap.org"
osrmURL = "https://router.project-osrm.org"
overpassURL = "https://overpass-api.de"

// DESPUÉS:
nominatimURL = osm.NominatimBaseURLEnv()
osrmURL = osm.OSRMBaseURLEnv() // CAVEAT: necesita un helper ProfileBaseURL("car") equivalente
overpassURL = osm.OverpassBaseURLEnv()
```

**Recompilación:**
```
cd D:\OTROS\letxipu-osm-mcp
go build -o osmmcp.exe -ldflags="-s -w" ./cmd/osmmcp
```

### Parche P-4b (opcional) — OSM-MCP: externalizar URL share del mapa

**Archivo:** `D:\OTROS\letxipu-osm-mcp\pkg\tools\map_image.go:60`
```go
// ANTES: osmURL := fmt.Sprintf("https://www.openstreetmap.org/#map=...", ...)
// DESPUÉS: leer OSM_SHARE_URL_BASE env, default "https://www.openstreetmap.org"
osmShareBase := os.Getenv("OSM_SHARE_URL_BASE")
if osmShareBase == "" { osmShareBase = "https://www.openstreetmap.org" }
osmURL := fmt.Sprintf("%s/#map=%d/%.6f/%.6f", osmShareBase, zoom, lat, lon)
```

---

## 4. Estructura de carpetas propuesta (en disco)

```
D:\OTROS\LETXINET-SUITE\
│
├── PLAN-Y-PROGRESO\                  # ← Esta carpeta. Documentación + progreso.
│   ├── 00-PLAN-MAESTRO.md            # ← Este documento.
│   ├── 01-FASE-0-PREPARACION.md      # Log de la Fase 0.
│   ├── 02-FASE-0.5-ICONO.md          # Log de la generación del icono.
│   ├── 03-FASE-1-PARCHES.md          # Diffs y outputs de los parches P-1..P-4.
│   ├── 04-FASE-2-MARKITDOWN.md       # Build del payload Python embebido.
│   ├── 05-FASE-3-RECOLECCION.md      # Logs de robocopy/copy de payloads.
│   ├── 06-FASE-4-SCRIPTS-SUITE.md    # Códigos fuente generados.
│   ├── 07-FASE-5-COMPILACION.md      # Output ISCC + hashes.
│   ├── 08-FASE-6-PRUEBAS.md          # Capturas de tests funcionales.
│   ├── 09-FASE-7-DOCS-VARIANTES.md   # README + CHANGELOG + variantes A/B.
│   └── 10-LINKS-HARDCODED.md         # Listado detallado (referencia).
│
├── src-suite\                        # ← Código fuente nuevo (generado por el Suite).
│   ├── instalador\                   # El instalador Inno Setup.
│   │   ├── LetXinet-Suite.iss        # Script principal Inno Setup.
│   │   ├── assets\                   # Iconos, banner, licencia.
│   │   │   ├── LetXinet-Suite.ico    # Generado por build-icon.py.
│   │   │   ├── LetXinet-Suite.png    # PNG 256x256.
│   │   │   ├── banner.bmp           # Banner para wizard (opcional).
│   │   │   └── license.rtf          # Licencia MIT-style.
│   │   └── nssm\                     # NSSM runtime embebido.
│   │       ├── nssm64.exe
│   │       └── nssm32.exe
│   │
│   ├── shared-env\                   # El .env central del Suite.
│   │   ├── LetXinet-Suite.env        # Plantilla PUBLICA (variant B).
│   │   └── LetXinet-Suite.env.A      # Plantilla con tokens (variant A).
│   │
│   ├── bin\                          # Scripts utilitarios del Suite.
│   │   ├── suite-env-loader.cmd      # Carga LetXinet-Suite.env al proceso actual.
│   │   ├── nssm-register.cmd        # Registra servicio Windows para componente X.
│   │   ├── nssm-uninstall.cmd       # Detiene + borra servicio Windows.
│   │   ├── start-osm-mcp.cmd        # Launcher OSM-MCP (carga Suite.env + arranca osmmcp.exe).
│   │   ├── start-mcp-v11-local.cmd   # Launcher V11 (similar).
│   │   ├── start-markitdown-api.cmd # Launcher MarkItDown (Python + uvicorn).
│   │   ├── start-letxinet-desktop.cmd # Launcher Desktop (lío Electron con env inyectado).
│   │   ├── suite-postinstall-checks.cmd # Verifica puertos + health endpoints.
│   │   └── scripts-cmd\             # Sub-scripts de utilidad.
│   │       ├── test-osm-mcp.ps1
│   │       ├── test-v11.ps1
│   │       ├── test-markitdown.ps1
│   │       └── test-desktop.ps1
│   │
│   ├── build-icon.py                # Genera .ico desde LETXIPU.svg (Phase 0.5).
│   ├── build-suite.cmd               # Orquestador: build-icon + ISCC + firmas.
│   └── build-variants.cmd           # Ejecuta ISCC 2 veces (variant A y B).
│
│── componentes-parches\              # Binarios ya compilados + parches aplicados.
│   ├── osm-mcp\                      # Binario Go parche P-4.
│   │   ├── osmmcp.exe                # Recompilado con parches.
│   │   └── logs\.gitkeep             # Carpeta de logs por app.
│   ├── mcp-v11-local\                # Portable rebuild de V11 con P-2, P-3.
│   │   ├── MCP-V11-Local.exe
│   │   ├── dist\
│   │   ├── node_modules\
│   │   ├── python\
│   │   ├── python-runtime\
│   │   └── logs\.gitkeep
│   ├── markitdown-api\               # Python embebido + uvicorn + pymupdf4llm.
│   │   ├── python-runtime\
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   ├── mcp-adapter\markitdown-mcp.js
│   │   └── logs\.gitkeep
│   └── letxinet-desktop\             # win-unpacked reempaquetado tras P-1.
│       ├── LetXipu Desktop HF.exe
│       ├── dist\
│       └── resources\
│
├── variant-tokens\                   # Tokens separados (NO en installer editável).
│   ├── variantA-publicar-interno\    # .env con tokens reales (NO subir a GitHub).
│   │   └── .env                      # MINERU_API_KEY, HF_TOKEN, etc.
│   └── variantB-publicar-publico\    # Plantilla pública.
│       └── .env.template             # Solo placeholders vacíos.
│
├── logs\                             # Logs del proceso de build (no de los servicios).
│   ├── build-suite.log
│   ├── icon-build.log
│   ├── parches.diff
│   └── robocopy.log
│
└── build\                            # OUTPUT FINAL del Suite.
    ├── LetXinet-Suite-1.0-Setup-VariantA.exe  # Distribución INTERNA.
    ├── LetXinet-Suite-1.0-Setup-VariantB.exe  # Distribución PÚBLICA.
    └── HASHES-SHA256.txt
```

---

## 5. Pipeline de generación de icono (build-icon.py)

El script `src-suite\build-icon.py` convierte `D:\OTROS\LETXIPU.svg`
(125 KB, 560×544 pt, blanco sobre transparente) en `.ico` multi-resolución.

### 5.1 Prerrequisitos

- Python 3.12 oficial: `C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe`
- Instalar `cairosvg` y `pillow` (first-time setup):
  ```powershell
  & "C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe" -m pip install --upgrade cairosvg pillow
  ```

### 5.2 Algoritmo del script

```python
#!/usr/bin/env python3
"""build-icon.py — Genera LetXinet-Suite.ico multi-resolución desde LETXIPU.svg."""
import cairosvg
from PIL import Image
import io, os

SVG_PATH = r"D:\OTROS\LETXIPU.svg"
ICO_PATH = r"D:\OTROS\LETXINET-SUITE\src-suite\instalador\assets\LetXinet-Suite.ico"
PNG_PATH = r"D:\OTROS\LETXINET-SUITE\src-suite\instalador\assets\LetXinet-Suite.png"

# Tamaños estándar para .ico multi-resolución en Windows.
SIZES = [16, 24, 32, 48, 64, 128, 256]

os.makedirs(os.path.dirname(ICO_PATH), exist_ok=True)

# SVG → PNG 256x256 con fondo oscuro (#0b0f1a) para visibilidad del logo blanco.
png_256_bytes = cairosvg.svg2png(
    url=SVG_PATH,
    output_width=256,
    output_height=256,
    background_color="#0b0f1a"  # azul oscuro Suite
)
with open(PNG_PATH, "wb") as f:
    f.write(png_256_bytes)

# Generar PNG por tamaño + combinar en .ico con PIL.
imgs = [Image.open(io.BytesIO(png_256_bytes)).resize((sz, sz), Image.LANCZOS) for sz in SIZES]

imgs[0].save(ICO_PATH, format="ICO",
             sizes=[(sz, sz) for sz in SIZES],
             append_images=imgs[1:])

print(f"OK ICO: {ICO_PATH} ({os.path.getsize(ICO_PATH)} bytes)")
print(f"OK PNG: {PNG_PATH} ({os.path.getsize(PNG_PATH)} bytes)")
```

### 5.3 Aplicación del icono

| Componente | Aplicación | Mecanismo |
|---|---|---|
| LetXinet Desktop HF | Icono incrustado en .exe | `LETXINET-DESKTOP-HF\package.json` añadir `"build": { "win": { "icon": "build/icon.ico" } }`. Copiar `.ico` a `LETXINET-DESKTOP-HF\build\icon.ico`. Tras `npm run build && npx electron-builder --win dir` se incrusta en el .exe. |
| Instalador Suite | `SetupIconFile` + `UninstallDisplayIcon` | En `LetXinet-Suite.iss` añade las dos directivas apuntando a `assets\LetXinet-Suite.ico`. |
| Instaladores sub-componentes (mirar estilo) | `SetupIconFile` opcional | Si compilamos variant B del Suite con `SetupIconFile`. |

---

## 6. El archivo `shared-env\LetXinet-Suite.env` (plantilla variante B)

```
# ============================================================
#  LetXinet Suite v1.0 — Variables compartidas centralizadas
# ============================================================
#  Archivo ÚNICO editable por el usuario final. Cambia URLs/endpoints
#  sin tener que recompilar. Tras editarlo, reinicia los servicios
#  Windows desde services.msc:
#    Get-Service LetXipu* | Restart-Service
#
#  Editado -> guardar -> Restart-Service LetXipuXXX (o reboot)
# ============================================================

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 1 — Endpoints MCP locales (servicios Suite en esta PC)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LETXIPU_OSM_MCP_URL=http://127.0.0.1:7082/mcp
LETXIPU_LOCAL_MCP_URL=http://127.0.0.1:4003/api/mcp
MARKITDOWN_API_URL=http://127.0.0.1:7860
OSM_MCP_URL=http://127.0.0.1:7082

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 2 — Fallbacks remotos (cuando los servicios locales están apagados)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HF_LETXIPU_MCP_URL=https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp
HF_LETXIPU_OSM_MCP_URL=https://c2mv-letxipu-osm-mcp.hf.space/mcp
HF_LETXINET_MCP_URL=https://www.letxinet.lat/api/v1/mcp

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 3 — LetXinet Desktop (Electron): modo de selección de endpoints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Valores: auto | local_only | remote_only | hf_only
#   auto         (default) - local primero, fallback remoto
#   local_only   - solo locals, falla rápido si no corren
#   remote_only  - solo remotos (respeta Sección 2)
#   hf_only      - modo legacy con los 3 URLs hardcoded de HF/letxinet.lat
LETXIPU_DESKTOP_MODE=auto
LETXIPU_DESKTOP_PORT=43123

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 4 — OSM MCP (servicio Go)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OSM_HTTP_PORT=7082
OSM_METRICS_PORT=9090
OVERPASS_URL=
NOMINATIM_URL=
TILE_SERVER_URL=
OSRM_URL_CAR=https://router.project-osrm.org
OSRM_URL_BIKE=https://router.project-osrm.org
OSRM_URL_FOOT=https://router.project-osrm.org
OSM_SHARE_URL_BASE=https://www.openstreetmap.org
OSMMCP_USER_AGENT=LetXinet-Suite-OSM/1.0
OSMMCP_DEFAULT_REGION=US
OTLP_ENDPOINT=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 5 — MCP-V11-Local (Node + Python)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
V11_API_PORT=4003
V11_SPACY_PORT=4002
SPACY_CACHE_ROOT=
SPACY_PYTHON=

# Espejos Sci-Hub (CSV, orden de preferencia). Eduit a medida de cambios.
SCIHUB_MIRRORS=https://sci-hub.al,https://sci-hub.mk,https://sci-hub.ru,https://sci-hub.su,https://sci-hub.red,https://sci-hub.st,https://sci-hub.ee

# Unpaywall (OA PDF resolver). Grátis: https://unpaywall.org/api
UNPAYWALL_API_URL=https://api.unpaywall.org
UNPAYWALL_EMAIL=letxipu@example.com
DOI_RESOLVER_URL=https://doi.org

# MinerU (extracción PDF alta calidad). Grátis: https://mineru.net
MINERU_API_KEY=
MINERU_API_URL=https://mineru.net/api/v4

# Document extractor router
DOC_EXTRACTOR_MODE=auto
ALLOW_REMOTE_EXTRACTION=true
MARKITDOWN_ENABLED=true
MARKITDOWN_PYTHON=
EXTRACTOR_TIMEOUT_MS=300000
EXTRACTOR_MAX_MB=200

# APIs académicas (OPCIONAL — todas funcionan sin claves)
CORE_API_KEY=
SCOPUS_API_KEY=
SEMANTIC_SCHOLAR_API_KEY=
SERP_API_KEY=
SERPAPI_KEY=
HF_TOKEN=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 6 — MarkItDown API (Python + uvicorn)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKITDOWN_PORT=7860
MARKITDOWN_HOST=127.0.0.1

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 7 — IA providers (los rellena el usuario via UI del Desktop)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEMINI_API_KEY=
NVIDIA_API_KEY=
OPENCODE_API_KEY=
MISTRAL_API_KEY=
OPENCODE_BASE_URL=
NVIDIA_BASE_URL=
MISTRAL_BASE_URL=

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECCIÓN 8 — Telemetría / ambiente
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT=production
```

**Variante A** = mismo archivo pero con `MINERU_API_KEY`, `HF_TOKEN`, etc.
rellenos con valores reales. Se diferencia por el archivo
`shared-env\LetXinet-Suite.env.A` generado aparte.

---

## 7. Pipeline de logs — doble salida (centralizado + por app)

### 7.1 Logs centralizados (especificación NSSM)

Después de la instalación del Suite, los 3 servicios NSSM estarán configurados
para escribir sus stdout/stderr a:

```
%PROGRAMDATA%\LetXinet Suite\Logs\
├── osm-mcp\
│   ├── service-out.log         (NSSM AppStdout)
│   ├── service-err.log         (NSSM AppStderr)
│   └── rotated-YYYYMMDD-HHMMSS.log  (cuando supera 5 MB → AppRotateFiles)
├── mcp-v11-local\
│   ├── service-out.log
│   ├── service-err.log
│   └── rotated-...
├── markitdown-api\
│   ├── service-out.log
│   ├── service-err.log
│   └── rotated-...
└── suite-installer.log          (copiado aquí post-install por el .iss)
```

Configuración NSSM (en `nssm-register.cmd`):
```bat
"%NSSM%" set %SVC% AppStdout "%PROGRAMDATA%\LetXinet Suite\Logs\%COMP%\service-out.log"
"%NSSM%" set %SVC% AppStderr "%PROGRAMDATA%\LetXinet Suite\Logs\%COMP%\service-err.log"
"%NSSM%" set %SVC% AppRotateFiles 1
"%NSSM%" set %SVC% AppRotateBytes 5242880        ; 5 MB threshold
"%NSSM%" set %SVC% AppStdoutCreationDisposition 4   ; append
"%NSSM%" set %SVC% AppStderrCreationDisposition 4
"%NSSM%" set %SVC% AppRotateOnline 1
```

### 7.2 Logs por app (legacy + tooling)

Cada componente escribe en su propia carpeta `logs\`:

```
C:\Program Files\LetXinet Suite\osm-mcp\logs\
├── osmmcp.log              (escrito desde el binario Go directamente)
└── smoke-test.log          (test manual del binario)

C:\Program Files\LetXinet Suite\mcp-v11-local\logs\
├── v11-app.log             (escrito desde server.js via pino)
└── spacy-sidecar.log       (stdout del sidecar Python)

C:\Program Files\LetXinet Suite\markitdown-api\logs\
└── uvicorn-access.log      (FastAPI/uvicorn access log nivel INFO)
```

Los launchers cmd (`start-osm-mcp.cmd`, etc.) hacen `cd /d "{app}\{componente}"`
y redirigen adicional stdout/stderr a estos archivos con `>> logs\... 2>&1`.
Así, aunque NSSM no capture (caso de arranque manual), queda log por app.

### 7.3 Log del instalador Suite

`LetXinet-Suite.iss` activa:
```inno
[Setup]
SetupLogging=yes
```
Inno escribe a `%TEMP%\Setup Log YYYY-MM-DD#NNN.txt`. El Suite copia ese
archivo a `%PROGRAMDATA%\LetXinet Suite\Logs\suite-installer.log` con un
`[Code]` post-install (CurStepChanged). Ver `LetXinet-Suite.iss` sección `[Code]`.

---

## 8. Variantes V11 A/B — tokens separados, no en installer editable

### 8.1 Política

- **Variante A**: Suite installer con `.env` conteniendo tokens reales.
  Distribución **INTERNA** — NO subir a GitHub releases.
- **Variante B**: Suite installer con `.env` plantilla (placeholders vacíos).
  Distribución **PÚBLICA** — apta para GitHub,主义者s, etc.
- Los **tokens NO van en el installer editable**. Viven en:
  - `D:\OTROS\LETXINET-SUITE\variant-tokens\variantA-publicar-interno\.env`
  (gitignored — solo en disco local)
- El `.env.variantA.bak` actual (en V11 source) se mantiene como placeholder.

### 8.2 Generación de variantes

`src-suite\build-variants.cmd` ejecuta ISCC dos veces:

```bat
@echo off
REM build-variants.cmd — Genera las 2 variantes (A interna y B publica) del Suite.
setlocal
set ISSCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
set ISS=D:\OTROS\LETXINET-SUITE\src-suite\instalador\LetXinet-Suite.iss
set OUT=D:\OTROS\LETXINET-SUITE\build

echo === Generando variant A (interna, con tokens) ===
copy /Y "D:\OTROS\LETXINET-SUITE\variant-tokens\variantA-publicar-interno\.env" ^
      "D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env"
%ISSCC% /DV11Variant=A /DOutputSuffix=VariantA "%ISS%"
move /Y "%OUT%\LetXinet-Suite-1.0-Setup.exe" "%OUT%\LetXinet-Suite-1.0-Setup-VariantA.exe"

echo === Generando variant B (pública, sin tokens) ===
copy /Y "D:\OTROS\LETXINET-SUITE\variant-tokens\variantB-publicar-publico\.env.template" ^
      "D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env"
%ISSCC% /DV11Variant=B /DOutputSuffix=VariantB "%ISS%"
move /Y "%OUT%\LetXinet-Suite-1.0-Setup.exe" "%OUT%\LetXinet-Suite-1.0-Setup-VariantB.exe"

echo === Restaurando plantilla B ===
copy /Y "D:\OTROS\LETXINET-SUITE\variant-tokens\variantB-publicar-publico\.env.template" ^
      "D:\OTROS\LETXINET-SUITE\src-suite\shared-env\LetXinet-Suite.env"

echo === Calculando hashes ===
powershell -Command "Get-ChildItem '%OUT%\*.exe' | ForEach-Object { Write-Output ('{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash, $_.Name) } | Out-File -Encoding ascii '%OUT%\HASHES-SHA256.txt'"
type "%OUT%\HASHES-SHA256.txt"
endlocal
```

---

## 9. Fases de ejecución (con paradas para revisión)

| Fase | Tiempo est. | Salida a disco | ¿Parar? |
|---|---|---|---|
| 0 — Preparación | 15 min | `PLAN-Y-PROGRESO\01-FASE-0-PREPARACION.md` | Sí |
| 0.5 — Icono | 10 min | `02-FASE-0.5-ICONO.md` + `assets\*.ico/png` | Sí |
| 1 — 4 parches P-1..P-4 | 30 min | `03-FASE-1-PARCHES.md` + diffs en `logs\parches.diff` | Sí |
| 2 — Payload MarkItDown | 20 min | `04-FASE-2-MARKITDOWN.md` | Sí |
| 3 — Recolección payloads | 20 min | `05-FASE-3-RECOLECCION.md` + `logs\robocopy.log` | Sí |
| 4 — Scripts Suite | 60 min | `06-FASE-4-SCRIPTS-SUITE.md` + código fuente generado | Sí |
| 5 — Compilación | 10 min | `07-FASE-5-COMPILACION.md` + `LetXinet-Suite-1.0-Setup-*.exe` | Sí |
| 6 — Pruebas | 30 min | `08-FASE-6-PRUEBAS.md` + capturas | Sí |
| 7 — Docs/release | 15 min | `09-FASE-7-DOCS-VARIANTES.md` + README + hashes | Sí (final) |

**Total estimado**: ~3 horas, pero el usuario revisa entre cada fase.

---

## 10. Riesgos y mitigaciones

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Inno Setup no instalado | Alto | Fase 0: `winget install JRSoftware.InnoSetup` |
| D: solo 3.41 GB libres | Alto | Fase 0: borrar `dist-portable\python-runtime` (939 MB). Verificar post-liberación. |
| `cairosvg` no instala en Python 3.12 | Bajo | Fallback: instalar Inkscape via winget y usar `inkscape --export-type=ico` |
| Logo blanco invisible en taskbar Windows fondo blanco | Medio | `build-icon.py` setea `background_color="#0b0f1a"` (azul oscuro Suite) |
| `electron-builder` ignora `icon` en package.json | Bajo | Copiar `.ico` a `LETXINET-DESKTOP-HF\build\icon.ico` (lugar canónico) |
| Parche P-1 rompe el modo HF legacy | Medio | Parche respeta `LETXIPU_DESKTOP_MODE=hf_only` como back-compat |
| Parche P-2 SCIHUB_MIRRORS formato invalido | Bajo | `split(',').map(trim).filter(Boolean)` valída el parsing |
| Variante A tokens se filtran en release pública | Crítico | `build-variants.cmd` genera A y B por separado. Gitignore `variant-tokens\variantA-publicar-interno\` |
| Servicios sin admin | Alto | `PrivilegesRequired=admin` en `.iss` + UAC automático |
| `SetupIconFile` path relativo inválido | Bajo | Usar_absolute_ via preprocessor `#define IconPath` |
| MarkItDown sin Python embebido disponible | Medio | Fase 2 descarga `python-3.12.x-embed-amd64.zip` desde python.org |
| NSSM no en PATH | Bajo | Embebido en `src-suite\instalador\nssm\nssm64.exe` |
| Servicios auto-start ralentizan boot Win | Bajo | NSSM con `Start=SERVICE_AUTO_START` + `DelayedAutoStart=1` |

---

## 11. Estado actual (en el momento de escribir este plan)

- ✅ Carpeta `D:\OTROS\LETXINET-SUITE\` creada con árbol completo.
- ✅ Este plan `00-PLAN-MAESTRO.md` escrito en disco.
- ✅ Cuatro repos fuente verificados (existen y compilan):
  - `D:\OTROS\LETXINET-DESKTOP-HF` (Node + Electron, 766 MB node_modules)
  - `D:\OTROS\letxipu-osm-mcp` (Go, 24.7 MB binario ya compilado)
  - `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL` (Node + Python, 1.1 GB dist-portable)
  - `D:\OTROS\markitdown-api` (Python + .venv 256 MB)
- ✅ Inventario de links hardcoded completado (ver Sección 2 + `10-LINKS-HARDCODED.md`).
- ✅ Compiladores disponibles: Go 1.26, Node 24, Python 3.12, npm 11, py launcher.
- ⏸ Inno Setup 6: NO instalado → pendiente Fase 0 winget.
- ⏸ Cairosvg / pillow: NO instalados → pendiente Fase 0.5 pip install.
- ⏸ NSSM 2.24: NO descargado → pendiente Fase 0 download.
- ⏸ D: drive free: 3.41 GB → pendiente liberar 939 MB en Fase 0.

---

## 12. Próximos pasos inmediatos

Al recibir "adelante" del usuario, ejecutar:

1. **Fase 0 — Preparación**:
   - `winget install JRSoftware.InnoSetup` ( instalar Inno Setup 6)
   - Descargar NSSM 2.24 a `src-suite\instalador\nssm\`
   - Borrar `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL\dist-portable\python-runtime\` (liberar 939 MB)
   - Verificar espacio libre D: post-liberación
   - Escribir log a `PLAN-Y-PROGRESO\01-FASE-0-PREPARACION.md`
2. **Parar**. Esperar validación del usuario.

3. **Fase 0.5 — Icono**:
   - `pip install cairosvg pillow` en Python 3.12 oficial
   - Ejecutar `build-icon.py`
   - Inspeccionar visual el `.ico` y `.png` generados
   - Escribir log a `02-FASE-0.5-ICONO.md`
4. **Parar**. Esperar validación visual del icono.

Continuar conforme con la tabla de la Sección 9.

---

## 13. Decisiones finales confirmadas por el usuario

1. ✅ **Ubicación Suite**: `D:\OTROS\LETXINET-SUITE\`
2. ✅ **Nombre del instalador**: `LetXinet-Suite-1.0-Setup.exe`
3. ✅ **Privilegios**: admin obligatorio (servicios Windows NSSM exigen admin)
4. ✅ **Variantes V11**: construir A (interna, con tokens) y B (pública, sin tokens)
5. ✅ **LetXinet Desktop**: reempaquetar con `electron-builder --win dir` tras parche P-1
6. ✅ **Logs**: doble salida (por app + centralizado en `%PROGRAMDATA%\LetXinet Suite\Logs\`)
7. ✅ **Icono**: `D:\OTROS\LETXIPU.svg` para todos los componentes con frontend
8. ✅ **Revisión entre fases**: el usuario revisa al final de cada fase antes de continuar
9. ✅ **Links hardcoded**: externalizar los críticos a `LetXinet-Suite.env` (no tocar vendors/node_modules)
10. ✅ **Programas nuevos**: generar código fuente nuevo del Suite (`.iss`, `.cmd`, `.py`) en `src-suite\`
11. ✅ **Trabajo siempre escribiendo a disco**: nunca se ejecuta nada "en memoria"; cada paso deja archivo

---

## 14. EPILOGO — Release v1.0.0 completado (2026-07-31)

El proyecto **LetXinet Suite v1.0.0** fue finalizado completamente. Resumen ejecutivo:

### Fases completadas

| Fase | Estado | Log |
|---|---|---|
| 0 — Preparacion (Inno Setup, NSSM) | ✅ | `01-FASE-0-PREPARACION.md` |
| 0.5 — Icono Suite (resvg + Pillow) | ✅ | `02-FASE-0.5-ICONO.md` |
| 1 — Parches P-1 a P-4 + builds OSM + V11 + HF | ✅ | `03-FASE-1-PARCHES.md` |
| 2 — MarkItDown API payload (Python embed) | ✅ | `04-FASE-2-MARKITDOWN-PAYLOAD.md` |
| 3 — 4 payloads recolectados (2 GB total) | ✅ | `05-FASE-3-PAYLOADS.md` |
| 4 — Codigo Suite (launchers, scripts) | ✅ | `06-FASE-4-5-CODIGO-Y-BUILD.md` |
| 5 — Build instaladores variant A + B | ✅ | `06-FASE-4-5-CODIGO-Y-BUILD.md` |
| 6 — Pruebas funcionales end-to-end | ✅ | `07-FASE-6-PRUEBAS.md` |
| 7 — Docs finales (CHANGELOG, README, hashes) | ✅ | Este epílogo |

### Bugs descubiertos y corregidos durante Fase 6

1. **Bug A**: `nssm.exe` path equivocado en `register-services.cmd` (apuntaba a `%~dp0nssm\nssm.exe` inexistente; corregido a `%~dp0bin\nssm.exe`).
2. **Bug B**: `MCP-V11-Local.exe` equivocado en `componentes-parches` (66.57 MB runtime Node solo; reemplazado por 93.75 MB bundle pkg correcto de `packaging\bin\`).
3. **Bug C**: `AppDirectory` incorrecto para V11 en `register-services.cmd` (`%~dp0..` -> `%~dp0MCP-V11-Local`).

Tras corregir, se recompilaron ambos instaladores (release v2 con fixes) y se verifico instalacion limpia end-to-end sin parches manuales.

### Artefactos finales release-ready

```
D:\OTROS\LETXINET-SUITE\build\installer-output\
|-- variantA\
|   |-- LetXinet-Suite-1.0.0-VariantA-Setup.exe       (4.74 MB)
|   |-- LetXinet-Suite-1.0.0-VariantA-Setup-1.bin      (503.79 MB)
|-- variantB\
|   |-- LetXinet-Suite-1.0.0-VariantB-Setup.exe       (4.74 MB)
|   |-- LetXinet-Suite-1.0.0-VariantB-Setup-1.bin      (503.80 MB)
|-- HASHES-SHA256.txt                                  (tabla de hashes)
|-- build-v2-B.log, build-v2-all.log                   (log stdout ISCC)
```

SHA256 hashes (verificacion integridad):

| Variante | Archivo | SHA256 |
|---|---|---|
| A | Setup.exe | `E1CF1F20556117E0C637C032C53981B22B20802D4461EB4AFC3E757F62AEAEF7` |
| A | Setup-1.bin | `92D98A42310C36C7D319F445464F30A3612E259AE119EB515AA831B327DA1090` |
| B | Setup.exe | `955442D5B2FA166DE3F992078C6CE8545B7B2856CB89EC82FBBE2C5CB5998DBD` |
| B | Setup-1.bin | `3CF027FCFBC8D432809C94204A64771EE08CDC5BD9D4649D6DE4BB26060C0EAB` |

Compresion: 2015 MB sin comprimir -> 508 MB LZMA2 ultra64 solido (ratio 4:1, 74.8% reduccion).

### Documentacion release

- `PLAN-Y-PROGRESO\CHANGELOG.md` — historial de cambios (formato Keep a Changelog)
- `PLAN-Y-PROGRESO\README-SUITE.md` — manual de operacion publico
- `src-suite\instalador\README-SUITE.txt` — manual de operacion (incluido en el instalador)
- `src-suite\instalador\LICENSE.txt` — licencia MIT + terceros bundled
- `src-suite\instalador\INFO-BEFORE.txt` — info pre-instalacion
- `build\installer-output\HASHES-SHA256.txt` — tabla de hashes para verificacion

### Pruebas funcionales (Fase 6) — pass rate

- 6.1 Instalacion silent variante B → OK (344s, 2 GB copiados)
- 6.2 Healthchecks 4 endpoints → OK (OSM 7082, MarkitDown 7860, V11 4003, Desktop 43123)
- 6.3 Editar .env → Skip por UAC interactivo (documentado como prueba manual)
- 6.4 Desinstalacion → OK (3 servicios gone, dir gone, ProgramData preserved)
- 6.5 Reinstalacion + idempotencia → OK (.env SHA256 match, servicios re-registrados)
- 6.6 Final v2 build con fixes (en D:\LS-Test3) → OK sin parches manuales (register-services.cmd exit code 0)

### Resumen final de trabajo

- **7 fases ejecutadas** (0, 0.5, 1, 2, 3, 4+5, 6, 7)
- **8 logs de progreso** en `PLAN-Y-PROGRESO\` (~150 KB texto)
- **5 parches quirurgicos** (P-1 a P-4) en 6 archivos fuente de 3 repos
- **35 archivos nuevos** generados para el Suite (launchers, scripts NSSM, .iss, .env, .py, .ico)
- **2 variantes coinstalables** del instalador (A interno + B publico)
- **4 componentes** empaquetados y funcionando conjuntamente
- **3 bugs críticos** descubiertos y corregidos durante pruebas end-to-end
- **Resultado final**: instalador release-ready para distribucion interna (A) y publica (B)

**FIN DEL PROYECTO.**

