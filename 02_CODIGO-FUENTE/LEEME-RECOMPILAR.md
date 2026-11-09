# Código fuente de LetXinet Suite 1.1.4 (recompilación del 08/11/2026)

Este es el código con el que se compiló el instalador de `01_INSTALADORES`. No contiene claves.

**Cambios de la 1.1.4** (arreglan lo que falló al instalar en otra laptop):
- `runtime-extra\msvcp140.dll` (nuevo): `recompilar-todo.ps1` lo copia dentro de los dos Python embebidos (MarkItDown y MCP-V11-Local). PyMuPDF lo necesita y el Python embebido solo trae `vcruntime140.dll`. En una laptop sin Visual C++, MarkItDown se reiniciaba sin parar: el servicio figuraba «Running», pero nunca abría el puerto 7860.
- `desktop-hf\electron\main.cjs`:
  - espera hasta 10 minutos a su backend (antes eran 2), y se puede cambiar con `LETXIPU_BACKEND_TIMEOUT_MS`. En laptops lentas, o en el primer arranque mientras el antivirus revisa los archivos, salía «The desktop backend did not start in time»;
  - muestra una ventana de «Iniciando LetXinet Desktop...» mientras tanto;
  - si aun así no arranca, explica en español qué registros revisar;
  - la comprobación de un backend ya activo nunca funcionaba, porque tenía sintaxis de TypeScript (`new Promise<boolean>`) en un `.cjs`.
- `instalador\instalador\bin\pruebas\probar-letxinet.ps1`:
  - comprueba que esté `msvcp140.dll` y cuánto espera el Desktop;
  - si MarkItDown no responde, ya no prueba la conversión ni muestra «No se puede llamar a un método en una expresión con valor NULL»;
  - si Claude Code no está instalado, lo marca como aviso y no como falla.
- `recompilar-todo.ps1`: en una recompilación con el árbol ya armado, pide 1 GB libre (no 4) y comprueba que `msvcp140.dll` esté en el payload.
- Versión 1.1.4 en el `.iss`, el `.env`, los puentes, el configurador y `actualizar-config.ps1`.

En una laptop que ya tiene la 1.1.3, basta con correr `04_SCRIPTS-MANTENIMIENTO\arreglo-1.1.3\arreglar-letxinet.cmd` o instalar la 1.1.4 encima.

**Cambios de la 1.1.3 en el código** (todos en `mcp-v11-local\src`, salvo los dos últimos):
- `utils\url-segura.ts` (nuevo): bloquea las URL internas antes de descargar. La IP se normaliza (`0x7f000001` pasa a `127.0.0.1`), se resuelve el DNS y se valida cada redirección. Lo usan `providers\pdf-processor.ts`, `providers\extraction-router.ts`, `providers\pdf-resolver.ts` y el despachador de `routes\mcp.ts`, que revisa `source`, `url`, `identifier` y `sources` de cualquier herramienta.
- `providers\base.ts` y `utils\inter-process-provider-limiter.ts`:
  - el plazo de `fetchWithTimeout` cubre la espera en las colas y la lectura del cuerpo;
  - la cola por dominio es un semáforo real. Esto era lo que atascaba V11.
- `routes\mcp.ts`:
  - `convert_document` usa MinerU solo si responde y, si no, descarga el PDF;
  - `recover_metadata` tiene un tope de 90 s;
  - las descripciones ya no mencionan Sci-Hub.
- `routes\metadata.ts`: `fetch_metadata` usa Crossref cuando OpenAlex no responde y da un error claro si el DOI no existe.
- `utils\pertinencia-repositorios.ts` (nuevo), `routes\search.ts` y `providers\latam-repositories.ts`:
  - filtro de pertinencia para RENATI, ALICIA y La Referencia;
  - un reintento que conserva las palabras del tema;
  - textos con la codificación corregida.
- `routes\pdf.ts` y `providers\pdf-resolver.ts`:
  - Sci-Hub y WeLib están desactivados por defecto;
  - `resolve_pdf` abre las páginas de los repositorios y explica por qué no obtiene el PDF.
- `providers\mineru-client.ts`: `extract_tables` reconoce las tablas en Markdown.
- `instalador\instalador\bin\actualizar-config.ps1`: vacía `SCIHUB_MIRRORS` si tiene la lista de fábrica y pasa el User-Agent a 1.1.3.
- `instalador\instalador\bin\configurar-clientes.cjs` y `bin\mcp\letxinet-jobs-bridge.cjs`: rechaza modos inválidos, reconoce `D:\OTROS` con barras invertidas y corrige las descripciones.

**Cambios de la 1.1.2 en el código:**
- `desktop-hf\server.ts`:
  - el filtro `server=` del gateway acepta `v11`, `osm` y `juntos`;
  - el gateway escucha solo en `127.0.0.1` (se cambia con `LETXINET_BIND_HOST`).
- `mcp-v11-local\src\server.ts`: escucha en `127.0.0.1`, salvo en Hugging Face Spaces.
- `osm-mcp\pkg\osm\overpass_fallback.go`: servidores espejo de Overpass, configurables con `OVERPASS_FALLBACK_URLS`.
- `instalador\instalador`:
  - Node.js LTS en `prerequisitos\`;
  - puentes MCP en `bin\mcp\`;
  - configurador de clientes en `bin\configurar-clientes.cjs`;
  - `bin\actualizar-config.ps1`;
  - harness en `bin\pruebas\`;
  - página de contacto OSM y accesos nuevos en el `.iss`.

| Carpeta | Componente | Se compila con |
|---|---|---|
| `mcp-v11-local` | Búsqueda académica y PDF (TypeScript) | `tsc` y `yao-pkg` |
| `desktop-hf` | App de escritorio y gateway (React y Node) | `vite` y `esbuild` |
| `osm-mcp` | Mapas y rutas (Go, con `vendor`) | `go build` |
| `markitdown-api` | Conversión de PDF a Markdown (Python) | no se compila |
| `runtime-extra` | `msvcp140.dll` de Visual C++ para los dos Python | no se compila |
| `instalador` | Script de Inno Setup, launchers y `.env` sin claves | Inno Setup 6 |
| `fuentes-addon-bridges-v1.0.0-SIN-CLAVES.zip` | Addon Bridges (sin cambios) | ver `07_DOCUMENTACION-ORIGINAL` |

## Recompilar todo

**Requisitos:**
- LetXinet Suite instalada.
- Node.js 22 o superior, Go 1.24 o superior e Inno Setup 6.3 o superior.
- Internet para `npm ci`, que descarga unos 900 MB.
- Unos 6 GB libres la primera vez, o 1 GB si se recompila sobre un árbol ya armado.

El binario base de Node para empaquetar V11 viene en `herramientas\pkg-cache` dentro del paquete zip, así que no hace falta descargarlo de GitHub. En el repositorio de GitHub no se incluye: yao-pkg lo descarga solo. Tampoco se incluyen `runtime-extra\msvcp140.dll` ni `instalador\instalador\prerequisitos\node-v22.23.4-x64.msi`; el `README.md` de la raíz explica cómo conseguirlos.

Haz doble clic en `recompilar-todo.cmd`. Tarda de 30 a 40 minutos y deja el instalador en `C:\LetXinet-Recompilado\installer-output\variantB`. Para usar otra carpeta, pasa `-Trabajo D:\otra\ruta`, pero evita las carpetas sincronizadas con OneDrive.

Si una ejecución se corta, vuelve a lanzarla: el script completa lo que faltó.

El script hace lo siguiente:
1. Toma de la Suite instalada los runtimes que no son código (Electron, `node_modules`, Python), sin claves, logs ni respaldos.
2. Compila V11, incluido su `.exe`, además de Desktop y OSM, y copia MarkItDown.
3. Comprueba que no queden claves. Si encuentra alguna, se detiene.
4. Genera el instalador Variante B y sus hashes SHA-256.

Para compilar sin generar el instalador, usa `recompilar-todo.cmd -SinInstalador`.

## Lo que hay que saber si modificas algo

- **V11 ejecuta el código que lleva dentro el `.exe`, no la carpeta `dist`.** Editar `dist` en una instalación no cambia nada: hay que modificar `src` y volver a generar el `.exe`. El script ya lo hace.
- **Variante A:** este paquete solo genera la Variante B. La A llevaba claves y no se incluye.
- **Claves:** van en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` y en la pantalla de configuración del Desktop, nunca en el código. En `desktop-hf\server.ts` se quitó una clave que estaba escrita en 7 lugares.
