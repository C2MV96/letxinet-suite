# Reporte completo — LetXinet Suite: configuración, pruebas, correcciones y empaquetado

**Periodo:** 01–02/11/2026 · **Equipo:** DESKTOP-TUI78FL (Windows 10 Pro) · **Asistente:** Claude Code (desktop)
**Versión vigente:** LetXinet Suite **1.1.0** (regenerada el 07/08/2026, sesión 7) + LetXinet Addon Bridges **1.0.0**. Las dos están instaladas en esta PC desde el 13/08/2026.

---

## 1. Resumen ejecutivo

| Tema | Resultado |
|---|---|
| Integración con Claude Code | ✅ 4 servidores MCP conectados (V11, OSM, MarkItDown y el puente de tareas largas) |
| Pruebas de herramientas | 58 herramientas y 95 llamadas: 26 ✅, 16 ⚠️ y 16 ❌. Informe en `06_INFORMES-Y-PRUEBAS` |
| Falla crítica (spaCy) | Identificada la causa y aplicado un interruptor reversible: spaCy queda desactivado. Con eso `smart_search` y `filterFalsePositives` vuelven a funcionar |
| Timeouts | Corregidos con el puente `letxinet-jobs`, que corre las tareas en segundo plano, y con `MCP_TOOL_TIMEOUT=300000` |
| Logs | De 877 MB a 5,7 MB (respaldo de 13 MB en `C:\Users\USER\LetXinet-archivo`) |
| Repositorios peruanos | No todos son accesibles: RENATI y La Referencia Perú funcionan; el conector de ALICIA falla por timeout y el repositorio de la UNT no respondía |
| Seguridad | ⚠️ **Hay una clave de Mistral escrita en el código** (`server.ts` → `server.cjs`, que va en las dos variantes del instalador) y la Variante A trae `secrets.json`. Ver §7 |
| Paquete para otra laptop | Esta carpeta, más el zip y la carpeta `PRIVADO_NO_COMPARTIR` |

---

## 2. Arquitectura instalada (para entender todo lo demás)

| Componente | Proceso | Puerto | Servicio Windows (NSSM) |
|---|---|---|---|
| MCP-V11-Local (búsqueda académica y PDF; 28 herramientas, 39 fuentes) | `MCP-V11-Local.exe` (Node 22 empaquetado con pkg) | **4003** (`/api/mcp`) | `LetXinetSuiteMCPV11` (inicio diferido) |
| Sidecar spaCy de V11 | `python.exe` (runtime embebido) | 4002 (solo local) | lo arranca V11 |
| OSM-MCP (mapas y rutas; 28 herramientas) | `osmmcp.exe` (Go) | **7082** (`/mcp`), métricas en 9090 | `LetXinetSuiteOSMMCP` |
| MarkItDown API (conversión PDF → Markdown) | `python` + uvicorn | **7860** (solo local) | `LetXinetSuiteMarkitDown` |
| LetXinet Desktop HF (Electron + gateway) | `LetXipu Desktop HF.exe` | **43123** | no (app de escritorio) |

- Instalación: `C:\Program Files\LetXinet Suite\` · configuración central: `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` · logs: `C:\ProgramData\LetXinet Suite\Logs\`
- Addon: `C:\Program Files\LetXinet Addon\` (mcp-bridge, omni-word-mcp, latex-mcp-local)

---

## 3. Cronología de lo que se hizo

### 3.1 Configuración de LetXinet en Claude Code (01/11)
1. Se revisó `C:\Program Files\LetXinet Suite\bin` y los launchers. Los servicios estaban activos y V11 y OSM respondían por HTTP MCP (Streamable HTTP).
2. Se añadieron a `~/.claude.json` (alcance de usuario), con respaldo en `~/.claude.json.bak-letxinet`:
   - `letxinet-v11` → `http://127.0.0.1:4003/api/mcp`
   - `letxinet-osm` → `http://127.0.0.1:7082/mcp`
   - `letxinet-markitdown` → `node …/MarkItDown/API/mcp-adapter/markitdown-mcp.js`
3. `claude mcp list` mostró los 3 conectados. Claude Desktop ya usaba `letxinet-gateway` (el Addon, por el puerto 43123) y `markitdown-api`, así que en la pestaña Code hay herramientas duplicadas con otro prefijo.

### 3.2 Diagnóstico de estado y logs (01/11, 13:56)
- **Funcionaban:** V11 (health 170 ms, 0 circuitos abiertos), MarkItDown y el gateway Desktop HF v12.
- **OSM, degradado:** Nominatim OK; **OSRM y Overpass caídos**. Son servicios externos.
- **Logs:** **877 MB** (181 logs rotados de V11), con 28 copias `LetXinet-Suite.env.backup-*`, algunas «backup-keys» con claves.
- **V11:** **450 errores `EADDRINUSE :4003`**, porque arranca dos veces (NSSM y la app).
- **Sidecar spaCy:** errores 500 en `/concept_match`.
- **Puertos expuestos a la red:** 4003, 43123 y 9090 escuchan en `0.0.0.0`.

### 3.3 Limpieza de logs
- Se comprimió todo en `C:\Users\USER\LetXinet-archivo\logs-rotados-2026-11-01.zip` (13 MB) y `env-backups-2026-11-01.zip`, comprobando que estuvieran completos.
- El borrado de los originales pedía permisos de administrador, porque los creó SYSTEM. Se hizo con `limpiar-logs-letxinet.cmd`, que se eleva solo. **Resultado: 5,7 MB.**

### 3.4 Pruebas completas de las 58 herramientas (3 subagentes, 95 llamadas)
| Grupo | ✅ | ⚠️ | ❌ |
|---|---|---|---|
| V11 búsqueda y metadatos (14) | 6 | 4 | 4 |
| V11 PDF y MarkItDown (16) | 7 | 7 | 2 |
| OSM (28) | 13 | 5 | 10 (todas por Overpass caído) |

**Hallazgos clave:**
- `enrich_metadata` **inventa abstracts** para referencias falsas.
- `download_pdf` no guarda el archivo.
- Ninguna herramienta de conversión acepta `.docx`.
- `health_check` y `coverage_report` dan falsos «ok».
- `search_dblp` y `search_paperswithcode` no sirven.
- `geocode_address` descarta resultados válidos.
- El chequeo de OSRM da un falso negativo.

Detalle en `06_INFORMES-Y-PRUEBAS\INFORME_LETXINET_SUITE.docx` y en los logs A, B y C.

### 3.5 Causa de la falla crítica de spaCy
`MCP-V11-Local\python\spacy_server.py` carga modelos `*_core_*_sm`, que **no tienen vectores de palabra**. Al calcular similitudes, spaCy lanza `ValueError E010`, pero el código solo captura `KeyError`, así que devuelve HTTP 500. Por eso `smart_search` superaba el tiempo de espera y `filterFalsePositives` dejaba 0 resultados.

**Solución aplicada:** un interruptor en `bin\start-mcp-v11-local.cmd`. Si existe el archivo `MCP-V11-Local\SPACY_DISABLED`, el sidecar no arranca y V11 trabaja en su modo previsto «JSON-only». Scripts: `04_SCRIPTS-MANTENIMIENTO\desactivar-spacy.cmd` / `reactivar-spacy.cmd`.
**Arreglo de fondo (no aplicado):** instalar los modelos `_md` o capturar también `ValueError` en `spacy_server.py`.

### 3.6 Nueva prueba sin spaCy
| Herramienta o fuente | Antes | Después |
|---|---|---|
| `smart_search` | ❌ timeout | ✅ 50 resultados en 93 s |
| `search` + `filterFalsePositives` | ❌ 0 | ✅ 13 resultados en 11 s |
| `batch_search` | ❌ | ⚠️ funciona, pero tarda ~200 s: usar el puente |
| `search` sin `sources` | — | ❌ supera su límite de 114 s: indicar siempre las fuentes |
| RENATI | 30 s | 17 s |
| ALICIA | ❌ | ❌ sigue con timeout de 90 s: el conector está roto |
| OpenAlex, Semantic Scholar, Redalyc | 0 | 0 |

### 3.7 Repositorios peruanos
- Fuentes de LetXinet para Perú: `alicia` ❌, `renati` ✅, `laref_peru` ✅. Grupos: `peru` (renati + laref_peru) ✅ y `peru_fast` (incluye ALICIA) ⚠️, que tarda 90 s.
- **No hay conectores por universidad.** Se llega a ellas a través de los agregadores.
- Accesibilidad directa: 24 de 26 portales respondieron. **No respondieron UNT (`dspace.unitru.edu.pe`) ni UNPRG.**

### 3.8 Configuración adoptada de OpenCode
- En `AppData\Roaming\OpenCode\opencode.json` se encontró el puente `gateway-mcp-bridge.cjs`, que lanza `smart_search` y `batch_search` como **trabajos en segundo plano** (`letxipu_local_call` + `gateway_poll`).
- Se encontró además la causa de fondo de los timeouts: V11 detecta al cliente por su User-Agent y supone que Claude Code espera 300 s, pero Claude Code cortaba a los ~60 s.
- **Aplicado en Claude Code:**
  - servidor `letxinet-jobs` con el puente;
  - `MCP_TOOL_TIMEOUT=300000` en `~/.claude/settings.json`;
  - 2 skills adaptadas en `~/.claude/skills/`: `letxinet-investigacion-academica`, que viene de `websearch-deep-researcher`, y `letxinet-geo-academico`, que viene de `letxipu-osm-combined`. Cada una con una sección de adaptación con los nombres de herramienta de Claude Code y el estado verificado.
- `webwright` no se instaló, porque no es de LetXinet.

### 3.9 Uso real en una tesis (como caso de prueba)
Las herramientas se usaron para corregir el proyecto de tesis «Perfil lipídico y grado de HTA, Chimbote 2025». Por ejemplo:
- verificar referencias: se detectaron 3 falsas y 13 con datos erróneos;
- descargar 38 PDFs de acceso abierto;
- buscar y verificar antecedentes, hasta tener 8 nacionales y 8 internacionales.

Ese trabajo está en `C:\Users\USER\Downloads\TESIS\apoyo-claude-code\` y no forma parte de este paquete.

### 3.10 Recompilación: Suite 1.1.1 Variante B, sin claves y con los parches instalados (02/11)
- **Origen del payload:** la **instalación actual** (`C:\Program Files\LetXinet Suite`), que tiene parches posteriores al payload de `D:`:
  - **MCP-V11:** 9 archivos de `dist\providers` modificados (arxiv, openalex, pubmed, scopus, semantic-scholar, oai-pmh, global-academic).
  - **Desktop HF:** `server.cjs`, `main.cjs` e `index.html` modificados, más 45 archivos nuevos: el bundle nuevo de la interfaz, `parche8-slider.js`, `preload.cjs` y los catálogos de modelos de NVIDIA, OpenCode y OpenRouter.
  - **bin:** launcher de V11 con el interruptor de spaCy.
- **Claves quitadas:**
  - `resources\secrets.json` (excluido);
  - los `.env` de la Variante A;
  - la clave de Mistral en `server.cjs` y `server.cjs.map`, 14 apariciones reemplazadas por `""`;
  - el correo de `UNPAYWALL_EMAIL`.

  El `.env` central queda con `BUILD_VARIANT=public`.
- **Escaneo previo:** no queda ninguna clave en el árbol de build; solo están los dos `.env` limpios.
- **Cambios en el `.iss`:**
  - `MyAppVersion "1.1.1"`;
  - `Excludes: "resources\secrets.json,*.bak,*.bak-*,*.log"` en la copia del Desktop, que corrige el error que filtraba `secrets.json` a la B;
  - `SPACY_DISABLED` incluido, así que spaCy viene desactivado de fábrica.

  Copia en `07_DOCUMENTACION-ORIGINAL\build-v1.1.1\`.
- **Compilación:** Inno Setup 6, `ISCC /DVARIANT_B /DPAYLOAD_ROOT=Q:\` (con `subst`). **22 min 48 s**, código 0.
- **Resultado:**
  - `LetXinet-Suite-1.1.1-VariantB-Setup.exe`: 6,1 MB, SHA-256 `1CD3195FE4A7…4272`
  - `…-1.bin`: 393 MB, SHA-256 `EDFAC2C9B84D…68C6`

  El `.bin` pesa más que el de la B 1.1.0 (202 MB) porque ahora incluye todo lo instalado con sus parches.
- **Limitación de la verificación:** el `.bin` está comprimido y en esta PC no hay ninguna herramienta para extraerlo. Lo verificado es que el contenido de origen estaba limpio y que el `.iss` excluye `secrets.json`. **No se probó la instalación en un equipo limpio:** usar `verificar-instalacion.ps1` en la otra laptop.
- **Recompilación del 03/11 (versión definitiva):** al `.env` central del instalador se añadieron los ajustes de configuración que tenía esta PC (sin claves):
  - `LOCAL_MCP_PORT=4003`, que es el parche del bug de puerto;
  - `DESKTOP_ENDPOINT_MODE=local_only`;
  - `SPACY_DISABLE=1`;
  - `OAI_MAXPAGES=10` (parche 8);
  - las URLs de respaldo `LETXIPU_MCP_URL`, `LETXIPU_OSM_MCP_URL` y `LETXINET_MCP_URL`.

  Compilación: 18 min 39 s, código 0. Los hashes de arriba corresponden a esta versión.
- **Árbol de build** (1,3 GB, para volver a compilar): `C:\Users\USER\Downloads\LetXinet-Build-v1.1.1\`. Basta con hacer doble clic en `compilar-variante-B.cmd`.

### 3.11 Recompilación desde el código fuente (06/11)

**Corrección a §3.10:** el instalador del 03/11 **no traía activos los parches de V11**, aunque este reporte decía que sí. La causa es que `MCP-V11-Local.exe` ejecuta el código embebido al compilarlo (31/07), no la carpeta `dist\`, donde se habían aplicado los parches de agosto. Lo mismo ocurre en la instalación de esta PC.

**Cómo se comprobó:**
- Un marcador añadido a `dist\server.js` no se ejecutó al arrancar el `.exe`.
- El `.exe` instalado no contiene `maxPagesBySource`, una cadena de los parches.
- Con `PUBMED_MAXPAGES=7`, el `.exe` nuevo devuelve 7 resultados y el instalado devuelve 40.

**Otro error corregido:** el zip anterior traía el código de V11 de julio, sin los parches. El código correcto estaba en `D:\OTROS\LETXIPU-SEARCH-MCP-V11-LOCAL`.

**Lo que se hizo:**
- `02_CODIGO-FUENTE` ahora trae el código actual sin claves, en carpetas, junto con `recompilar-todo.cmd`. Las fuentes anteriores quedaron en `LetXinet-Build-v1.1.1\fuentes-anteriores-v1.1.0`.
- El instalador se generó ejecutando ese script sobre la carpeta `02_CODIGO-FUENTE`, reutilizando los `node_modules` de esta PC. `npm ci` no se probó.
- Hashes SHA-256:
  - `LetXinet-Suite-1.1.1-VariantB-Setup.exe`: `C1EF210382F3DC05C6D7F545BEBBBCE09A8DB40D14F456F22BE6F1B7C1CBCEED`
  - `LetXinet-Suite-1.1.1-VariantB-Setup-1.bin`: `BBC7B2EE159C692830BA6ACC96DC0F40B782F86B554ECDE39F94D249FA90B0F0`

**Diferencias entre lo compilado y lo instalado en esta PC:**

| Componente | Resultado |
|---|---|
| V11 | `.exe` nuevo con los parches activos. Además trae dos arreglos que estaban en el código y no en lo instalado: `OSM_MCP_URL` apunta por defecto a `127.0.0.1:7082`, en vez de `localhost:7860`, y `SCIHUB_MIRRORS`, `UNPAYWALL_*` y `DOI_RESOLVER_URL` ya se leen del entorno |
| Desktop HF | JavaScript idéntico byte a byte; `server.cjs` igual, salvo la clave quitada y los saltos de línea; `electron` igual. El CSS tiene 10 clases menos, generadas por archivos ajenos al proyecto |
| OSM | Mismo código, recompilado con Go 1.26.4 |
| MarkItDown | Sin cambios |

**Pruebas realizadas** (en puertos aparte, sin claves y comparando con los servicios instalados):
- V11: 28 herramientas con los mismos esquemas y `list_sources` igual. `renati` dio los mismos resultados que el instalado (43), `pubmed` respetó el parche y `laref_peru` respondió sin error.
- arXiv devolvió 0 resultados con el `.exe` nuevo y con el instalado, así que esa fuente no quedó comprobada.
- OSM: 28 herramientas, y `geo_distance` y `geocode_address` correctas.
- Desktop: `/health` correcto (28 herramientas, 39 fuentes), y la página y sus recursos responden.

**Sin probar:** la instalación en una laptop limpia y la interfaz de Electron abierta. Usa `verificar-instalacion.ps1`, que ahora también comprueba los parches de V11.

**Verificación completa del zip (07/11):** el zip se extrajo en una carpeta nueva y se recompiló todo desde su código, con dependencias limpias (`npm ci`). Compiló sin errores e Inno Setup generó el instalador en 24 minutos. Los 4 servicios compilados arrancaron y dieron los mismos resultados que los instalados, y la interfaz del Desktop cargó. La verificación y una revisión del script encontraron 12 fallos en `recompilar-todo.ps1` y `verificar-instalacion.ps1`, ya corregidos; ver `09_PLAN-VERIFICACION-E-INSTALACION.docx`. Se añadió el harness `04_SCRIPTS-MANTENIMIENTO\harness\probar-letxinet.cmd`.

**Reinstalación desde cero en esta PC (07/11, de 19:12 a 19:19):** se desinstaló la 1.1.0 A, se limpió y se instaló la 1.1.1 B con el instalador del USB, sin errores. Se restauró la configuración con claves y el harness dio 0 fallas, con las mismas cifras que antes. El Desktop abre con sus claves y chats intactos. El respaldo está en `C:\Users\USER\LetXinet-archivo\reinstalacion-20261107-1910`.

**Actualización de esta PC (07/11):** se reemplazó `MCP-V11-Local.exe` y `dist\` en la instalación y se reinició el servicio. V11 responde con 28 herramientas, y `pubmed`, `renati` y `laref_peru` devuelven resultados. Con `OAI_MAXPAGES=10` activo, `renati` puede tardar más que antes (76 s en la prueba). `maxPagesBySource` no se puede pasar por la herramienta MCP `search`, que lo ignora; el límite por variable de entorno sí funciona. Esta PC sigue siendo Variante A 1.1.0 en lo demás.

### 3.12 Versión 1.1.2: clientes, OSM y requisitos (07/11)

**Revisión previa.** Se revisó la configuración de OpenCode, Claude Code y Claude Desktop para usar V11 y OSM juntos y por separado. Se encontraron 5 fallos:

1. El puente de tareas largas (`gateway-mcp-bridge.cjs`) apuntaba a `127.0.0.1:3000`, donde no hay nada. Lo correcto es 43123.
2. Las configuraciones de OpenCode y Claude Desktop apuntaban a `D:\OTROS\…`, carpetas de desarrollo que no existen en otra laptop.
3. Las configuraciones de OpenCode tenían formatos mezclados: `opencode.json` del paquete en formato V2, junto a entradas antiguas de V1 que no arrancaban.
4. El gateway del Desktop con `server=osm` devolvía las herramientas de V11. El filtro comparaba con nombres internos (`letxipu_osm`), así que «osm» no coincidía con nada y se usaba la lista de respaldo, que es la de V11.
5. El puente del Addon (`letxinet-gateway`) tardaba unos 30 s por llamada, respondía a las notificaciones MCP y solo funcionaba con el Desktop abierto.

**Cambios en la 1.1.2:**

| Área | Cambio |
|---|---|
| Puentes MCP (`bin\mcp\`) | `letxinet-mcp-bridge.cjs`: servidor stdio que va directo a V11 (4003) y OSM (7082), sin depender del Desktop. Selección con `LETXINET_SELECCION=ambos\|v11\|osm`. Si un servicio está caído, omite sus herramientas y lo explica al llamarlas. `letxinet-jobs-bridge.cjs`: el puente de tareas largas, corregido al puerto 43123 y a `%LOCALAPPDATA%\LetXinet\jobs` |
| Configurador (`bin\configurar-clientes.cjs`) | Configura Claude Code, Claude Desktop y OpenCode en modo `separados`, `juntos` o `ambos`. Detecta la versión de OpenCode (V1 o V2), quita entradas antiguas rotas, copia las skills, respalda cada archivo y comprueba que los servicios respondan. El instalador lo ejecuta al final (casilla marcada) y queda en el menú Inicio |
| Gateway del Desktop | El filtro `server=` acepta `v11`, `osm`, `juntos` y `ambos` |
| OSM | User-Agent `LetXinet-Suite/1.1.2`, con un correo opcional que el instalador pide para cumplir la política de Nominatim. Si Overpass falla (error de red, 429 o 5xx), reintenta en servidores espejo (`OVERPASS_FALLBACK_URLS`; `none` lo desactiva). `OSM_MCP_URL` explícito en el `.env` |
| Red | V11, OSM (7082 y 9090) y el gateway (43123) escuchan solo en `127.0.0.1`. Para usarlos desde el celular en la red local, pon `LETXINET_BIND_HOST=0.0.0.0` en el `.env` |
| Requisitos | El instalador trae Node.js 22.23.4 LTS (MSI firmado por OpenJS Foundation, SHA-256 comprobado con nodejs.org) y lo instala solo si falta. El configurador y los puentes lo necesitan |
| Actualización | `bin\actualizar-config.ps1` añade al `.env` existente las claves nuevas sin tocar las tuyas, y lo respalda como `.antes-1.1.2-FECHA` |
| Actualizar con el Desktop abierto | El primer intento de actualizar esta PC en silencio se canceló porque el instalador no pudo cerrar el Desktop abierto, y dejó los servicios detenidos. Ni el cierre forzado de Restart Manager logra cerrar Electron. Ahora:<br>- en modo silencioso, el instalador termina el proceso del Desktop antes de reemplazar archivos;<br>- en modo normal, pide cerrarlo;<br>- si la instalación se cancela, vuelve a arrancar los servicios (comprobado) |
| Pruebas | Harness con una sección nueva de puentes MCP (`ambos` ≥ 50 herramientas, `v11` y `osm` ≥ 25, puente de tareas). Revisa que no queden rutas `D:\OTROS` ni el puerto 3000. Queda en el menú Inicio como «Probar LetXinet Suite» |

**Pruebas antes de compilar:**
- Puente `ambos`: 56 herramientas. `geo_distance` tardó 0,0 s y `search` en `laref_peru`, 7,5 s; antes, por el puente del Addon, eran unos 30 s.
- Puente `v11` solo: 28 herramientas. `osm` solo: 28. Con OSM detenido, `ambos` dio 28 herramientas y un error claro al llamar a las de OSM.
- Puente de tareas: 59 herramientas del gateway, y `gateway_call` con `geo_distance` correcto.
- Configurador: probado en un perfil falso; el resto de `~/.claude.json` quedó intacto y se crearon los respaldos.
- OSM: `go vet` y 3 pruebas unitarias de los espejos de Overpass, correctas.

**Hallazgo de red (no es un fallo de la Suite).** Desde la red de esta PC, `router.project-osrm.org` y `routing.openstreetmap.de` fallan en el saludo TLS (`SEC_E_ILLEGAL_MESSAGE`), y Overpass y sus espejos no responden. Por eso, aquí fallan las rutas y la búsqueda de lugares de OSM. El fallo viene de un filtro de la red o del proveedor, no de la Suite. En otra red deberían funcionar. Los espejos de Overpass no se pudieron probar en vivo.

**Actualización de esta PC a la 1.1.2 (08/11, de 00:22 a 00:26): correcta.**
- Actualización silenciosa con código 0. Los 3 servicios están en marcha y el `.env` tiene las 4 variables nuevas, con respaldo `.antes-1.1.2`.
- Los puertos 4003, 7082, 7860, 9090 y 43123 escuchan solo en `127.0.0.1`.
- El configurador dejó Claude Code, Claude Desktop y OpenCode con `letxinet-v11`, `letxinet-osm`, `letxinet-markitdown` y `letxinet-jobs`, sin rutas `D:\OTROS` ni el puerto 3000.
- Gateway: `server=osm` devuelve 28 herramientas, todas de OSM; `server=v11`, 31; `juntos`, 59.
- Harness: 32 OK, 0 avisos y 0 fallas, con las mismas cifras de búsqueda que antes.
- Respaldo y registros en `C:\Users\USER\LetXinet-archivo\actualizacion-1.1.2-20261108-0022`.

SHA-256 del instalador final:
- `LetXinet-Suite-1.1.2-VariantB-Setup.exe`: `1FBDF53365864D700938D253A9061155DFBB29570EDE56B7BE72E284BE39AC0C`
- `LetXinet-Suite-1.1.2-VariantB-Setup-1.bin`: `463FF92E1D25D306AEF83BECE18C0CBCE71605436152B42A86B6CBE34A1E9C6E`

**No se cambió:**
- El producto Addon Bridges: el configurador reemplaza su puente en las configuraciones, pero no lo modifica.
- Los problemas de `geocode_address` ni el conector de ALICIA.

### 3.13 Versión 1.1.3: arreglos de V11 tras el pool de pruebas (08/11)

El pool de 11 harnesses (211 pruebas, ver `06_INFORMES-Y-PRUEBAS\Informe-pool-de-pruebas-y-comparativo-IA-2026-11-08.docx`) encontró 18 problemas. La 1.1.3 corrige los de gravedad alta y varios medios.

| Hallazgo | Causa | Arreglo en la 1.1.3 | Comprobado |
|---|---|---|---|
| `convert_document` fallaba con cualquier URL | Bastaba con que `MINERU_API_KEY` tuviera algún valor (en esta PC, una clave incompleta) para no descargar el PDF | Usa MinerU solo si responde; si no, descarga y convierte en local. Ya no da «correcto» con el texto «[Error extracting…]» | Convirtió el PDF de arXiv |
| V11 se atascaba con muchas consultas de metadatos (más de 114 s, y se recuperó solo después de más de una hora) | `fetchWithTimeout` esperaba en dos colas sin límite y anulaba su reloj al llegar las cabeceras; la cola por dominio esperaba a todas las peticiones anteriores; `recover_metadata` no tenía tope | El plazo cubre colas y cuerpo; semáforo real por dominio; `recover_metadata` con tope de 90 s | 20 consultas simultáneas en 13 s, y la siguiente en 0,7 s |
| Búsqueda de tesis peruanas con mucho ruido | Si La Referencia daba 0, el reintento quitaba la palabra del tema y dejaba el lugar ("dengue Chimbote Áncash" → "Chimbote Áncash"); el cosechador OAI-PMH aceptaba el 40 % de las palabras | Filtro de pertinencia para RENATI, ALICIA y La Referencia, y reintento que conserva el tema ("dengue Chimbote") | Pertinentes de 80 a 90, tesis pertinentes de 17 a 31, sobre el Perú de 32 a 45 |
| `download_pdf` usaba espejos de Sci-Hub | Siete espejos de fábrica en el código y la lista en la plantilla del `.env` | Sin espejos de fábrica; WeLib solo con `WELIB_ENABLED=true`. La variable `SCIHUB_MIRRORS` sigue funcionando si quien opera la Suite la llena | `download_pdf` resuelve por doi.org |
| Filtro de URL internas incompleto | `read_pdf` no filtraba nada; `convert_document` revisaba después de descargar y con patrones que no cubrían 169.254.x.x ni 0x7f000001 | `utils/url-segura.ts`: IP normalizada, DNS y cada redirección; se aplica en todas las herramientas | 9 formas de dirección interna bloqueadas (harness h10: 16 OK) |
| `extract_tables` nunca encontraba tablas | Buscaba tablas HTML, pero MarkItDown las devuelve en Markdown | Reconoce los dos formatos | Las 4 tablas del paper de arXiv |
| `fetch_metadata` con un DOI inexistente daba «correcto» con título vacío | No comprobaba el resultado | Usa Crossref si OpenAlex no responde y da un error claro si el DOI no existe | Sí |
| `resolve_pdf` no abría enlaces de repositorio | Solo trabajaba con DOI | Abre la página, toma `citation_pdf_url` o el enlace al PDF, y explica cuando el repositorio pide verificación anti-robots (no la salta) | 6 repositorios peruanos: ninguno entregó el PDF automáticamente (2 con verificación, 1 con 403, 3 sin respuesta) |
| Textos de La Referencia con codificación rota ("PerÃº") | El archivo fuente estaba doblemente codificado | 48 secuencias corregidas | Sí |

**Instalación en esta PC (08/11, de 07:30 a 07:34):** código 0, versión 1.1.3, los 3 servicios en marcha, V11 con 28 herramientas, `SCIHUB_MIRRORS` vacío y User-Agent 1.1.3. Los puertos 4003, 7082, 7860 y 9090 escuchan solo en `127.0.0.1`.

**Pool completo sobre la 1.1.3 instalada (08/11, terminó a las 08:59):**

| | 1.1.2 | 1.1.3 |
|---|---|---|
| Pruebas | 211 | 214 |
| OK | 165 | 179 |
| Avisos | 28 | 24 |
| Fallas | 7 | 1 (`geocode_address`, que no estaba en los arreglos) |
| Fallos de la red externa | 11 | 10 (Overpass y un servicio de Nominatim) |
| Herramientas de V11 (h02) | 29 OK, 5 fallas | 35 OK, 0 fallas |
| Seguridad (h10) | 10 OK, 1 falla | 16 OK, 0 fallas |
| Configurador (h07) | 16 OK, 4 avisos | 20 OK, 0 avisos |
| `fetch_metadata` (mediana) | 10,6 s | 2,4 s |
| Búsqueda grande (3 fuentes, 50 resultados) | 90 s | 3,2 s |
| Comparativo: referencias pertinentes | 80 de 241 (33 %) | 86 de 165 (52 %) |
| Comparativo: tesis pertinentes | 17 | 22 |

Las cifras del comparativo varían entre corridas, porque dependen de las fuentes externas. La copia de prueba de la 1.1.3 dio 90 pertinentes de 207 y 31 tesis.

SHA-256 del instalador:
- `LetXinet-Suite-1.1.3-VariantB-Setup.exe`: `6F2AF5E643EB4804802C6FB06B0FA0B77BE1A81F438AAACAE9C7B9D4CCFE47AA`
- `LetXinet-Suite-1.1.3-VariantB-Setup-1.bin`: `0EEC5C693584C6ADB65AA0C9DF66A6929DB0E2A7276805BFCBBD55B3118D6CAA`

**Queda igual a propósito:** el módulo `scraping\anubis-solver.ts`, que usa la ruta de resúmenes de ALICIA (`enhanceAliciaResults`), sigue como estaba, por decisión del dueño del código. No se extendió a otras rutas.

**Pendiente:**
- Las claves de MinerU, CORE, Scopus, Semantic Scholar, SerpAPI y Redalyc de esta PC están incompletas (11 caracteres).
- ALICIA no responde.
- `geocode_address` descarta algunos lugares por baja confianza.
- `pdf_citations` no se pudo probar con un PDF en español: SciELO y los repositorios peruanos bloquean descargas automáticas.

### 3.14 Versión 1.1.4: instalación en otra laptop (08/11)

Al instalar la 1.1.3 en otra laptop (DESKTOP-F26SLVP), el harness dio 23 OK, 4 avisos y 3 fallas, y LetXipu Desktop HF se cerró con «The desktop backend did not start in time».

| Falla | Causa | Arreglo en la 1.1.4 | Comprobado en esta PC |
|---|---|---|---|
| MarkItDown «no responde en 7860», aunque el servicio figuraba «Running» | PyMuPDF necesita `msvcp140.dll` (Visual C++). El Python embebido solo trae `vcruntime140`. Esta PC lo tiene en System32; la otra laptop, al parecer, no. Python no carga PyMuPDF, uvicorn se cae y NSSM lo reinicia en bucle | `runtime-extra\msvcp140.dll` dentro de los dos Python (MarkItDown y V11, que tiene 26 binarios que también lo usan) | El Python del instalador carga `msvcp140.dll` desde su propia carpeta, no desde System32, así que no depende de que Windows lo tenga |
| «PDF a Markdown: No se puede llamar a un método en una expresión con valor NULL» | Consecuencia de lo anterior. Además, el harness usaba `.Result`, que en PowerShell devuelve null cuando la petición falla | Si MarkItDown no responde, no se prueba la conversión; los errores reales se muestran con `GetAwaiter().GetResult()` | Harness nuevo: 32 OK, 1 aviso, 0 fallas |
| Desktop: «The desktop backend did not start in time» | Esperaba solo 2 minutos. En esta PC el backend ya tardaba 52 s en frío; en una laptop más lenta, o con el antivirus revisando los archivos la primera vez, se pasa | Espera de 10 minutos (`LETXIPU_BACKEND_TIMEOUT_MS`), ventana de «Iniciando LetXinet Desktop...» y mensaje de error en español con los registros a revisar. Además se arregló la comprobación de un backend ya activo, que nunca funcionaba (tenía `new Promise<boolean>`, sintaxis de TypeScript, en un `.cjs`) | Muestra la ventana de inicio; el backend respondió en 17 s y se abrió la app |
| Claude Code: «no existe ~/.claude.json» (falla) | Claude Code no está instalado en esa laptop | El harness lo marca como aviso cuando Claude Code no está instalado | — |

**Para laptops que ya tienen la 1.1.3:** `04_SCRIPTS-MANTENIMIENTO\arreglo-1.1.3\arreglar-letxinet.cmd` hace lo mismo sobre la instalación existente: copia `msvcp140.dll` si falta, reinicia MarkItDown y comprueba que responda, sube la espera del Desktop a 10 minutos (con respaldo del archivo original) y configura Claude Code si está instalado. Deja un resumen en el Escritorio.

**Compilación:** recompilación completa con `recompilar-todo.ps1`, sin claves y con `msvcp140.dll` en los dos Python.

SHA-256 del instalador:
- `LetXinet-Suite-1.1.4-VariantB-Setup.exe`: `3ECE03C6F70B1A2B410F551E3C655F577A5B67F0C9BF83506188516214E90ECD`
- `LetXinet-Suite-1.1.4-VariantB-Setup-1.bin`: `88ABC2C81CE1D4A00F37039258BB5211D49AEA4A5213A35B6636D29B4249CA15`

**Sin probar todavía:** la instalación de la 1.1.4 encima de la 1.1.3, tanto en esta PC (pide aceptar el permiso de administrador en pantalla) como en la otra laptop.

### 3.15 Versión 1.1.5: arreglos tras las pruebas de búsqueda (09/11)

**Origen de los arreglos:**
- **Otra laptop:** con el arreglo de la 1.1.3, MarkItDown pasó a fallar por otra causa: «DLL load failed while importing _multiarray_umath».
- **Pruebas de búsqueda:** tres agentes probaron `search`, `batch_search`, OSM y `letxinet-jobs` (`06_INFORMES-Y-PRUEBAS\pruebas-busqueda-2026-11-09.md`).

| Falla | Causa | Arreglo en la 1.1.5 | Comprobado sin instalar |
|---|---|---|---|
| MarkItDown no arranca en algunos procesadores | numpy 2.5.1 exige SSE4.2 (x86-64-v2) | numpy 2.3.5 (base SSE3) en el Python de MarkItDown; `recompilar-todo.ps1` lo cambia y comprueba que cargue | El Python del instalador carga numpy 2.3.5 (base SSE, SSE2, SSE3) con PyMuPDF4LLM y convierte un PDF |
| `letxinet-jobs` corta las búsquedas largas a los 114 s | Las tareas se presentaban como `opencode/1.0` y V11 les aplicaba el límite de OpenCode | Las tareas se presentan como `letxinet-jobs-bridge/1.1.5`, y V11 1.1.5 les da el límite de 600 s | Contra la V11 1.1.3 instalada: un `batch_search` de 3 consultas terminó en 150 s con 20 resultados (antes, corte a 114 s). La V11 1.1.5 registra estas llamadas como `client="cli"` |
| `gateway_poll` dice «todavía no listo» aunque la tarea falló o no existe | Solo distinguía DONE de lo demás | `PENDING`, `DONE`, `ERROR` (con el motivo), `LOST`, `NOT_FOUND` e `INVALID`, con `isError` en los cuatro últimos | Tarea con datos inválidos: `ERROR` con «queries array cannot be empty»; tarea inexistente: `NOT_FOUND` |
| `gateway_poll` puede leer archivos fuera de la carpeta de tareas | No validaba el `task_id` | Valida el formato del `task_id` | `..\..\Windows\win`: `INVALID` |
| Cada tarea deja 5 archivos para siempre | Nadie los borraba | Se borran los de más de 24 h, solo con el nombre exacto que crea el puente | Borró una tarea de hace 2 días y dejó intacto un archivo ajeno |
| La ubicación de una búsqueda pasa a todas las siguientes | Se guardaba en `globalThis.__osmGeoResult` y no se borraba hasta reiniciar | Contexto por petición con AsyncLocalStorage (`src\utils\geo-context.ts`) | Dos `batch_search` seguidas: Huaraz (región Áncash) y luego Arequipa (región Arequipa), cada una con su ubicación |
| `maxSources` no limita los resultados de `search` | La ruta solo lee `maxResults` | `search` anuncia `maxResults`, y `maxSources` es un alias | Con Crossref: sin límite 8, con `maxSources=5` 5, con `maxResults=7` 7 |
| El skill recomendaba `batch_search` como herramienta principal | Texto antiguo | Recomienda `search` y varias `search` seguidas | — |

**Compilación:** recompilación completa con `recompilar-todo.ps1` en 22,4 minutos, sin claves, con `msvcp140.dll` en los dos Python y numpy 2.3.5 en MarkItDown.

SHA-256 del instalador:
- `LetXinet-Suite-1.1.5-VariantB-Setup.exe`: `F50E60093407C0957351B932F78DA2227A636BCACCC89A084E88FBBF4A3B5B54`
- `LetXinet-Suite-1.1.5-VariantB-Setup-1.bin`: `BBBF28FAFAB2C8685A0AE1BF37E7A55503594C7B45B0E7C83A9F3430D3EB7CF2`

**Sin probar todavía:**
- La instalación de la 1.1.5 encima de una versión anterior: pide aceptar el permiso de administrador en pantalla.
- MarkItDown en un procesador sin SSE4.2. Solo se comprobó la base de numpy (SSE3); además, onnxruntime 1.28, que también usa PyMuPDF4LLM, no se probó en un procesador así.

---

## 4. Estado final de LetXinet Suite (02/11/2026)
| Componente | Estado |
|---|---|
| Servicios V11, OSM y MarkItDown | ✅ en marcha (Automático) |
| V11 en modo sin spaCy | ✅ (el puerto 4002 no escucha) |
| Búsqueda Perú (`laref_peru`, `renati`) | ✅ |
| ALICIA | ❌ conector con timeout |
| OSM: rutas y geocodificación | ✅ / Overpass ❌ (externo) |
| Logs | ✅ 5,7 MB |
| Claude Code | ✅ 4 MCP, timeout de 300 s y 2 skills |

---

## 5. Archivos modificados en esta PC (y cómo revertirlos)
| Archivo | Cambio | Respaldo o reversión |
|---|---|---|
| `~/.claude.json` | +4 servidores MCP | `~/.claude.json.bak-letxinet`, `.bak-letxinet-jobs` |
| `~/.claude/settings.json` | creado: `MCP_TOOL_TIMEOUT=300000` | borrar el archivo |
| `~/.claude/skills/letxinet-*` | 2 skills | borrar las carpetas |
| `C:\Program Files\LetXinet Suite\bin\start-mcp-v11-local.cmd` | interruptor de spaCy | `start-mcp-v11-local.cmd.bak-spacy` |
| `C:\Program Files\LetXinet Suite\MCP-V11-Local\SPACY_DISABLED` | interruptor activo | `reactivar-spacy.cmd` |
| `C:\ProgramData\LetXinet Suite\Logs\` | logs rotados y env-backups borrados | `C:\Users\USER\LetXinet-archivo\*.zip` |
| Configuración de Claude Code, Claude Desktop y OpenCode | la 1.1.2 la rehízo con el configurador (08/11); en Claude Desktop quitó `letxinet-gateway` y `markitdown-api` del Addon | archivos `.bak-letxinet-FECHA` junto a cada uno, y copias en `LetXinet-archivo\actualizacion-1.1.2-20261107-2330\configs-antes` |
| `C:\Program Files\LetXinet Suite\MCP-V11-Local\MCP-V11-Local.exe` y `dist\` | versión con los parches activos (07/11) | `MCP-V11-Local.exe.bak-antes-parches-20261107` y `dist.bak-antes-parches-20261107`, en esa misma carpeta |

---

## 6. Pendientes recomendados (en orden de prioridad)
1. **Rotar la clave de Mistral** escrita en el código y quitar el valor por defecto de `server.ts`; luego recompilar (§7).
2. Corregir `spacy_server.py` (capturar `ValueError` o usar modelos `_md`) y reactivar spaCy.
3. Arreglar o desactivar el conector de ALICIA y sacarlo del grupo `peru_fast`.
4. Bajar el nivel de log de V11 y configurar la rotación de NSSM (`AppRotateFiles`/`AppRotateBytes`).
5. Evitar el doble arranque de V11 con `DESKTOP_ENDPOINT_MODE=local_only`.
6. ~~Hacer que 4003, 43123 y 9090 escuchen solo en `127.0.0.1`~~: hecho en la 1.1.2 (§3.12).
7. ~~Configurar un Overpass alternativo~~: hecho en la 1.1.2 con espejos automáticos. Falta corregir `geocode_address`.
8. Disco C: al 93 % y D: al 100 %: liberar espacio.

## 7. Seguridad (leer antes de compartir)
> **Actualización del 02/11:** el paquete ya trae la **B 1.1.1 recompilada sin claves** (§3.10). Lo que sigue describe el problema de la 1.1.0 y por qué conviene **rotar** esas claves.

- **Clave de Mistral escrita en el código:**
  - `LETXINET-DESKTOP-HF\server.ts` la usa 7 veces como valor por defecto (`… || "sk-…"`).
  - Queda dentro de `dist\server.cjs` y del payload del instalador, **en la Variante A y también en la B**, y en la instalación actual.
  - En las fuentes de este paquete quedó como `<REDACTADO>`.
  - **Los instaladores no se pueden limpiar sin recompilarlos**, así que no publiques este paquete y rota la clave.
- **Variante A** (`secrets.json` con 9 claves): solo está en `LetXinet-Suite-v1.1.0-PRIVADO_NO_COMPARTIR`. Es la variante instalada en esta PC (AppId `…VARIANT-A…`).
- **⚠️ Error del instalador: la Variante B también lleva `secrets.json`.**
  - En `LetXinet-Suite.iss`, línea 176, `Source: "{#PAYLOAD_ROOT}\letxinet-desktop\*"` copia toda la carpeta, incluido `resources\secrets.json` (claves de OpenRouter, Nebius y DeepSeek). El bloque `#ifdef VARIANT_A` de la línea 182 no lo impide.
  - El payload ya tenía ese archivo cuando se compiló (07/08, a las 15:33; la compilación fue a las 21:00).
  - No se pudo verificar abriendo el `.bin` de la B, pero según el `.iss` está incluido.
  - **Corrección:** añadir `Excludes: "resources\secrets.json"` a la línea 176 (o sacar el archivo del payload antes de compilar la B), quitar el valor por defecto de la clave en `server.ts`, recompilar y luego rotar las claves.
- **Fuentes del paquete (06/11):** no incluyen `.env` con claves, `.env.local` ni `secrets.json`. En `desktop-hf\server.ts` se quitó la clave, que estaba escrita 7 veces. Se revisó el resultado con los formatos típicos de clave y con los valores reales de esta PC, y no quedó ninguna.
- **Las fuentes originales con claves** están en la carpeta privada y en `D:\OTROS`.
