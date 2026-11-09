# Prueba de herramientas de búsqueda y metadatos de LetXinet V11 (letxinet-v11)

- **Fecha:** 2026-11-01, de 14:06 a 14:17 (hora local)
- **Servidor:** letxipu-search-mcp v11.0.0, 28 herramientas, uptime de unas 21,5 h
- **Caso de uso:** tesis UNT «Relación entre el perfil lipídico y el grado de la hipertensión arterial… Chimbote, 2025»
- **Cómo se midió la latencia:** con `Get-Date` antes y después de cada llamada. Incluye unos 2-4 s de ida y vuelta del cliente. El cliente MCP corta las llamadas a los **~60 s** («The operation timed out»).

## 1. Registro de llamadas

| N.º | Herramienta | Argumentos (resumen) | Estado | Latencia | Resultado |
|---|---|---|---|---|---|
| 1 | health_check | — | ✅ éxito | ~2 s | status ok, v11.0.0, 28 tools, MinerU + MarkItDown + pdfParse disponibles. **No informa del estado de las fuentes ni del sidecar spaCy** (la descripción promete «connectivity to all sources»). |
| 2 | list_sources | — | ✅ éxito | ~4 s | **39 fuentes** (`total: 39`): 37 gratuitas y 2 premium con clave (Scopus, SerpApi/Google Scholar). Grupos: latam (16), global (8), tesis (11), peru (renati, laref_peru), peru_fast (alicia, laref_peru), ai_ml (5). |
| 3 | coverage_report | format=text | ⚠️ éxito vacío | ~4 s | «Perú 0/0, LatAm 0/0, Internacional 0/0», último test «no disponible». |
| 4 | coverage_report | format=json, use_cache=false | ❌ vacío | <4 s | Igual: `countries: []` y todos los contadores en 0. **No lanza el sondeo nuevo**, aunque se le pide expresamente. |
| 5 | help | topic=search | ✅ éxito | ~4 s | Ayuda breve con ejemplo de uso y grupos de fuentes. |
| 6 | search | «perfil lipídico hipertensión arterial Chimbote», sources=[peru_fast], max=25 | ⚠️ éxito, sin relevancia | ~20 s | 8 resultados, **ninguno médico** («Perfil del comprador de viviendas», «Perfil profesional…»). Solo coincide «perfil» + «Chimbote». ALICIA: 0 resultados en 6,8 s; laref_peru: 30 en 2,4 s. |
| 7 | search | «dislipidemia hipertensión arterial Chimbote», sources=[tesis, peru], filterFalsePositives=true, location=Áncash | ⚠️ éxito, 0 resultados | ~45 s | 31 resultados brutos y **0 tras el filtro**. RENATI tardó 31 s. **El filtro semántico depende de /concept_match, que da 500** (ver la sección 3). |
| D1 | (diagnóstico) sidecar spaCy http://127.0.0.1:4002 | GET /health, POST /concept_match, /similarity, /analyze | — | 0,2 s | /health → `ready:true`. **/concept_match → HTTP 500** y /similarity → HTTP 500. /analyze → OK. **El fallo de las 14:04 se reproduce.** |
| 8 | smart_search | «perfil lipídico hipertensión arterial adultos», location=Chimbote, sources=[tesis, peru_fast], yearStart=2015 | ❌ timeout | ~61 s | «The operation timed out». |
| 9 | smart_search | «dislipidemia hipertensión Áncash», sources=[peru_fast], fastMode=true, max=20 | ❌ timeout | ~66 s | Timeout incluso con fastMode y solo 2 fuentes. |
| 10 | batch_search | 4 consultas (Chimbote, Nuevo Chimbote, USP, Áncash), sources=[peru_fast], fastMode | ❌ timeout | ~65 s | Timeout. |
| 11 | batch_search | 1 consulta «hipertensión arterial Chimbote», sources=[laref_peru], fastMode | ⚠️ éxito al límite | ~62 s | 23 resultados, unos 5 útiles (ver A_mejoras_tesis.md). **Añade RENATI aunque no se pidió** (30 s). La universidad sale mal etiquetada: el handle 20.500.13032 de ULADECH aparece como «Universidad de Lambayeque». |
| 12 | fetch_metadata | doi=10.1056/NEJMra1704889 (Carey 2018) | ✅ éxito (vacío correcto) | ~3 s | Título y autores vacíos, completenessScore 15. Contraste directo con Crossref: **404, el DOI no existe**. |
| 13 | fetch_metadata | doi=10.3390/jcm8071000 (Winters 2019) | ✅ éxito | ~2 s | Devuelve **otro artículo**: Drosos et al. (2019), «Increased Lymphangiogenesis… Perivascular Adipose Tissue…», J Clin Med 8(7):1000. La referencia citada es falsa. |
| 14 | enrich_metadata | 3 papers (Carey, Winters, Gamboa) con su título y DOI | ⚠️ **peligroso** | ~11 s | Le asigna a «Carey 2018» el abstract de un artículo de **hipertensión intracraneal idiopática** (completeness 85) y a «Winters 2019» el abstract de Drosos (completeness 90). **No avisa de que el título y el DOI no coinciden**, lo que hace pasar por verificadas referencias inventadas. Gamboa queda sin datos (35). |
| 15 | recover_metadata | title=«Manual de hipertensión arterial Gamboa Benavides UPCH» | ✅ éxito (vacío correcto) | ~7 s | Sin datos. Solo probó «OpenAlex (title)». |
| 16 | recover_metadata | doi=10.1056/NEJMra1704889 | ✅ éxito (vacío correcto) | ~6 s | Sin datos tras OpenAlex, Crossref y Semantic Scholar. **No hubo el timeout de más de 4 min** del aviso de deprecación. |
| 17 | search | «Perveen lipid profile hypertension 2025», sources=[pubmed, openalex, crossref], fastMode, yearStart=2024 | ✅ éxito | ~20 s | **Encontró Perveen et al. (2025)**, Saudi J Med, DOI 10.36348/sjm.2025.v10i06.003, y Gangapatnam et al. (2025), «Lipid profile at various stages of hypertension». PubMed: 0 resultados; OpenAlex: 0 en 9,4 s. Solo Crossref devolvió resultados (50). |
| 18 | search | «Kumari Kishor lipid profile hypertension», sources=[crossref, pubmed], 2023-2025 | ✅ éxito, no localizado | ~8 s | No hay ningún artículo de «Kumari & Kishor 2024». Contraste directo con Crossref (query.author): tampoco existe. |
| 19 | search_dblp | «hypertension prediction machine learning», max=10 | ❌ 0 resultados | ~1 s | found 0. |
| 20 | search_paperswithcode | «hypertension prediction machine learning», max=10 | ❌ consulta ignorada | ~14 s | Devuelve 8 papers **de HuggingFace Daily** sin relación con el tema (Multi-Token Prediction, EPSBench…). El filtro por tema no se aplica. |
| 21 | trending_papers | query=«medical», max=5 | ⚠️ 0 resultados | ~6 s | found 0. El filtro por tema solo trabaja sobre la lista diaria de HF. |
| 22 | search_conferences | «hypertension prediction machine learning», max=10 | ⚠️ 0 resultados | ~7 s | OpenReview: 0. |
| 23 | trending_papers | sin query, max=3 | ✅ éxito | ~26 s (lote de 3 llamadas en paralelo) | 8 papers de IA y ML del día (HF, 0,3 s). Ignora max=3. |
| 24 | search_dblp | «blood pressure», max=5 | ❌ 0 resultados | (mismo lote) | found 0 en 0,8 s. DBLP tiene cientos de títulos con «blood pressure», así que **la fuente está rota**. |
| 25 | search_conferences | «electronic health records», max=5 | ✅ éxito | (mismo lote) | 8 papers reales (MLHC, CHIL, ML4H@NeurIPS, EMBC). Sirve para ML clínico. |
| 26 | search | «perfil lipídico Chimbote», sources=[laref_peru], fastMode | ⚠️ éxito, sin relevancia | ~9 s | 8 resultados, todos de «perfil de puestos», «perfil sensorial», etc. «Lipídico» se pierde en el ranking. |

**Total:** 26 llamadas a las 14 herramientas y 1 diagnóstico directo del sidecar. Hubo 3 timeouts, todos en smart_search y batch_search (multiconsulta).

## 2. Problemas transversales observados

1. **El tope de resultados está fijo en 8:** `search`, `search_paperswithcode`, `trending_papers` y `search_conferences` devuelven siempre `total: 8`, aunque se pida maxSources=25 o maxResults=3/5/10. batch_search sí devolvió 23.
2. **El campo `country` trae basura:** «_version» en tesis peruanas, y «peru», «brasil» o «colombia» en preprints de arXiv.
3. **PubMed devuelve 0 en todas las consultas** (0,7 s, lo que apunta a un error silencioso). OpenAlex también devolvió 0 dentro de `search` (9 s), aunque sí funciona dentro de fetch_metadata.
4. **RENATI tarda ~30-31 s en cada llamada** (parece un timeout interno) y se añade aunque no se pida.
5. **La relevancia semántica es pobre en español:** «perfil lipídico» empareja con cualquier «perfil». Encaja con que el sidecar de vectores no funciona (ver la sección 3).

## 3. ¿Sigue pasando el fallo de las 14:04? — **SÍ**

- **/concept_match devuelve HTTP 500 de forma reproducible**, y /similarity también. /health y /analyze funcionan.
- **Causa raíz confirmada:** el sidecar carga los modelos `es_core_news_sm`, `en_core_web_sm` y `pt_core_news_sm` (spaCy 3.8.14). Los modelos `_sm` **no traen vectores de palabra** (`nlp.vocab.vectors.shape == (0, 0)`). En `spacy_server.py` (líneas 192-245), `nlp.vocab[w].vector` lanza `ValueError [E010] Word vectors set to length 0`, pero el código solo captura `KeyError`. La excepción sin capturar provoca el 500 de Flask.
- **Consecuencias:** `filterFalsePositives` descarta todo (llamada 7: 31 → 0), el ranking semántico se degrada, y probablemente los reintentos y fallbacks son los que alargan smart_search y batch_search por encima de 60 s.
- **Arreglo propuesto (no aplicado: fuera de la carpeta permitida):**
  - (a) instalar `es_core_news_md`/`en_core_web_md`, que sí traen vectores; o
  - (b) en `concept_match`, `similarity`, `batch_*` y `most_similar`, capturar `(KeyError, ValueError)` o comprobar `nlp.vocab.vectors.shape[1] == 0` y caer a coincidencia léxica (lemmas o LCS) en vez de devolver 500.
  - Además: bajar el timeout de RENATI (30 s → 8-10 s) y no añadir RENATI cuando `sources` no lo incluye.

## 4. Conclusión por herramienta

| Herramienta | Veredicto | Comentario y causa |
|---|---|---|
| search | ⚠️ parcial | Responde en 9-45 s, pero con baja relevancia temática; tope fijo de 8 resultados; PubMed y OpenAlex devuelven 0; con `filterFalsePositives` se queda en 0 por el 500 del sidecar. Útil con fuentes concretas (crossref) y fastMode. |
| smart_search | ❌ falla | Timeout (>60 s) en 2 de 2 llamadas, incluso con fastMode y peru_fast. Causa probable: multiconsulta × RENATI (30 s) × fallbacks del sidecar con 500. |
| batch_search | ⚠️ parcial | Con 4 consultas, timeout. Con 1 consulta y 1 fuente, ~62 s al límite pero con resultados (23). Etiqueta mal la universidad (ULADECH → Lambayeque). |
| search_dblp | ❌ falla | 0 resultados incluso con «blood pressure». Está DEPRECATED (API XML de DBLP inestable). No sirve para la tesis. |
| search_paperswithcode | ❌ falla | Ignora la consulta y devuelve HF Daily Papers (la API de PwC está retirada). No sirve. |
| trending_papers | ✅ funciona (no aplica) | Devuelve los trending de IA y ML de HF. Con filtro «medical», 0. No aporta nada a una tesis clínica. |
| search_conferences | ✅ funciona (aplicación limitada) | OpenReview responde (EHR → 8 papers). Para «hypertension ML», 0. Solo sirve si la tesis añade un componente de ML. |
| list_sources | ✅ funciona | 39 fuentes y sus grupos. |
| coverage_report | ❌ falla | Siempre vacío (0/0), incluso con use_cache=false: no ejecuta el sondeo. |
| help | ✅ funciona | Rápido y correcto. |
| health_check | ⚠️ parcial | Responde ok, pero no comprueba las fuentes ni el sidecar spaCy: dice «ok» mientras /concept_match devuelve 500. |
| fetch_metadata | ✅ funciona | Rápido (2-3 s). Ante un DOI inexistente devuelve un registro vacío. Ojo: no compara con el título citado, hay que comparar a mano. |
| enrich_metadata | ⚠️ parcial / riesgo | Rápido, pero **injerta abstracts de otros artículos** en referencias falsas sin avisar (sube la completeness a 85-90). No debe usarse para verificar referencias. |
| recover_metadata | ✅ funciona | 6-7 s, vacío honesto ante un DOI o título inexistente, sin el timeout de >4 min que dice su aviso de deprecación. |

**Activas y útiles para esta tesis:** search (con crossref y fastMode), fetch_metadata, recover_metadata, list_sources y help. **Para no usar hoy:** smart_search, batch_search multiconsulta, search_dblp, search_paperswithcode, coverage_report y enrich_metadata (para verificar).
