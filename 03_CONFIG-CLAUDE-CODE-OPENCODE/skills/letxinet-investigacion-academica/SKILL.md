---
name: letxinet-investigacion-academica
description: "Investigación académica profunda con LetXinet Suite: buscar papers y tesis (repositorios peruanos vía RENATI y La Referencia Perú), verificar referencias y DOI, resolver y leer PDFs desde handles, DOIs y repositorios institucionales, extraer secciones, tablas y resultados. Úsala para tesis, antecedentes, marco teórico, verificación bibliográfica o revisión de literatura."
---

> **Adaptación a Claude Code (01/11/2026).** Esta skill viene de OpenCode (escrita para letxipu v7/v8). En esta máquina:
>
> - **Nombres de herramientas:** `letxipu-search:<tool>` / `letxipu-v11-local` → `mcp__letxinet-v11__<tool>`; `letxipu-osm:<tool>` → `mcp__letxinet-osm__<tool>`; conversión → `mcp__letxinet-markitdown__markitdown_convert`. Son *deferred*: cárgalas con ToolSearch (`select:...`) antes de llamarlas.
> - **Tareas largas:** para `smart_search` y `batch_search` usa `mcp__letxinet-jobs__letxipu_local_call` (lanza un job en segundo plano) y recoge el resultado con `mcp__letxinet-jobs__gateway_poll` a los 30–60 s. `gateway_call` requiere el gateway en :3000, que normalmente está apagado.
> - **Estado verificado el 01/11/2026** (V11 v11.0.0, 28 tools, 39 fuentes):
>   - Funcionan: `search` con `sources:["crossref"]`/`["laref_peru"]`/`["renati"]` + `fastMode:true`, `fetch_metadata`, `recover_metadata`, `list_sources`, `resolve_pdf`, `read_pdf`, `extract_section`, `extract_tables`, `pdf_smart_summary`, `pdf_metadata`.
>   - **ALICIA falla** (timeout de 90 s, aunque el portal esté en línea): no la uses; el grupo `peru_fast` incluye ALICIA y tarda 90 s. Para Perú usa `["laref_peru","renati"]` (grupo `peru`). RENATI tarda ~30 s.
>   - **spaCy está DESACTIVADO** (interruptor `MCP-V11-Local\SPACY_DISABLED`, V11 en modo JSON-only). Con eso `filterFalsePositives:true` funciona (~11 s) y `smart_search` funciona pero tarda ~90 s: lánzalo con `letxinet-jobs`.
>   - `batch_search` funciona pero tarda ~200 s incluso con 1 consulta y fuentes rápidas: úsalo SIEMPRE vía `letxinet-jobs`. `search` sin `sources` supera su límite de 114 s: indica siempre las fuentes.
>   - **No uses `enrich_metadata` sin revisar el resultado:** puede adjuntar abstracts de otros artículos a referencias inexistentes. Verifica los DOI con `fetch_metadata` (Crossref).
>   - `download_pdf` no guarda el archivo (solo devuelve el enlace): descarga con curl desde la URL que da `resolve_pdf`. Ninguna herramienta de conversión acepta .docx.
>   - `search_dblp`, `search_paperswithcode` y `coverage_report` no funcionan. `health_check` dice «ok» sin revisar las fuentes.
>   - OSM: Overpass suele estar caído (fallan `find_nearby_*`, `explore_area`, `osm_query_bbox`, `polygon_from_admin`); rutas, geocodificación inversa y geometría funcionan; `geocode_address` a veces descarta resultados válidos.
>   - El repositorio de la UNT (dspace.unitru.edu.pe) no respondía desde esta red.
>
> Informe completo: `C:/Users/USER/Downloads/TESIS/apoyo-claude-code/pruebas-herramientas/INFORME_LETXINET_SUITE.docx`. Si pasa más de un mes, vuelve a verificar antes de confiar en las tablas de abajo.


# Skill: Websearch Inteligente & Deep Researcher v13
## PDF Handle Downloader · 110+ Repos Peruanos · letxipu MCP v7 · 100% Probado en Producción

---

## ⚙️ ESTADO REAL DEL MCP (health_check en producción — 2026-06-28)

```
Servidor: letxipu MCP v7 · Versión: 5.0.0 · Tools: 27

ONLINE:  ✅ ALICIA ~159ms · ✅ RENATI ~219ms · ✅ La Referencia ~271ms
         ✅ PubMed ~175ms · ✅ arXiv ~56ms · ✅ RRAAE ~482ms
         ✅ BDTD ~545ms · ✅ Crossref ~884ms

PROBLEMAS: ⚠️ OpenAlex ERROR (retorna 0 resultados)
           ❌ DBLP OFFLINE (fetch aborted, retorna [] siempre)

API KEYS: SCOPUS · Semantic Scholar · CORE · SerpAPI (Google Scholar)
```

---

## ⚙️ INVENTARIO COMPLETO — 27 herramientas (parámetros y respuestas verificados)

### ⚠️ CRÍTICO: CAMPOS DE RESPUESTA (inconsistentes — causa bugs silenciosos)

```
batch_search       → data.results[]      ← DISTINTO al resto
search             → data.sources[]
trending_papers    → data.sources[]
search_conferences → data.sources[]
search_paperswithcode → data.sources[]
search_dblp        → data.sources[] (OFFLINE — siempre vacío)
analyze_academic   → data.sections[] + data.globalStatistics[] + data.summary{}
pdf_smart_summary  → data.sections[] (previews breves, sin statistics)
extract_section    → data.section{} + data.found + data.availableSections[]
pdf_citations      → data.citations[] + data.totalCitations
pdf_metadata       → data.{title,author,creator,pages,fileSize,...} (directos en data)
list_sources       → data.sources[] + data.groups{}
health_check       → data.server{} + data.sources{} + data.apiKeys{}
download_pdf       → data.pdfUrl   ← SOLO retorna URL, no descarga
fetch_metadata     → data.{id,title,authors,year,abstract,pdfUrl,...,completenessScore}
```

---

### 🔍 BÚSQUEDA ACADÉMICA (verificadas en producción)

```
letxipu:batch_search          ✅ HERRAMIENTA PRINCIPAL — paralela, hasta 6 queries
  queries: string[]           ← REQUERIDO. Hasta 6 en paralelo.
  sources?: string[]          ← Ver grupos abajo. Default: global
  university?: string         ← Filtrar por institución
  yearStart?: string / yearEnd?: string
  maxResults?: number         ← Default 60, max 120
  → data.results[] (NO data.sources)
  → Campos por resultado: id, title, authors[], year, abstract, pdfUrl,
    handleUrl, source, type, university, citationCount, doi, matchedQueries[]

letxipu:search                ✅ Búsqueda single-query
  query: string               ← REQUERIDO
  sources?: string[] / university?: string / yearStart?: string / maxSources?: number
  → data.sources[] (NO data.results)

letxipu:smart_search          ❌ TIMEOUT SIEMPRE — NO USAR
  → Reemplazar siempre con: batch_search(queries=[variante1, variante2,...])

letxipu:search_dblp           ❌ OFFLINE PERMANENTE — NO USAR
  → Retorna data.sources[] vacío siempre. Verificar con health_check antes de reintentar.

letxipu:search_conferences    ✅ OpenReview (ICLR, NeurIPS, ICML, ICCV...)
  query: string               ← REQUERIDO
  maxResults?: number
  → data.sources[]

letxipu:search_paperswithcode ✅ funciona / ⚠️ puede retornar [] con queries genéricas
  query: string               ← REQUERIDO
  → data.sources[]

letxipu:trending_papers       ✅ HuggingFace Daily Papers
  query: string               ← REQUERIDO — ⚠️ "Missing query" si se omite
  maxResults?: number
  → data.sources[] con campo snippet (upvotes HF)

letxipu:list_sources          ✅ sin parámetros → data.sources[] + data.groups{}
letxipu:health_check          ✅ sin parámetros → data.server{} + data.sources{} + data.apiKeys{}
letxipu:help                  ✅ topic?: "search"|"batch_search"|"all"
```

---

### 📦 GRUPOS DE FUENTES (de list_sources — verificado con IDs exactos)

```
"peru"         → ["alicia", "renati", "laref_peru"]
               ← MEJOR para tesis peruanas: 3 fuentes precisas sin ruido

"tesis"        → ["alicia","renati","bdtd","rraae","lareferencia","snrd",
                   "minciencias","espana","costarica","uruguay","elsalvador"]
               ⚠️ "rraae" (Ecuador) genera resultados irrelevantes para Perú
               → Uso: sources=["alicia","renati","bdtd"] para evitar ruido Ecuador

"latam"        → todo "tesis" + ["conacyt","unam","anid","oasisbr","scielo","redalyc"]
"iberoamerica" → latam + "espana"
               ⚠️ Evitar para temas de Perú — demasiado ruido de Ecuador/España

"global"       → ["semantic","openalex","pubmed","crossref","doaj","zenodo","openaire","core"]
               ⚠️ OpenAlex ERROR actualmente → global retorna menos resultados

"ai_ml"        → ["arxiv","huggingface","paperswithcode","openreview","dblp"]
               ⚠️ DBLP OFFLINE — los demás funcionan

"all"          → 39 fuentes totales (incluye las con problemas)

COMBINACIONES RECOMENDADAS SEGÚN OBJETIVO:
  Solo Perú puro:           sources=["alicia","renati"]
  Perú + tesis LatAm:       sources=["peru","tesis"]         ← más común
  Perú + sin ruido Ecuador: sources=["alicia","renati","bdtd","lareferencia"]
  Perú + internacional:     sources=["peru","tesis","global"]
  Solo artículos globales:  sources=["global"]
  IA/ML:                    sources=["ai_ml"]  (sin DBLP en la práctica)
```

---

### 📄 LECTURA Y ANÁLISIS DE PDF (todos probados en producción con arXiv)

```
letxipu:pdf_smart_summary     ✅ PRIMER PASO — resumen rápido, token-eficiente
  source: string              ← URL directa del PDF o DOI — REQUERIDO
  maxTotalChars?: number      ← Default 8000
  → data.documentType, data.language, data.pages, data.totalWords, data.format
  → data.sections[]{name, category, preview}
  ← Retorna previews breves (no el contenido completo)
  ← SIN data.statistics — usar analyze_academic para estadísticas

letxipu:analyze_academic      ✅✅ MÁS POTENTE — estadísticas automáticas completas
  source: string              ← URL directa del PDF — REQUERIDO
  → data.documentType, data.language, data.pages, data.totalWords
  → data.sections[]{name, category, contentPreview, contentLength,
    hasNumericalData, statistics[]{type, matches[], count}}
  → data.globalStatistics[] — TODOS los stats del doc detectados:
    Tipos detectados: percentage, p-value, regression, anova, chi2, OR,
    t_test, n_sample, table_reference, figure_reference
  → data.summary{totalSections, sectionsWithStats, totalStatisticalItems,
    detectedCategories[]}
  ← La misma sección puede aparecer MÚLTIPLES VECES (subdivisiones del PDF)
  ← Usar para: estadísticas, categorías de secciones, documento con datos cuantitativos

letxipu:extract_section       ✅✅ Sección específica SIN límite de tokens
  source: string              ← REQUERIDO
  section: string             ← REQUERIDO. Valores que funcionan:
                                "abstract" | "metodología" | "resultados" |
                                "conclusiones" | "marco teórico" | "discusión" |
                                "introducción" | "planteamiento del problema"
  → data.found (bool) ← true/false si encontró la sección
  → data.section{name, category, content, contentLength, statistics[]}
  → data.availableSections[] ← lista de secciones que SÍ tiene el doc
  ← Si data.found == false: ver data.availableSections[] para saber qué buscar
  ← content es el texto COMPLETO de la sección, sin truncar

letxipu:read_pdf_markdown     ✅ Texto completo como Markdown estructurado
  source: string              ← REQUERIDO. URL directa del PDF.
  maxChars?: number           ← Default 30000
  pages?: string              ← "1-5" | "1,3,7" | "last3" | "first5"
  → data (texto markdown)

letxipu:read_pdf              ✅ Alternativa a read_pdf_markdown
  source: string / format?: "markdown"|"text" / maxChars?: number / pages?: string

letxipu:pdf_sections          ❌ TIMEOUT SIEMPRE — NO USAR
  → Reemplazar con: analyze_academic → ver data.summary.detectedCategories
    o extract_section → ver data.availableSections[]

letxipu:pdf_citations         ✅ FUNCIONA — extrae referencias bibliográficas
  source: string              ← REQUERIDO
  → data.citations[]{index, text, authors, year}
  → data.totalCitations
  ✅ Con arXiv/PDFs internacionales: extrae 77+ citas con texto completo
  ⚠️ Con tesis peruanas en .edu.pe: frecuentemente retorna []
  ← El campo "authors" solo captura la primera letra del primer autor ("S", "H"...)
  ← No confiar en el campo authors para búsquedas; usar el texto completo

letxipu:pdf_metadata          ✅ FUNCIONA — metadatos del archivo PDF
  source: string              ← REQUERIDO
  → data.{title, author, subject, creator, producer, creationDate,
    modificationDate, pages, fileSize}
  ⚠️ title y author VACÍOS frecuentemente en tesis peruanas (no embebidos en PDF)
  ✅ pages y fileSize siempre presentes
  ← creator suele ser el software (Nitro Pro, Word, LaTeX, etc.)

letxipu:convert_document      ✅ OCR con MinerU (109 idiomas) — para PDFs escaneados
  source: string              ← REQUERIDO
  maxChars?: number           ← Default 30000
  ← USAR cuando read_pdf o analyze_academic retornan texto vacío o ilegible

letxipu:batch_convert         ✅ hasta 10 docs en paralelo
  sources: string[]           ← REQUERIDO (max 10 URLs/DOIs)
  maxCharsPerDoc?: number     ← Default 10000
```

---

### 🔗 METADATA Y RESOLUCIÓN DE PDF (comportamiento real verificado)

```
letxipu:resolve_pdf           ✅ CON DOIs OA · ❌ NO con URLs .edu.pe
  identifier: string          ← REQUERIDO: preferir DOI
  ✅ DOI Open Access → pdfUrl directo via Unpaywall
     Ejemplo: "10.17268/sci.agropecu.2015.04.02" → URL de descarga inmediata
  ❌ URL repo peruano → data.pdfUrl: null SIEMPRE
  → data.{pdfUrl, resolvedFrom, doi, steps[]}

letxipu:download_pdf          ✅ 9 fuentes incluyendo Sci-Hub / ⚠️ ADVERTENCIA
  doi?: string / url?: string
  → data.pdfUrl  ← SOLO retorna la URL, NO descarga el archivo
  ⚠️ Con URL de repo peruano: devuelve la misma URL del repo (no el bitstream)
  ⚠️ Con DOI: igual que resolve_pdf pero puede tener más fuentes (Sci-Hub)
  ← Diferencia vs resolve_pdf: download_pdf intenta más fuentes pero misma limitación .edu.pe

letxipu:recover_metadata      ❌ NO FUNCIONA con repos peruanos · ✅ parcial con DOI
  doi?: string / url?: string / title?: string
  ✅ Con DOI bien conocido → puede recuperar abstract y year (completenessScore ~65)
  ❌ URL repo .edu.pe → completenessScore 15, todos los campos vacíos SIEMPRE
  ❌ Con título → completenessScore 15, no busca en bases de datos

letxipu:fetch_metadata        ❌ NO FUNCIONA en ningún caso probado
  doi?: string / url?: string / title?: string
  → completenessScore 15, enrichedFields:[], pdfUrl: null SIEMPRE
  ← Herramienta defectuosa — no usar para recuperar metadatos

letxipu:enrich_metadata       ✅ CON DOIs · ⚠️ BUG: duplica papers en respuesta
  papers: array               ← [{title?, doi?, url?}, ...] max ~10
  ✅ Con DOI → abstract + year recuperados
  ❌ Sin DOI → no enriquece nada
  ⚠️ BUG CONFIRMADO: data.papers[] contiene cada paper DUPLICADO
    SOLUCIÓN: usar Set() o filtrar por title para deduplicar antes de procesar
```

---

## ⚠️ VERDADES ABSOLUTAS — 100% VERIFICADAS EN PRODUCCIÓN

```
FUNCIONA:
  ✅ batch_search(sources=["peru","tesis"])     → ALICIA+RENATI, campo data.results[]
  ✅ search(sources=["peru"])                   → ALICIA+RENATI, campo data.sources[]
  ✅ resolve_pdf("10.xxx/DOI_OA")              → pdfUrl via Unpaywall inmediato
  ✅ pdf_smart_summary(URL_PDF_PUBLICA)         → resumen con secciones y previews
  ✅ analyze_academic(URL_PDF_PUBLICA)          → secciones + globalStatistics[] ✅✅
  ✅ extract_section(URL_PDF, sección)          → texto completo + availableSections[]
  ✅ read_pdf_markdown(URL_PDF_PUBLICA)         → texto completo markdown
  ✅ pdf_citations(URL_PDF_PUBLICA)             → citas con texto completo (arXiv: 87+)
  ✅ pdf_metadata(URL_PDF_PUBLICA)              → pages + fileSize siempre
  ✅ convert_document(URL_PDF_ESCANEADO)        → OCR MinerU 109 idiomas
  ✅ enrich_metadata(papers_con_doi)            → abstract+year (deduplicar output)
  ✅ trending_papers(query="tema")              → query ES OBLIGATORIO
  ✅ search_conferences(query="tema")           → OpenReview funciona
  ✅ list_sources() / health_check()            → sin parámetros, funcionan

NO FUNCIONA:
  ❌ smart_search(...)                          → TIMEOUT >4min SIEMPRE
  ❌ pdf_sections(...)                          → TIMEOUT >4min SIEMPRE
  ❌ search_dblp(...)                           → OFFLINE, vacío SIEMPRE
  ❌ fetch_metadata(cualquier cosa)             → score 15, vacío SIEMPRE
  ❌ resolve_pdf(URL_repo_.edu.pe)              → pdfUrl null SIEMPRE
  ❌ recover_metadata(URL_repo_.edu.pe)         → score 15, vacío SIEMPRE
  ❌ download_pdf(URL_repo_.edu.pe)             → devuelve misma URL del repo
  ❌ trending_papers() sin query                → error "Missing query field"
  ❌ bash wget/curl en .edu.pe                  → 403 host_not_allowed SIEMPRE
  ❌ cualquier herramienta PDF con URL .edu.pe  → "Could not obtain the PDF"

LIMITACIÓN CRÍTICA DEL SERVIDOR MCP:
  ⚠️ El servidor letxipu NO puede descargar PDFs desde dominios .edu.pe peruanos,
     revistas alojadas en .edu.pe, ni la mayoría de repos universitarios peruanos.
  ✅ FUNCIONA con: arXiv, PubMed, DOIs OA (Unpaywall), PDFs en servidores globales.
  ✅ PARA REPOS PERUANOS: usar web_fetch(URL_BITSTREAM) que SÍ puede acceder.

BUGS CONOCIDOS:
  ⚠️ enrich_metadata → duplica cada paper en data.papers[] → deduplicar por title
  ⚠️ pdf_citations → campo "authors" solo captura inicial del apellido (no usar)
  ⚠️ analyze_academic → misma sección puede aparecer múltiples veces (subdivisiones)
  ⚠️ sources=["iberoamerica"] → mucho ruido Ecuador/España para Perú
  ⚠️ OpenAlex → ERROR actualmente → sources=["global"] retorna menos resultados
```

---

## FASE 0 — Leer PDF desde Handle / DOI / URL de Repositorio

### PASO 0.0 — Árbol de decisión de acceso al PDF

```
¿Tiene DOI?
  → letxipu:resolve_pdf(identifier="10.xxx/xxx")
  → Si data.pdfUrl != null (OA):
      letxipu:pdf_smart_summary(source=data.pdfUrl)   ← resumen rápido
      letxipu:analyze_academic(source=data.pdfUrl)     ← estadísticas
      letxipu:extract_section(source=data.pdfUrl, section="resultados")
  → Si data.pdfUrl == null (cerrado):
      letxipu:download_pdf(doi="10.xxx/xxx")           ← intenta Sci-Hub + 8 fuentes

¿Es URL de repo peruano (.edu.pe/handle/...)?
  → NO usar resolve_pdf, recover_metadata, fetch_metadata (siempre fallan)
  → NO usar herramientas PDF de letxipu directamente (no accede a .edu.pe)
  → USAR: web_fetch(URL_REPO) → extraer URL del bitstream del HTML
  → Con bitstream encontrado: web_fetch(URL_BITSTREAM) → texto del PDF
  → El texto del PDF llega en formato HTML que Claude puede leer directamente

¿Es URL de arXiv, PubMed, revista internacional?
  → letxipu funciona directamente sin pasos intermedios:
  → pdf_smart_summary → analyze_academic → extract_section → pdf_citations
```

### PASO 0.1 — Identificar tipo de enlace

```
¿Contiene "hdl.handle.net" o "/handle/<prefijo>/"? → extraer prefijo → PASO 0.2
¿Contiene "alicia.concytec.gob.pe"?               → PASO 0.2-ALICIA
¿Es DOI (doi.org / 10.xxx)?                       → resolve_pdf(DOI) directo
¿Termina en .pdf o contiene /bitstream/?           → es URL_BITSTREAM → PASO 0.4
¿Es IST/escuela sin DSpace?                        → Estrategia D
¿Es arXiv/PubMed/revista global?                   → letxipu directo, sin pasos
```

---

### PASO 0.2 — Mapa Completo de Repositorios Peruanos

#### 🏛️ A. Universidades Nacionales (35)

| Prefijo | URL base | Universidad | Sistema | web_fetch | letxipu |
|---------|----------|-------------|---------|-----------|---------|
| `20.500.12672` | `https://cybertesis.unmsm.edu.pe/handle` | UNMSM | DSpace 7 | ⚠️ JS | ❌ |
| `20.500.14076` | `https://cybertesis.uni.edu.pe/handle` | UNI | DSpace 6 | ✅ | ❌ |
| `20.500.12996` | `https://repositorio.lamolina.edu.pe/handle` | UNALM | DSpace 6 | ✅ | ❌ |
| `20.500.12773` | `https://repositorio.unsa.edu.pe/handle` | UNSA | DSpace 6 | 🔴 robots | ❌ |
| `20.500.14414` | `https://dspace.unitru.edu.pe/handle` | UNT (Trujillo) | DSpace 6 | ✅ | ❌ |
| `20.500.12918` | `https://repositorio.unsaac.edu.pe/handle` | UNSAAC | DSpace 6 | ✅ | ❌ |
| `20.500.14278` | `https://repositorio.uns.edu.pe/handle` | UNS (Chimbote) | DSpace 6 | ✅* | ❌ |
| `20.500.12894` | `https://repositorio.uncp.edu.pe/handle` | UNCP | DSpace 6 | ✅ | ❌ |
| `20.500.12893` | `https://repositorio.unap.edu.pe/handle` | UNAP Puno | DSpace 6 | ✅ | ❌ |
| `20.500.12737` | `https://repositorio.unapiquitos.edu.pe/handle` | UNAP Iquitos | DSpace 6 | ✅ | ❌ |
| `11458` | `https://repositorio.unsm.edu.pe/handle` | UNSM | DSpace 6 | ✅ | ❌ |
| `20.500.12958` | `https://repositorio.unsch.edu.pe/handle` | UNSCH | DSpace 6 | ✅ | ❌** |
| `20.500.13028` | `https://repositorio.unica.edu.pe/handle` | UNICA | DSpace 6 | ✅ | ❌ |
| `20.500.14067` | `https://repositorio.unjfsc.edu.pe/handle` | UNJFSC | DSpace 6 | ✅ | ❌ |
| `20.500.14139` | `https://repositorio.unasam.edu.pe/handle` | UNASAM | DSpace 7 | ✅ | ❌ |
| `20.500.12952` | `https://repositorio.unac.edu.pe/handle` | UNAC | DSpace 6 | ✅ | ❌ |
| `20.500.12897` | `https://repositorio.unp.edu.pe/handle` | UNP | DSpace 6 | ✅ | ❌ |
| `20.500.12819` | `https://repositorio.unjbg.edu.pe/handle` | UNJBG | DSpace 6 | ✅ | ❌ |
| `20.500.12953` | `https://repositorio.unamba.edu.pe/handle` | UNAMBA | DSpace 6 | ✅ | ❌ |
| `20.500.13080` | `https://repositorio.unh.edu.pe/handle` | UNH | DSpace 6 | ✅ | ❌ |
| `20.500.14077` | `http://repositorio.untrm.edu.pe/handle` | UNTRM | DSpace 6 | ✅ | ❌ |
| `20.500.13063` | `https://repositorio.undac.edu.pe/handle` | UNDAC | DSpace 6 | ✅ | ❌ |
| `20.500.14213` | `https://repositorio.unajma.edu.pe/handle` | UNAJMA | DSpace 6 | ✅ | ❌ |
| `20.500.14070` | `https://repositorio.unamad.edu.pe/handle` | UNAMAD | DSpace 6 | ✅ | ❌ |
| `20.500.14171` | `https://repositorio.undc.edu.pe/handle` | UNDC | DSpace 6 | ✅ | ❌ |
| `20.500.13084` | `https://repositorio.unfv.edu.pe/handle` | UNFV | DSpace 6 | ✅ | ❌ |
| `20.500.14039` | `https://repositorio.une.edu.pe/handle` | UNE | DSpace 6 | ✅ | ❌ |
| `20.500.14074` | `https://repositorio.unj.edu.pe/handle` | UNJ | DSpace 6 | ✅ | ❌ |
| `20.500.14229` | `https://repositorio.unia.edu.pe/handle` | UNIA | DSpace 6 | ✅ | ❌ |
| `20.500.14253` | `https://repositorio.unaaa.edu.pe/handle` | UNAAA | DSpace 6 | ✅ | ❌ |
| `20.500.14235` | `https://repositorio.unfc.edu.pe/handle` | UNFC | DSpace 6 | ✅ | ❌ |
| `20.500.14287` | `https://repositorio.uniq.edu.pe/handle` | UNIQ | DSpace 6 | ✅ | ❌ |
| `20.500.14250` | `https://repositorio.unifslb.edu.pe/handle` | UNIFSLB | DSpace 6 | ✅ | ❌ |
| `20.500.14206` | `https://repositorio.unab.edu.pe/handle` | UNAB | DSpace 6 | ✅ | ❌ |
| `20.500.14073` | `https://repositorio.uniscjsa.edu.pe/handle` | UNISCJSA | DSpace 6 | ✅ | ❌ |

*UNS: web_fetch devuelve HTML pero SIN link visible al bitstream.
**UNSCH: funcionó intermitentemente en pruebas anteriores, ahora falla. No confiar.

#### 🎓 B. Universidades Privadas (38)

| Prefijo | URL base | Universidad | Sistema | web_fetch | letxipu |
|---------|----------|-------------|---------|-----------|---------|
| `20.500.12404` | `https://tesis.pucp.edu.pe/repositorio/handle` | PUCP | DSpace 7 | ✅ UUID | ❌ |
| `20.500.12866` | `https://repositorio.upch.edu.pe/handle` | Cayetano Heredia | DSpace 6 | ✅ | ❌ |
| `11354` | `https://repositorio.up.edu.pe/handle` | U. del Pacífico | DSpace 7 | ⚠️ JS | ❌ |
| `20.500.12724` | `https://repositorio.ulima.edu.pe/handle` | U. de Lima | DSpace 6 | ✅ | ❌ |
| `10757` | `https://repositorioacademico.upc.edu.pe/handle` | UPC | DSpace 6 | ✅ | ❌ |
| `20.500.12727` | `https://repositorio.usmp.edu.pe/handle` | USMP | DSpace 6 | ✅ | ❌ |
| `20.500.12692` | `https://repositorio.ucv.edu.pe/handle` | UCV | DSpace 6 | 🔴 Anubis | ❌ |
| `11537` | `https://repositorio.upn.edu.pe/handle` | UPN | DSpace 6 | ✅ | ❌ |
| `20.500.14138` | `https://repositorio.urp.edu.pe/handle` | URP | DSpace 6 | ✅ | ❌ |
| `20.500.14005` | `https://repositorio.usil.edu.pe/handle` | USIL | DSpace 6 | ✅ | ❌ |
| `20.500.12867` | `https://repositorio.utp.edu.pe/handle` | UTP | DSpace 6 | ✅ | ❌ |
| `20.500.12920` | `https://repositorio.ucsm.edu.pe/handle` | UCSM | DSpace 6 | ✅ | ❌ |
| `11042` | `https://pirhua.udep.edu.pe/handle` | UDEP | DSpace 6 | ✅ | ❌ |
| `20.500.12394` | `https://repositorio.continental.edu.pe/handle` | U. Continental | DSpace 6 | 🔴 Anubis | ❌ |
| `20.500.12759` | `https://repositorio.upao.edu.pe/handle` | UPAO | DSpace 7 | ⚠️ JS | ❌ |
| `20.500.12840` | `https://repositorio.upeu.edu.pe/handle` | UPEU | DSpace 6 | 🔴 robots | ❌ |
| `20.500.12802` | `https://repositorio.uss.edu.pe/handle` | USS | DSpace 6 | 🔴 Anubis | ❌ |
| `20.500.12990` | `https://repositorio.uap.edu.pe/handle` | UAP | DSpace 6 | ✅ | ❌ |
| `20.500.13032` | `https://repositorio.uladech.edu.pe/handle` | ULADECH | DSpace 6 | ✅ | ❌ |
| `20.500.14257` | `https://repositorio.udh.edu.pe/handle` | UDH | DSpace 6 | ✅ | ❌ |
| `20.500.12557` | `https://repositorio.uandina.edu.pe/handle` | U. Andina Cusco | DSpace 6 | ✅ | ❌ |
| `20.500.12715` | `https://repositorio.cientifica.edu.pe/handle` | U. Científica Sur | DSpace 6 | ✅ | ❌ |
| `20.500.12640` | `https://repositorio.esan.edu.pe/handle` | ESAN | DSpace 6 | ✅ | ❌ |
| `20.500.12590` | `https://repositorio.ucsp.edu.pe/handle` | UCSP | DSpace 6 | ✅ | ❌ |
| `20.500.12815` | `https://repositorio.utec.edu.pe/handle` | UTEC | DSpace 6 | ✅ | ❌ |
| `20.500.14140` | `https://repositorio.ucss.edu.pe/handle` | UCSS | DSpace 6 | ✅ | ❌ |
| `20.500.12848` | `https://repositorio.upla.edu.pe/handle` | UPLA | DSpace 6 | ✅ | ❌ |
| `20.500.11955` | `https://repositorio.unife.edu.pe/handle` | UNIFÉ | DSpace 6 | ✅ | ❌ |
| `20.500.14308` | `https://repositorio.upsjb.edu.pe/handle` | UPSJB | DSpace 6 | ✅ | ❌ |
| `20.500.12969` | `https://repositorio.upt.edu.pe/handle` | UPT | DSpace 6 | ✅ | ❌ |
| `20.500.13053` | `https://repositorio.uwiener.edu.pe/handle` | U. Norbert Wiener | DSpace 6 | ✅ | ❌ |
| `20.500.14142` | `https://repositorio.upagu.edu.pe/handle` | UPAGU | DSpace 6 | ✅ | ❌ |
| `20.500.11818` | `https://repositorio.uigv.edu.pe/handle` | UIGV | DSpace 6 | ✅ | ❌ |
| `20.500.13067` | `https://repositorio.autonoma.edu.pe/handle` | U. Autónoma Perú | DSpace 6 | ✅ | ❌ |
| `20.500.14412` | `https://repositorio.univ.edu.pe/handle` | U. Negocios ISIL | DSpace 6 | ✅ | ❌ |
| `20.500.14395` | `https://repositorio.ucal.edu.pe/handle` | UCAL | DSpace 6 | ✅ | ❌ |
| `20.500.12816` | `https://repositorio.ugm.edu.pe/handle` | UGM | DSpace 6 | ✅ | ❌ |
| `20.500.14330` | `https://repositorio.ucontinental.edu.pe/handle` | U. Continental (nuevo) | DSpace 6 | ⚠️ | ❌ |

#### 🏢 C. IST / ISEP

| Institución | Método |
|-------------|--------|
| TECSUP | `https://repositorio.tecsup.edu.pe/` DSpace 6 → web_fetch ✅ |
| SENATI, CIBERTEC, CERTUS, IDAT, SISE, ISPs varios | Sin DSpace → Estrategia D |

#### 🔬 D. Estado / FF.AA. / Salud / Ciencia

| Prefijo | URL | Institución | web_fetch | letxipu |
|---------|-----|-------------|-----------|---------|
| `20.500.12932` | `https://repositorio.caen.edu.pe/handle` | CAEN | ✅ | ❌ |
| `20.500.12390` | `https://repositorio.concytec.gob.pe/handle` | CONCYTEC | ✅ | ❌ |
| `20.500.12955` | `https://repositorio.inia.gob.pe/handle` | INIA | ✅ | ❌ |
| `20.500.14196` | `https://repositorio.ins.gob.pe/handle` | INS | ✅ | ❌ |
| `20.500.12542` | `https://repositorio.senamhi.gob.pe/handle` | SENAMHI | ✅ | ❌ |
| `20.500.12799` | `https://repositorio.minedu.gob.pe/handle` | MINEDU | ✅ | ❌ |
| `20.500.14215` | `https://repositorio.imarpe.gob.pe/handle` | IMARPE | ✅ | ❌ |
| `123456789` | `http://dspace.ipen.gob.pe/handle` | IPEN | ✅ | ❌ |
| — | `https://repositorio.bcrp.gob.pe/` | BCRP | Portal ✅ | — |
| — | `https://www.inei.gob.pe/biblioteca-virtual/` | INEI | Portal ✅ | — |

#### 📚 E. Agregadores y Portales Nacionales

| Portal | URL | Uso |
|--------|-----|-----|
| **ALICIA** | `https://alicia.concytec.gob.pe` | 400k+ registros — fallback universal ✅✅ |
| **RENATI** | `https://renati.sunedu.gob.pe` | Metadatos + link a repo institucional |
| **SciELO** | `https://www.scielo.org.pe` | Artículos OA revisados |
| **CTI Vitae** | `https://ctivitae.concytec.gob.pe` | Por investigador |

---

### PASO 0.2-ALICIA — Fallback universal (repos bloqueados, ISTs, sin handle)

```python
# Buscar en ALICIA directamente
web_search("site:alicia.concytec.gob.pe <título exacto OR tema institución>")
web_fetch("https://alicia.concytec.gob.pe/vufind/Search/Results?lookfor=<tema>")
web_fetch("https://alicia.concytec.gob.pe/vufind/Record/<ID>")
# → Botón "Acceder al recurso" en HTML → URL del repo origen → Estrategia A/B/C
```

### PASO 0.2-DOI

```python
# Intento 1: resolve_pdf (más rápido)
letxipu:resolve_pdf(identifier="<DOI>")
# Si data.pdfUrl → ir a PASO 0.4 directamente

# Intento 2: download_pdf (más fuentes, incluye Sci-Hub)
letxipu:download_pdf(doi="<DOI>")
# Si data.pdfUrl → ir a PASO 0.4
```

---

### PASO 0.3 — Estrategia de extracción por tipo de repositorio

#### ✅ Estrategia A — DSpace 6 abierto (mayoría repos peruanos)

```python
# A1: Obtener página del ítem
web_fetch("<URL_REPO>")

# A2: Extraer URL del bitstream del HTML
# Patrones a buscar en el HTML:
#   href="...bitstream/handle/<prefijo>/<id>/NOMBRE.pdf?sequence=1"
#   href="/bitstream/handle/.../NOMBRE.pdf?sequence=1"  ← agregar dominio base
#   bitstreams/<UUID>/download                           ← DSpace 7 (PUCP)
# Términos clave en HTML: "bitstream" ".pdf" "sequence=1" "isAllowed=y" "Ver/Abrir"
# ⚠️ UNS: HTML no expone el link al bitstream (caso especial)

# A3: Leer el PDF (letxipu NO accede a .edu.pe → usar web_fetch)
web_fetch("<URL_BITSTREAM>")        ← Claude puede leer el texto directamente
# Alternativa si el dominio es accesible por letxipu (raro):
letxipu:pdf_smart_summary(source="<URL_BITSTREAM>")
```

#### ⚠️ Estrategia B — DSpace 7 con JS rendering (UNMSM, UPAO, U.Pacífico, UNASAM)

```python
# B1: Google bitstream — Google indexa PDFs aunque el frontend sea JS
web_search("site:<dominio>/bitstream <apellido_autor> <palabras_titulo>")
# → Si aparece URL con /bitstream → web_fetch(URL_BITSTREAM)

# B2: REST API DSpace 7 (alternativa más técnica)
web_fetch("https://<dominio>/backend/api/pid/find?id=hdl:<prefijo>/<id>")
# → JSON: _links.bundles.href → bundle ORIGINAL → bitstreams → _links.content.href
# → URL final del bitstream → web_fetch(URL_BITSTREAM)
```

#### 🔴 Estrategia C — Repos bloqueados (UCV, USS, Continental, UPEU)

```python
# C1: ALICIA — siempre disponible
web_search("site:alicia.concytec.gob.pe <título exacto>")

# C2: Google bitstream — puede funcionar incluso con Anubis
web_search("site:<dominio>/bitstream <apellido> <año>")

# C3: Si tiene DOI → letxipu:resolve_pdf(DOI)

# C4: Búsqueda libre del PDF
web_search("<título completo> filetype:pdf")
web_search("<título> researchgate.net OR academia.edu")
```

#### 📂 Estrategia D — IST/ISEP/Escuelas sin repositorio DSpace

```python
# D1: batch_search enfocado
letxipu:batch_search(
    queries=["<tema> <institución> peru", "<tema> trabajo titulación peru"],
    sources=["alicia","renati"],
    yearStart="2018"
)

# D2: ALICIA directo
web_search("site:alicia.concytec.gob.pe <tema> \"instituto superior\"")

# D3: RENATI
web_fetch("https://renati.sunedu.gob.pe/simple-search?query=<tema>+<institución>")

# D4: Filetype
web_search("<institución> <tema> filetype:pdf site:.edu.pe")
```

---

### PASO 0.4 — Flujo de lectura de PDF (orden óptimo por tokens y profundidad)

```python
# PARA PDFs ACCESIBLES POR LETXIPU (arXiv, PubMed, DOI OA, servidores globales):

# 1: Vista rápida (siempre primero)
letxipu:pdf_smart_summary(source="<URL>")
# → sections[]{name, category, preview} — SIN statistics

# 2: Si se necesitan estadísticas del documento
letxipu:analyze_academic(source="<URL>")
# → sections[]{hasNumericalData, statistics[]} + globalStatistics[]
# → Detecta: %, p-value, OR, regresión, ANOVA, chi2, n_sample, tablas, figuras
# ← La misma sección puede aparecer múltiples veces (normal, son subdivisiones)

# 3: Extraer sección específica
letxipu:extract_section(source="<URL>", section="resultados")
# → data.found (bool), data.section.content (completo), data.availableSections[]
# ← Si data.found == false: consultar data.availableSections[] para sección correcta

# 4: Referencias bibliográficas
letxipu:pdf_citations(source="<URL>")
# → data.citations[]{index, text, authors, year} — authors: solo inicial del apellido
# → data.totalCitations

# 5: Texto completo
letxipu:read_pdf_markdown(source="<URL>", maxChars=30000)

# 6: PDF escaneado (texto vacío en pasos anteriores)
letxipu:convert_document(source="<URL>")


# PARA PDFs DE REPOS PERUANOS (.edu.pe) — letxipu NO accede:
web_fetch("<URL_BITSTREAM>")        ← Claude lee el texto directamente desde el HTML
# El contenido del PDF llega como texto en el HTML que Claude puede procesar
```

### PASO 0.5 — Reporte al usuario

```
1. ✅ Institución + sistema (DSpace 6/7, portal, ALICIA)
2. 🔗 Handle/URL del ítem + fuente (ALICIA, RENATI, batch_search)
3. 📎 URL bitstream + método de extracción (web_fetch, Estrategia A/B/C/D)
4. 📋 Metadatos: título, autores, año, asesor, facultad
   (del abstract en batch_search.results si letxipu no accede al PDF)
5. 📝 Resumen ejecutivo (de pdf_smart_summary o abstract de ALICIA)
6. 🔬 Metodología: tipo, diseño, enfoque, muestra n=?
7. 📊 Estadísticas (de analyze_academic.globalStatistics si es PDF global;
   del abstract en batch_search si es .edu.pe)
8. ✅ Conclusiones
9. 📚 Referencias APA 7 (de pdf_citations si es PDF global, o de web_fetch)
10. 🗓️ Fecha de acceso
```

---

## FASE 1 — Búsqueda Web con Verificación Temporal

```python
# PASO OBLIGATORIO: Fecha actual antes de cualquier búsqueda de noticias
web_fetch("https://www.timeanddate.com/worldclock/peru/lima")
# NUNCA usar web_search para fecha — snippets cacheados mienten
```

Filtro de búsqueda: `<tema> after:YYYY-MM-DD` — excluir todo lo que no sea de hoy.

---

## FASE 2 — Deep Researcher con Foco Perú (v13)

### PASO 2.1 — batch_search principal (siempre con sources explícitas)

```python
# PERÚ PURO — SIN RUIDO ECUADOR (recomendado para la mayoría de temas)
letxipu:batch_search(
    queries=[
        "<tema> perú",
        "<tema> universidad peruana",
        "<tema> tesis perú",
        "<topic in English>"
    ],
    sources=["alicia","renati"],     # ← MEJOR OPCIÓN: sin RRAAE Ecuador
    yearStart="2018",
    maxResults=80
)
# ⚠️ Respuesta en data.results[] (NO data.sources)
# Campos útiles: abstract (completo), doi (si tiene), source (ALICIA/RENATI),
#                matchedQueries[], handleUrl

# PERÚ + TESIS LATAM (cuando se quiere contexto regional)
letxipu:batch_search(
    queries=["<tema> perú", "<tema>"],
    sources=["alicia","renati","bdtd","lareferencia"]  # sin rraae Ecuador
)

# PERÚ + GLOBAL (para contexto internacional)
letxipu:batch_search(
    queries=["<tema> perú", "<tema>"],
    sources=["alicia","renati","global"]
)

# IA/ML TENDENCIAS
letxipu:trending_papers(query="<tema>")          # query OBLIGATORIO
letxipu:search_conferences(query="<tema>")        # OpenReview ✅
# NO usar: search_dblp (OFFLINE) · smart_search (TIMEOUT)
```

### PASO 2.2 — Búsqueda web complementaria

```bash
# AGGREGADORES PERUANOS (siempre incluir)
web_search("site:alicia.concytec.gob.pe <tema>")
web_search("site:renati.sunedu.gob.pe <tema>")
web_search("site:scielo.org.pe <tema>")

# REPOS ESPECÍFICOS SEGÚN TEMA
web_search("site:tesis.pucp.edu.pe <tema>")
web_search("site:cybertesis.unmsm.edu.pe <tema>")
web_search("site:repositorio.uladech.edu.pe <tema>")
web_search("site:repositorio.uns.edu.pe <tema>")         # Chimbote
web_search("site:repositorio.upch.edu.pe <tema>")        # Salud
web_search("site:repositorio.ins.gob.pe <tema>")         # Salud pública
web_search("site:repositorio.inia.gob.pe <tema>")        # Agraria

# FILETYPE UNIVERSAL PERÚ
web_search("<tema> tesis peru filetype:pdf site:.edu.pe after:2020")
web_search("<tema> peru \"repositorio institucional\" 2022 OR 2023 OR 2024")
```

### PASO 2.3 — Lectura de PDFs encontrados

```python
# Para cada resultado del batch_search:
# 1. Si tiene DOI → resolve_pdf → si OA → letxipu pdf_smart_summary + analyze_academic
# 2. Si solo tiene handleUrl (.edu.pe) → Estrategia A/B/C/D → web_fetch bitstream
# 3. Si tiene abstract completo en el resultado → usar ese abstract directamente
#    (ALICIA frecuentemente retorna el abstract completo en data.results)

# Enriquecimiento solo si hay DOIs
papers_con_doi = [r for r in data.results if r.get("doi")]
if papers_con_doi:
    result = letxipu:enrich_metadata(papers=[
        {"doi": p["doi"], "title": p["title"]} for p in papers_con_doi[:10]
    ])
    # ⚠️ DEDUPLICAR: data.papers[] duplica — filtrar por title único
```

---

## FASE 3 — Síntesis y Reporte

```
1. Fuentes consultadas: batch_search (N resultados de ALICIA+RENATI) + web_search
2. Resumen ejecutivo del tema
3. Hallazgos por subtema con datos concretos
4. PDFs leídos: fuente + método acceso + resumen extraído
5. Estadísticas clave (de analyze_academic si PDF global; de abstracts si .edu.pe)
6. Vacíos de investigación identificados
7. Conclusiones
8. Referencias APA 7 con URL y fecha de acceso
```

---

## Tabla de comportamiento real v13 (probado en producción)

| Herramienta + caso | Resultado | Campo correcto | Estado |
|--------------------|-----------|----------------|--------|
| `batch_search(["alicia","renati"])` | ✅ resultados Perú | `data.results[]` | ✅ |
| `search(sources=["peru"])` | ✅ funciona | `data.sources[]` | ✅ |
| `smart_search(...)` | ❌ TIMEOUT | — | NO USAR |
| `search_dblp(...)` | ❌ OFFLINE | `data.sources[]` vacío | NO USAR |
| `search_conferences(query)` | ✅ OpenReview | `data.sources[]` | ✅ |
| `trending_papers(query="x")` | ✅ HuggingFace | `data.sources[]` | query OBLIGATORIO |
| `trending_papers()` sin query | ❌ "Missing query" | — | Falla sin query |
| `resolve_pdf(DOI_OA)` | ✅ pdfUrl via Unpaywall | `data.pdfUrl` | ✅ |
| `resolve_pdf(URL_edu.pe)` | ❌ pdfUrl null | `data.pdfUrl=null` | NO funciona |
| `download_pdf(DOI)` | ✅ pdfUrl (mismas fuentes) | `data.pdfUrl` | ✅ |
| `download_pdf(URL_edu.pe)` | ❌ devuelve misma URL | `data.pdfUrl` = URL repo | NO funciona |
| `fetch_metadata(cualquier)` | ❌ score 15, vacío | `data.completenessScore=15` | ROTA |
| `recover_metadata(URL_edu.pe)` | ❌ score 15, vacío | — | NO funciona |
| `pdf_smart_summary(arXiv/OA)` | ✅ resumen completo | `data.sections[]` | ✅ |
| `pdf_smart_summary(URL_edu.pe)` | ❌ "Could not obtain" | — | NO funciona |
| `analyze_academic(arXiv/OA)` | ✅ stats + secciones | `data.globalStatistics[]` | ✅✅ |
| `analyze_academic(URL_edu.pe)` | ❌ "Could not obtain" | — | NO funciona |
| `pdf_sections(cualquier)` | ❌ TIMEOUT | — | NO USAR |
| `extract_section(arXiv, sec)` | ✅ texto + available | `data.section{}` + `data.availableSections[]` | ✅✅ |
| `pdf_citations(arXiv)` | ✅ 87+ citas | `data.citations[]` | ✅ |
| `pdf_citations(URL_edu.pe)` | ❌ "Could not obtain" | — | NO funciona |
| `pdf_citations(tesis_peru)` | ⚠️ [] si .edu.pe | `data.citations[]` vacío | Infiable |
| `pdf_metadata(arXiv/OA)` | ✅ pages+size | `data.pages, data.fileSize` | ✅ |
| `pdf_metadata(tesis_peru)` | ✅ pages+size | title/author vacíos | Parcial |
| `enrich_metadata(con DOI)` | ✅ abstract+year | `data.papers[]` DUPLICADOS | Deduplicar |
| `enrich_metadata(sin DOI)` | ❌ no enriquece | `data.papers[]` vacíos | NO funciona |
| `list_sources()` | ✅ 39 fuentes+grupos | `data.sources[]` + `data.groups{}` | ✅ |
| `health_check()` | ✅ estado real | `data.server{} + data.sources{}` | ✅ |
| `web_fetch(repo_DSpace6)` | ✅ HTML ítem | — | A veces sin bitstream |
| `web_fetch(URL_BITSTREAM)` | ✅ texto del PDF | — | Alternativa para .edu.pe |

---

## Tabla de errores y soluciones rápidas (v13)

| Error / Síntoma | Causa confirmada | Solución |
|-----------------|-----------------|----------|
| `data.results` undefined | Usando search (no batch) | Leer `data.sources[]` |
| `data.sources` undefined | Usando batch_search (no search) | Leer `data.results[]` |
| TIMEOUT en herramienta | smart_search / pdf_sections | Cambiar a batch_search / analyze_academic |
| "Could not obtain the PDF" | URL de dominio .edu.pe | web_fetch(URL_BITSTREAM) |
| resolve_pdf → pdfUrl null | URL repo .edu.pe | web_fetch → extraer bitstream manual |
| fetch_metadata → score 15 | Herramienta rota | No usar; usar batch_search |
| recover_metadata → score 15 | URL repo peruano | No usar con repos .edu.pe |
| download_pdf → misma URL | URL repo .edu.pe | No es bitstream; web_fetch → buscar bitstream |
| web_fetch → HTML sin bitstream | UNS u otros sin link visible | Google: `site:<repo>/bitstream <autor>` |
| web_fetch → HTML mínimo JS | DSpace 7 (UNMSM, UPAO) | Estrategia B: Google/REST API |
| web_fetch → ROBOTS_DISALLOWED | robots.txt activo | ALICIA o resolve_pdf(DOI) |
| web_fetch → Anubis | Anti-bot (UCV, USS) | ALICIA + filetype:pdf |
| pdf_citations → authors "S", "H" | Bug campo authors | Usar campo "text" completo |
| analyze_academic → sección duplicada | Subdivisiones del PDF | Normal — todas son válidas |
| extract_section → data.found false | Sección no existe | Ver data.availableSections[] |
| enrich_metadata → duplicados | Bug MCP v7 | Filtrar data.papers[] por title único |
| batch_search → ruido Ecuador | sources incluye "rraae" | Cambiar a ["alicia","renati"] |
| trending_papers → "Missing query" | query omitido | Siempre: trending_papers(query="x") |
| DBLP vacío | DBLP OFFLINE | Verificar con health_check; no usar |
| OpenAlex 0 resultados | OpenAlex ERROR | Usar otras fuentes en sources=["global"] |

---

## Queries maestras (copiar y adaptar)

```python
# letxipu — PERÚ SIN RUIDO (mejor opción)
letxipu:batch_search(queries=["<tema> perú","<tema>"], sources=["alicia","renati"])

# letxipu — PERÚ + LATAM SIN ECUADOR
letxipu:batch_search(queries=["<tema> perú","<tema>"],
                     sources=["alicia","renati","bdtd","lareferencia"])

# letxipu — PERÚ + GLOBAL
letxipu:batch_search(queries=["<tema> perú","<tema>"],
                     sources=["alicia","renati","global"])

# letxipu — DOI → PDF
letxipu:resolve_pdf(identifier="10.xxx/yyy")
# Si pdfUrl: letxipu:pdf_smart_summary + analyze_academic + extract_section

# letxipu — ANÁLISIS COMPLETO DE PDF GLOBAL
letxipu:pdf_smart_summary(source="URL")          # vista rápida
letxipu:analyze_academic(source="URL")           # estadísticas
letxipu:extract_section(source="URL", section="resultados")
letxipu:pdf_citations(source="URL")              # referencias

# web_search — AGGREGADORES PERÚ
site:alicia.concytec.gob.pe <tema>
site:renati.sunedu.gob.pe <tema>
site:scielo.org.pe <tema>

# web_search — REPOS ESPECÍFICOS
site:tesis.pucp.edu.pe <tema>
site:cybertesis.unmsm.edu.pe <tema>
site:repositorio.uladech.edu.pe <tema>
site:repositorio.uns.edu.pe <tema>

# web_search — BITSTREAM GOOGLE (repos DSpace 7 o sin link visible)
site:<repo>/bitstream <apellido_autor> <año_o_palabras>

# web_search — UNIVERSAL PERÚ
<tema> tesis peru filetype:pdf site:.edu.pe after:2020
<tema> peru "repositorio institucional" 2022 OR 2023 OR 2024
```
