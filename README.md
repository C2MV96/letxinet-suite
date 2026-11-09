# LetXinet Suite

LetXinet Suite es un instalador para Windows 10 y 11 (x64). Deja funcionando en el equipo, como servicios locales, varias herramientas de investigación académica y geoespacial. Claude Code, Claude Desktop y OpenCode las usan por MCP.

**Versión actual:** 1.1.4, Variante B. Esta variante no lleva claves: cada usuario carga las suyas.

## Componentes

| Componente | Carpeta | Qué hace | Tecnología | Puerto |
|---|---|---|---|---|
| MCP-V11-Local | `02_CODIGO-FUENTE/mcp-v11-local` | Búsqueda académica en 39 fuentes (RENATI, ALICIA, La Referencia, OpenAlex, Crossref…), lectura de PDF, tablas y metadatos | TypeScript, empaquetado como `.exe` con yao-pkg | 4003 (sidecar 4002) |
| OSM-MCP | `02_CODIGO-FUENTE/osm-mcp` | Mapas, geocodificación, rutas y lugares cercanos con OpenStreetMap | Go (con `vendor`) | 7082 |
| MarkItDown API | `02_CODIGO-FUENTE/markitdown-api` | Conversión de PDF a Markdown | Python 3.12 embebido, FastAPI y PyMuPDF4LLM | 7860 |
| LetXinet Desktop HF | `02_CODIGO-FUENTE/desktop-hf` | App de escritorio y gateway MCP | Electron, React (Vite) y Node | 43123 |
| Instalador | `02_CODIGO-FUENTE/instalador` | Registra los servicios y configura los clientes de IA | Inno Setup 6 y NSSM | — |

Los servicios escuchan solo en `127.0.0.1`. La configuración está en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` y los registros en `C:\ProgramData\LetXinet Suite\Logs`.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `00_LEEME-PRIMERO.md` | Resumen del paquete y novedades de cada versión |
| `01_INSTALADORES/` | Solo los hashes SHA-256. Los instaladores se publican aparte (ver [Instalar](#instalar)) |
| `02_CODIGO-FUENTE/` | Código de todos los componentes y `recompilar-todo.cmd`, que genera el instalador |
| `03_CONFIG-CLAUDE-CODE-OPENCODE/` | Configurador de clientes, skills y plantillas del `.env` con las claves vacías |
| `04_SCRIPTS-MANTENIMIENTO/` | Harness de pruebas, pool de pruebas completas, arreglos para laptops ya instaladas y utilidades |
| `05_GUIA-MODIFICAR-COMPILAR-INSTALAR.md` | Guía técnica de cada componente |
| `06_INFORMES-Y-PRUEBAS/` | Informes y registros de pruebas |
| `07_DOCUMENTACION-ORIGINAL/` | Planes, línea de tiempo y documentación de las versiones anteriores |
| `08_REPORTE-COMPLETO-DE-LO-SUCEDIDO.md` | Historial detallado de cambios, pruebas y seguridad |
| `09_PLAN-VERIFICACION-E-INSTALACION.docx` | Plan de verificación e instalación |

## Instalar

1. Descarga `LetXinet-Suite-1.1.4-VariantB-Setup.exe` y `LetXinet-Suite-1.1.4-VariantB-Setup-1.bin` desde la sección *Releases*, y déjalos en la misma carpeta.
2. Comprueba los hashes con `01_INSTALADORES/HASHES-SHA256-v1.1.4-VariantB.txt`.
3. Ejecuta el `.exe` como administrador. Si falta Node.js, el instalador lo instala.
4. Carga tus claves con «Configurar API keys» del menú Inicio.
5. Comprueba la instalación: menú Inicio → «Probar LetXinet Suite».

El detalle está en [`00_LEEME-PRIMERO.md`](00_LEEME-PRIMERO.md).

## Compilar

**Requisitos:**
- LetXinet Suite instalada en el equipo. De ahí salen los runtimes que no son código: Electron, `node_modules` y los Python embebidos.
- Node.js 22 o superior, Go 1.24 o superior e Inno Setup 6.3 o superior.
- Internet para `npm ci`, y unos 6 GB libres la primera vez.

**Archivos que no están en el repositorio** por tamaño o porque son de terceros. Consíguelos antes de compilar:

| Archivo | Dónde va | Cómo conseguirlo |
|---|---|---|
| `node-v22.23.4-x64.msi` | `02_CODIGO-FUENTE/instalador/instalador/prerequisitos/` | https://nodejs.org/dist/v22.23.4/node-v22.23.4-x64.msi |
| `msvcp140.dll` (Visual C++ 2015-2022, x64) | `02_CODIGO-FUENTE/runtime-extra/` | Cópialo de `C:\Windows\System32` de un equipo con el redistribuible de Visual C++ x64 instalado |
| Binario base de Node para yao-pkg | `02_CODIGO-FUENTE/herramientas/pkg-cache/` | Opcional: si falta, yao-pkg lo descarga solo |
| Modelos de spaCy | `02_CODIGO-FUENTE/mcp-v11-local/src/python/models/` | Solo para desarrollar V11 con spaCy: `python -m spacy download es_core_news_sm` (y `en_core_web_sm`, `pt_core_news_sm`). El instalador los toma de la Suite instalada |
| Fuentes de Addon Bridges 1.0.0 | — | Se distribuyen aparte (zip de 152 MB). Ver `07_DOCUMENTACION-ORIGINAL` |

Después, haz doble clic en `02_CODIGO-FUENTE/recompilar-todo.cmd`. Tarda de 30 a 40 minutos y deja el instalador en `C:\LetXinet-Recompilado\installer-output\variantB`. El script se detiene si encuentra una clave o si falta `msvcp140.dll`. Más detalles en [`02_CODIGO-FUENTE/LEEME-RECOMPILAR.md`](02_CODIGO-FUENTE/LEEME-RECOMPILAR.md).

## Probar

- **Harness rápido:** `04_SCRIPTS-MANTENIMIENTO/harness/probar-letxinet.cmd`. El instalador lo deja en el menú Inicio como «Probar LetXinet Suite» y escribe el informe en el Escritorio.
- **Pool de pruebas completas**, con comparativo frente a IA: `04_SCRIPTS-MANTENIMIENTO/harness/pool/ejecutar-pool.cmd`.

## Arreglos para laptops ya instaladas

| Carpeta | Para qué |
|---|---|
| `04_SCRIPTS-MANTENIMIENTO/arreglo-1.1.3/` | Arregla una 1.1.3: MarkItDown sin Visual C++ y Desktop que no espera a su backend. Copia `msvcp140.dll` dentro de la carpeta antes de usarlo |
| `04_SCRIPTS-MANTENIMIENTO/arreglo-2-markitdown/` | MarkItDown en procesadores sin SSE4.2: cambia numpy 2.5.1 por 2.3.5. Necesita el wheel de numpy en la carpeta (ver su `LEEME.txt`) |

## Problemas conocidos

- **MarkItDown en procesadores antiguos.** La 1.1.4 trae numpy 2.5.1, que exige SSE4.2 (x86-64-v2). En procesadores anteriores MarkItDown no arranca. El error es «DLL load failed while importing _multiarray_umath». Mientras tanto, usa `arreglo-2-markitdown`.

## Seguridad

- El repositorio no lleva claves. Las claves van en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` o en la pantalla de configuración del Desktop, nunca en el código.
- `.gitignore` bloquea los `.env`, `secrets.json`, las carpetas de claves y los binarios.
- Si usaste la versión 1.1.0, rota las claves que llevaba.

## Licencias

El proyecto todavía no tiene licencia propia: mientras no se elija una, el código es de uso reservado de su autor. Los componentes de terceros conservan sus licencias, por ejemplo:
- NSSM: dominio público.
- numpy: BSD.
- PyMuPDF y PyMuPDF4LLM, que usa MarkItDown: AGPL-3.0 o licencia comercial de Artifex. Tenlo en cuenta si distribuyes el instalador.
- Modelos de spaCy y dependencias de npm y Go: cada uno con su propia licencia.
