---
title: LetXipu Search MCP V11
emoji: "🔬"
colorFrom: green
colorTo: purple
sdk: docker
pinned: false
---

# LetXipu Search MCP V11

[![Production](https://img.shields.io/badge/production-Hugging%20Face-yellow)](https://C2MV-letxipu-search-mcp-v9.hf.space/health)
![MCP tools](https://img.shields.io/badge/MCP_tools-28-4c8bf5)
![Runtime](https://img.shields.io/badge/runtime-Node.js_20+-339933)
![Language](https://img.shields.io/badge/language-TypeScript-3178c6)
![License](https://img.shields.io/badge/license-MIT-green)

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) para búsqueda académica, recuperación de metadatos, resolución de PDF y extracción de documentos. Está diseñado para priorizar repositorios de América Latina y Perú sin perder acceso a fuentes globales.

**Producción:** <https://C2MV-letxipu-search-mcp-v9.hf.space>
**Estado:** <https://C2MV-letxipu-search-mcp-v9.hf.space/health>
**Endpoint MCP:** `POST https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp`

## Qué ofrece

- Búsqueda académica por lotes, con deduplicación y priorización por relevancia.
- Catálogo de fuentes globales, latinoamericanas y de tesis nacionales.
- Metadatos por DOI, título o URL y enriquecimiento de resultados.
- Resolución de DOI/Handle a PDF de acceso abierto cuando existe una ruta disponible.
- Lectura, resumen, secciones, referencias, tablas y fórmulas de PDF.
- Conversión de PDF, DOCX, PPTX, XLSX e imágenes a texto/Markdown.
- Validación de parámetros con Zod y plazos adaptados al cliente MCP.

## Inicio rápido: usar producción

No hace falta instalar nada para consumir el servicio publicado. Envía solicitudes JSON-RPC 2.0 al endpoint MCP.

```bash
curl -X POST https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp \
  -H "content-type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "batch_search",
      "arguments": {
        "queries": ["energía renovable Perú"],
        "sources": ["latam", "global"],
        "maxResults": 10,
        "fastMode": true
      }
    }
  }'
```

Para descubrir el catálogo disponible:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

## Conectar un cliente MCP

Configura el cliente para usar una conexión HTTP al endpoint publicado. El cliente debe enviar JSON-RPC a:

```text
https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp
```

La primera interacción recomendada es `initialize`, seguida de `tools/list`. El servidor acepta además `ping` y `notifications/initialized`.

## Herramientas

El catálogo contiene 28 herramientas. Cinco se conservan por compatibilidad, pero se marcan como descontinuadas en `tools/list`; usa la alternativa sugerida.

| Área | Herramientas recomendadas |
| --- | --- |
| Búsqueda | `batch_search`, `search` |
| Descubrimiento | `list_sources`, `health_check`, `coverage_report`, `help` |
| IA e informática | `search_paperswithcode`, `search_conferences`, `trending_papers` |
| Metadatos | `enrich_metadata` |
| PDF | `resolve_pdf`, `download_pdf`, `read_pdf`, `read_pdf_markdown`, `pdf_metadata`, `pdf_citations`, `pdf_smart_summary` |
| Análisis | `analyze_academic`, `extract_section`, `extract_tables`, `extract_formulas` |
| Conversión | `convert_document`, `batch_convert` |

### Búsqueda

#### `batch_search` — recomendada

Ejecuta una o varias consultas, combina fuentes y elimina duplicados. Es la opción predeterminada para explorar un tema.

```json
{
  "queries": [
    "bacterias promotoras de crecimiento Perú",
    "plant growth promoting bacteria Peru"
  ],
  "sources": ["alicia", "renati", "global"],
  "maxResults": 30,
  "fastMode": true
}
```

Use entre una y tres consultas para operaciones habituales. Incluya región, ciudad o universidad en el texto de la consulta; los campos geográficos complementarios no son filtros estrictos.

#### `search`

Resuelve una consulta única. Es útil para un resultado rápido y dirigido.

```json
{"query":"salud pública Lima","sources":["global"],"maxResults":10,"fastMode":true}
```

### Fuentes especializadas

| Herramienta | Uso |
| --- | --- |
| `search_paperswithcode` | Papers, repositorios, métodos y benchmarks de IA/ML. |
| `search_conferences` | Trabajos de OpenReview, ICLR, NeurIPS e ICML. |
| `trending_papers` | Papers destacados en Hugging Face Daily Papers. |
| `enrich_metadata` | Completa título, autores, resumen, DOI, año y PDF de una lista de papers. |
| `resolve_pdf` | Encuentra una URL de PDF para DOI, Handle o URL. |

Ejemplo de enriquecimiento:

```json
{
  "papers": [
    {"doi":"10.48550/arXiv.1706.03762"}
  ]
}
```

### Lectura y análisis de documentos

Todas las herramientas de esta sección aceptan `source` como URL directa, DOI o ruta local cuando se ejecuta el servidor propio.

| Herramienta | Resultado |
| --- | --- |
| `read_pdf` | Texto o Markdown; permite limitar caracteres y páginas. |
| `read_pdf_markdown` | Conversión estructurada a Markdown. |
| `pdf_smart_summary` | Resumen con secciones relevantes y menor consumo de contexto. |
| `pdf_metadata` | Autor, título, páginas, tamaño y propiedades del PDF. |
| `pdf_citations` | Referencias y citas detectadas. |
| `analyze_academic` | Tipo documental, idioma, secciones y estadísticas. |
| `extract_section` | Una sección por nombre, por ejemplo `metodología` o `results`. |
| `extract_tables` | Tablas en Markdown/HTML cuando el extractor las detecta. |
| `extract_formulas` | Fórmulas detectadas en LaTeX cuando están disponibles. |
| `convert_document` | Conversión de un documento a Markdown/texto. |
| `batch_convert` | Conversión de hasta diez documentos. |

Ejemplo:

```json
{
  "source": "https://arxiv.org/pdf/1706.03762",
  "maxChars": 5000,
  "format": "markdown"
}
```

### Herramientas descontinuadas

| Herramienta | Motivo | Alternativa |
| --- | --- | --- |
| `smart_search` | Relación latencia/calidad inferior en producción. | `batch_search` |
| `pdf_sections` | Puede tardar demasiado en documentos grandes. | `pdf_smart_summary` + `read_pdf_markdown` |
| `search_dblp` | API de DBLP inestable. | `search_conferences` o `search_paperswithcode` |
| `fetch_metadata` | Cadena de recuperación limitada. | `enrich_metadata` |
| `recover_metadata` | Cadena extensa con alta latencia para DOI caídos. | `enrich_metadata` |

## Fuentes y grupos

Las fuentes individuales incluyen OpenAlex, Semantic Scholar, PubMed, arXiv, Crossref, DOAJ, Zenodo, OpenAIRE, CORE, SciELO, Redalyc, ALICIA, RENATI, La Referencia, BDTD, RRAAE, MinCiencias, OpenReview y otras redes nacionales.

| Grupo | Enfoque |
| --- | --- |
| `global` | Índices internacionales y acceso abierto. |
| `latam` | Repositorios y revistas de América Latina. |
| `iberoamerica` | América Latina más España. |
| `tesis` | Tesis y repositorios institucionales. |
| `peru` | RENATI y La Referencia Perú. |
| `brasil`, `mexico`, `argentina`, `colombia`, `chile`, `ecuador` | Cobertura por país. |
| `ai_ml` | arXiv, Papers with Code, Hugging Face, OpenReview y DBLP. |
| `free`, `premium`, `all` | Agrupación por disponibilidad. |

Consulte `list_sources` para el catálogo que está disponible en el momento de la llamada.

## Ejemplos JSON-RPC

### Listar fuentes

```json
{
  "jsonrpc":"2.0",
  "id":1,
  "method":"tools/call",
  "params":{"name":"list_sources","arguments":{}}
}
```

### Resolver un PDF por DOI

```json
{
  "jsonrpc":"2.0",
  "id":2,
  "method":"tools/call",
  "params":{"name":"resolve_pdf","arguments":{"identifier":"10.1038/nature12373"}}
}
```

### Extraer metodología

```json
{
  "jsonrpc":"2.0",
  "id":3,
  "method":"tools/call",
  "params":{
    "name":"extract_section",
    "arguments":{"source":"https://arxiv.org/pdf/1706.03762","section":"methodology"}
  }
}
```

## Ejecutar el proyecto localmente

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

El servidor queda disponible normalmente en `http://localhost:4000`. Para la configuración avanzada de V11 y el proceso de spaCy, revise `.env.example`, `start_v11.bat` y `PLAN_V11.md`.

### Variables de entorno

| Variable | Necesaria | Uso |
| --- | --- | --- |
| `PORT` | No | Puerto HTTP; por defecto `4000`. |
| `MINERU_API_KEY` | No | OCR y extracción avanzada con MinerU. |
| `MINERU_API_URL` | No | Endpoint de MinerU. |
| `CORE_API_KEY` | No | Acceso a CORE. |
| `SCOPUS_API_KEY` | No | Búsqueda Scopus. |
| `SEMANTIC_SCHOLAR_API_KEY` | No | Mayor cuota de Semantic Scholar. |
| `SERPAPI_KEY` | No | Integración opcional con SerpApi. |
| `SPACY_PORT` | No | Puerto del proceso spaCy opcional. |

No incluya claves en el repositorio. En Vercel, configúrelas como variables de entorno del proyecto.

## Despliegue en Vercel

El archivo `vercel.json` envía las rutas API al controlador del proyecto. Al conectar el repositorio GitHub, cada envío a la rama configurada crea un despliegue de Vercel.

Después de publicar, verifique:

```powershell
Invoke-WebRequest https://letxinet-mcp.vercel.app/health -UseBasicParsing
```

Una respuesta correcta informa `status: "ok"`, la versión del servicio y el número de herramientas.

## Pruebas inteligentes en producción

La prueba integral se ejecuta **contra Vercel**, no contra una instancia local. Comprueba las 23 herramientas activas con fixtures abiertos y deja dos informes (JSON y Markdown) en `scripts/`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-pool-v6-all-tools.ps1 `
  -BaseUrl "https://letxinet-mcp.vercel.app" `
  -Runs 1 -TimeoutSec 150 -SkipDeprecated
```

Para revisar únicamente disponibilidad y el catálogo remoto:

```powershell
Invoke-WebRequest https://letxinet-mcp.vercel.app/health -UseBasicParsing
```

### Resultado de la última verificación

Fecha: **2026-07-27**. La prueba contra Vercel confirmó respuestas útiles de `batch_search`, diagnóstico, resolución de PDF y la mayor parte del flujo de lectura/análisis. El fixture de *Attention Is All You Need* devolvió cero tablas y fórmulas; eso es un resultado válido del extractor, no un error de transporte.

La misma prueba detectó respuestas MCP sin contenido para seis herramientas basadas en rutas internas (`search`, las tres búsquedas especializadas, `enrich_metadata` y `download_pdf`) en el entorno serverless. El adaptador se comporta correctamente en la verificación de código, por lo que este punto se documenta como una limitación específica de Vercel pendiente de seguimiento. Use `batch_search` y `resolve_pdf` como rutas de producción mientras se investiga.

## Diagnóstico

| Síntoma | Acción recomendada |
| --- | --- |
| Búsqueda lenta | Reduzca fuentes y consultas; use `fastMode: true`. |
| Sin resultados de una fuente | Pruebe otro grupo o fuente individual; algunos repositorios bloquean tráfico automatizado. |
| PDF sin tablas o fórmulas | Pruebe un PDF con estructura nativa o habilite MinerU. |
| DOI sin PDF | El documento puede no ser de acceso abierto; use el metadato devuelto. |
| Error de validación | Revise el mensaje y el ejemplo que entrega el servidor. |

## Arquitectura

```text
Cliente MCP
   │ JSON-RPC 2.0
   ▼
/api/mcp ── validación ── límites adaptativos ── caché
   │
   ├── búsqueda académica y repositorios
   ├── metadatos y resolución de DOI/PDF
   └── lectura y conversión documental
          ├── MinerU (si está configurado)
          └── pdf-parse / extractores locales
```

## Estructura del repositorio

```text
api/                 Entrada serverless de Vercel
src/routes/          MCP, búsqueda, metadatos, PDF y fuentes
src/providers/       Conectores a proveedores y extractores
src/utils/           Validación, caché, límites, métricas y NLP
src/python/          Servicio spaCy opcional
scripts/             Pruebas de regresión y cobertura
tests/               Pruebas de unidades
```

## Licencia

MIT. Copyright (c) 2026 Crhistian Montenegro / LetXipu Project.
