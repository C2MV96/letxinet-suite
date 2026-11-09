# Informe del pool de harnesses de LetXinet Suite

Fecha: 8/11/2026, 2:30:35 a. m.. Carpeta: `C:/Users/USER/Downloads/LetXinet-Suite-v1.1.0-Paquete-Completo/04_SCRIPTS-MANTENIMIENTO/harness/pool/resultados/20261108-0624`.

**Resumen:** 211 pruebas en 11 harnesses: 164 OK, 29 avisos, 7 fallas, 11 fallos de la red externa y 0 omitidas.

Estados: **OK** correcto; **AVISO** funciona con una limitación; **FALLA** error de LetXinet; **RED** falló un servicio externo o la red (no LetXinet); **OMITIDA** no aplicaba.

| Harness | OK | Avisos | Fallas | Red | Omitidas | Duración |
|---|---|---|---|---|---|---|
| h01 Servicios y salud | 10 | 0 | 0 | 0 | 0 | 8 s |
| h02 V11: las 28 herramientas | 28 | 7 | 5 | 1 | 0 | 739 s |
| h03 V11: cada fuente por separado (consulta "dengue") | 26 | 13 | 0 | 0 | 0 | 101 s |
| h04 OSM: las 28 herramientas | 22 | 1 | 1 | 10 | 0 | 826 s |
| h05 MarkItDown | 4 | 2 | 0 | 0 | 0 | 8 s |
| h06 Puentes MCP por stdio | 23 | 1 | 0 | 0 | 0 | 70 s |
| h07 Configurador de clientes | 16 | 4 | 0 | 0 | 0 | 12 s |
| h08 Gateway de LetXinet Desktop | 10 | 0 | 0 | 0 | 0 | 3 s |
| h09 Rendimiento y carga | 7 | 1 | 0 | 0 | 0 | 141 s |
| h10 Seguridad | 10 | 0 | 1 | 0 | 0 | 38 s |
| h11 Comparativo: lado LetXinet | 8 | 0 | 0 | 0 | 0 | 789 s |

## Fallas, avisos y fallos de red

### Fallas (7)

- **h02 · Metadatos · fetch_metadata por DOI:** Tool "fetch_metadata" exceeded its deadline of 114014ms
- **h02 · Metadatos · enrich_metadata:** Tool "enrich_metadata" exceeded its deadline of 114007ms
- **h02 · PDF · extract_section:** bad XRef entry
- **h02 · PDF · extract_tables en un paper de arXiv con tablas:** no detecto ninguna tabla en un paper que tiene 4
- **h02 · PDF · convert_document (PDF remoto):** All extraction engines failed for journal.pntd.0007203&type=printable. Last error: PDFDocument: stream must have data. Engines tried: markitdown, mineru-api, pdf-parse
- **h04 · Nominatim · geocode_address (hospital):** {"code":"LOW_CONFIDENCE_RESULTS","message":"All candidates were filtered out by the importance threshold","query":"Hospital Regional Eleazar Guzmán Barrón, Nuevo Chimbote","threshold":0.05,"discarded":[{"name":"Hospital Eleazar Guzmán Barrón, Avenida Brasil, S
- **h10 · SSRF · convert_document bloquea metadatos de la nube (169.254.169.254):** acepto una URL interna

### Avisos (29)

- **h02 · Busqueda · search (pubmed):** 0 resultados
- **h02 · PDF · resolve_pdf desde repositorio peruano:** sin pdfUrl
- **h02 · PDF · read_pdf con ruta local de Windows:** no acepta rutas locales de este PC; hay que pasar una URL o un DOI
- **h02 · PDF · pdf_citations:** { "success": true, "data": { "citations": [], "totalCitations": 0 } }
- **h02 · PDF · extract_tables:** { "success": true, "data": { "tables": [], "count": 0 } }
- **h02 · Configuracion · MINERU_API_KEY y convert_document con URL:** tiene un valor de 11 caracteres que no parece una clave real; con ella convert_document no descarga el PDF y falla con URL (dejala vacia o pon una clave valida)
- **h02 · PDF · convert_document (URL local):** bloquea URL locales, a diferencia de read_pdf: Blocked URL: internal/private URLs are not allowed (http://127.0.0.1:60342/articul...)
- **h03 · Global · semantic (Semantic Scholar):** 0 resultados en 1 s
- **h03 · Global · scopus (Scopus):** 0 resultados en 6 s
- **h03 · Global · zenodo (Zenodo):** 0 resultados en 3 s
- **h03 · Global · openalex (OpenAlex):** 0 resultados en 10 s
- **h03 · Global · core (CORE):** 0 resultados en 1 s
- **h03 · LatAm · redalyc (Redalyc):** 0 resultados en 1 s
- **h03 · Mexico · conacyt (CONAHCyT):** 0 resultados en 6 s
- **h03 · Peru · renati (RENATI (SUNEDU)):** 0 resultados en 31 s
- **h03 · Global · serpapi (Google Scholar):** 0 resultados en 3 s
- **h03 · Global · dblp (DBLP):** 0 resultados en 6 s
- **h03 · Global · paperswithcode (Papers With Code):** 0 resultados en 7 s
- **h03 · Global · huggingface (HuggingFace Daily Papers):** 0 resultados en 7 s
- **h03 · Peru · alicia (ALICIA (CONCYTEC)):** 0 resultados en 91 s
- **h04 · Calculo local · filter_tags con id numerico (como lo da Overpass):** rechaza id numerico con un mensaje poco claro: Invalid input format
- **h05 · API · DOCX (Word):** no convierte Word (HTTP 400); esta API solo acepta PDF
- **h05 · API · XLSX (Excel):** no convierte Excel (HTTP 400); esta API solo acepta PDF
- **h06 · Puente jobs · descripciones al dia (puerto y numero de herramientas):** la descripcion que ve la IA esta desactualizada: menciona el puerto 3000, dice 56 herramientas
- **h07 · Modo separados · Claude Desktop:** latex-mcp-local sigue en D:\OTROS (no existe el Addon en el perfil falso)
- **h07 · Modo juntos · Claude Desktop:** latex-mcp-local sigue en D:\OTROS (no existe el Addon en el perfil falso)
- **h07 · Modo ambos · Claude Desktop:** latex-mcp-local sigue en D:\OTROS (no existe el Addon en el perfil falso)
- **h07 · Opciones · modo invalido:** acepto un modo invalido
- **h09 · V11 · latencia fetch_metadata (5 llamadas):** p50 10556 ms, p95 10792 ms, max 10792 ms, fallos 0

### Fallos de la red externa (11)

- **h02 · Metadatos · recover_metadata por titulo:** sin respuesta en 180 s
- **h04 · Nominatim · polygon_from_admin:** fetch failed
- **h04 · Overpass · find_nearby_places:** fetch failed
- **h04 · Overpass · find_schools_nearby:** fetch failed
- **h04 · Overpass · find_parking_facilities:** fetch failed
- **h04 · Overpass · find_charging_stations:** fetch failed
- **h04 · Overpass · find_nearby_batch:** fetch failed
- **h04 · Overpass · osm_query_bbox:** fetch failed
- **h04 · Overpass · explore_area:** fetch failed
- **h04 · Overpass · analyze_neighborhood:** fetch failed
- **h04 · Overpass · suggest_meeting_point:** fetch failed

## Fuentes de V11, una por una

26 de 39 fuentes devolvieron resultados.

| Fuente | Región | Resultados | Tiempo | Estado |
|---|---|---|---|---|
| PubMed (`pubmed`) | Global | 40 | 5.2 s | OK |
| RRAAE (`rraae`) | Ecuador | 28 | 4.7 s | OK |
| BDTD (`bdtd`) | Brazil | 28 | 8.0 s | OK |
| Oasisbr (`oasisbr`) | Brazil | 23 | 6.8 s | OK |
| ANID (`anid`) | Chile | 22 | 19.3 s | OK |
| La Referencia (`lareferencia`) | LatAm | 19 | 7.3 s | OK |
| DOAJ (`doaj`) | Global | 8 | 1.9 s | OK |
| Timbo (`uruguay`) | Uruguay | 8 | 2.4 s | OK |
| arXiv (`arxiv`) | Global | 8 | 3.1 s | OK |
| La Referencia (México) (`laref_mexico`) | Mexico | 8 | 3.4 s | OK |
| La Referencia (Chile) (`laref_chile`) | Chile | 8 | 3.4 s | OK |
| La Referencia (Colombia) (`laref_colombia`) | Colombia | 8 | 3.7 s | OK |
| SciELO (`scielo`) | LatAm/Spain | 8 | 3.8 s | OK |
| La Referencia (Brasil) (`laref_brasil`) | Brazil | 8 | 5.2 s | OK |
| Crossref (`crossref`) | Global | 8 | 5.4 s | OK |
| La Referencia (Ecuador) (`laref_ecuador`) | Ecuador | 8 | 6.5 s | OK |
| La Referencia (Argentina) (`laref_argentina`) | Argentina | 8 | 10.2 s | OK |
| OpenAIRE (`openaire`) | Europe | 8 | 10.8 s | OK |
| MinCiencias (`minciencias`) | Colombia | 8 | 18.2 s | OK |
| UNAM (`unam`) | Mexico | 8 | 20.5 s | OK |
| KIMUK (`costarica`) | Costa Rica | 7 | 4.8 s | OK |
| OpenReview (`openreview`) | Global | 7 | 6.2 s | OK |
| La Referencia (Perú) (`laref_peru`) | Peru | 7 | 6.4 s | OK |
| SNRD (`snrd`) | Argentina | 7 | 17.6 s | OK |
| Recolecta (`espana`) | Spain | 4 | 2.4 s | OK |
| REDICCES (`elsalvador`) | El Salvador | 3 | 3.8 s | OK |
| Redalyc (`redalyc`) | LatAm | 0 | 1.1 s | sin resultados |
| Semantic Scholar (`semantic`) | Global | 0 | 1.1 s | sin resultados |
| CORE (`core`) | Global | 0 | 1.4 s | sin resultados |
| Zenodo (`zenodo`) | Global | 0 | 2.7 s | sin resultados |
| Google Scholar (`serpapi`) | Global | 0 | 3.1 s | sin resultados |
| DBLP (`dblp`) | Global | 0 | 5.6 s | sin resultados |
| Scopus (`scopus`) | Global | 0 | 5.6 s | sin resultados |
| CONAHCyT (`conacyt`) | Mexico | 0 | 5.6 s | sin resultados |
| HuggingFace Daily Papers (`huggingface`) | Global | 0 | 7.4 s | sin resultados |
| Papers With Code (`paperswithcode`) | Global | 0 | 7.5 s | sin resultados |
| OpenAlex (`openalex`) | Global | 0 | 9.7 s | sin resultados |
| RENATI (SUNEDU) (`renati`) | Peru | 0 | 30.7 s | sin resultados |
| ALICIA (CONCYTEC) (`alicia`) | Peru | 0 | 91.2 s | sin resultados |

## Rendimiento

| Medición | p50 | p95 | Máximo | Fallos |
|---|---|---|---|---|
| geo distance | 5 ms | 113 ms | 113 ms | 0 |
| list sources | 18 ms | 28 ms | 28 ms | 0 |
| fetch metadata | 10556 ms | 10792 ms | 10792 ms | 0 |
| search laref peru | 672 ms | 1627 ms | 1627 ms | 0 |
| search pubmed | 1268 ms | 1364 ms | 1364 ms | 0 |

- 6 busquedas simultaneas en V11: 6 de 6 en 1345 ms (la mas lenta 1344 ms)
- 30 llamadas simultaneas a OSM (calculo local): 30 de 30 en 162 ms
- busqueda grande (maxSources 100): 50 resultados, 45 KB en 90058 ms

## Comparativo: LetXinet frente a IA con búsqueda web y a IA sin búsqueda

Pertinente = el título contiene los conceptos clave de la pregunta (misma regla para los tres lados, solo con el título). La IA elige sus referencias; LetXinet devuelve la lista completa de las bases de datos, con ruido.

| Indicador | LetXinet | IA con búsqueda web | IA sin búsqueda (memoria) |
|---|---|---|---|
| Referencias en total (8 consultas) | 241 | 50 | 51 |
| Pertinentes | 80 (33 % de precisión) | 44 (88 % de precisión) | 29 (57 % de precisión) |
| Pertinentes sobre el Perú | 32 | 24 | 11 |
| Tesis pertinentes | 17 | 13 | 2 |
| Tiempo por consulta | 90 s | 28 s | - |
| Sobre el Perú o de instituciones peruanas | 131 (54 %) | 28 (56 %) | 23 (45 %) |
| Tesis | 70 | 14 | 2 |
| Con DOI | 156 (65 %) | 8 (16 %) | 28 (55 %) |
| Con año | 224 (93 %) | 26 (52 %) | 46 (90 %) |
| Verificadas (DOI correcto, enlace que abre o encontrada por título) | 46 de 48 (96 %)* | 43 de 50 (86 %) | 43 de 51 (84 %) |
| Errores claros (DOI inexistente o de otro trabajo) | 0 | 0 | 0 |
| Sin confirmar (fuera de Crossref y OpenAlex, sitio que bloquea robots o DOI equivocado de un trabajo real) | 2 | 7 | 8 |

\* En LetXinet se verificó una muestra (hasta 3 con DOI y 3 con enlace por consulta); sus referencias vienen directamente de las bases de datos.

### Por consulta (pertinentes de las encontradas)

| Consulta | LetXinet | IA con búsqueda web | IA sin búsqueda (memoria) |
|---|---|---|---|
| Q1. Control vectorial de Aedes aegypti en el Perú | 11 de 23 | 8 de 9 | 2 de 8 |
| Q2. Efectividad de la nebulización espacial con insecticidas para el control del dengue | 0 de 24 | 7 de 9 | 3 de 7 |
| Q3. Dengue en Chimbote, Áncash: epidemiología y factores de riesgo | 0 de 23 | 2 de 2 | 0 de 3 |
| Q4. Resistencia a insecticidas piretroides en Aedes aegypti en Perú | 6 de 26 | 6 de 8 | 1 de 7 |
| Q5. Anemia infantil en el Perú: factores asociados | 13 de 30 | 5 de 5 | 5 de 7 |
| Q6. Stevia rebaudiana: actividad antioxidante y usos | 15 de 24 | 7 de 7 | 8 de 8 |
| Q7. Calidad del agua de consumo humano en Chimbote (tesis) | 2 de 31 | 3 de 4 | 2 de 3 |
| Q8. Machine learning for dengue outbreak prediction | 33 de 60 | 6 de 6 | 8 de 8 |

### Referencias con problemas

**IA con busqueda web** (7):

- Q1 · *Costos del control del vector en Loreto durante la implementacion de un plan regional de vigilancia y control *: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Cepas nativas de Bacillus thuringiensis de la costa peruana con actividad larvicida sobre Aedes (Stegomyia) ae*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Presentacion CNSP-INS: resistencia de Aedes aegypti a insecticidas en distritos del Peru (teleconferencia DGE-*: url no confirmada. sin respuesta en 20 s (https://www.dge.gob.pe/portal/docs/tools/teleconferencia/ (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q2 · *Bioensayos de formulaciones de insecticidas en nebulizacion en frio y termonebulizacion en cepas de Aedes de C*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q4 · *Presentacion CNSP-INS: mapas de distritos con poblaciones de Aedes aegypti resistentes a piretroides 2015 y 20*: url no confirmada. sin respuesta en 20 s (https://www.dge.gob.pe/portal/docs/tools/teleconferencia/ (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q5 · *Tesis USAT (archivo TL_SanchezNunezElizet; titulo no visible, tema anemia infantil no confirmado)*: url rota. fetch failed ENOTFOUND (https://tesis.usat.edu.pe/bitstream/20.500.12423/7078/1/
- Q6 · *Stevia rebaudiana Bertoni'nin Antioksidan, Antimikrobiyal ve Antidiyabetik Ozellikleri: Sistematik Derleme*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)

**IA sin busqueda (memoria)** (8):

- Q1 · *Dengue en el Perú: aspectos históricos y su diseminación en los últimos 20 años*: no encontrada. lo mas parecido: "La universidad y el poder en el Perú: los últimos cien años" (50 %)
- Q1 · *Norma técnica de salud para la vigilancia entomológica y control de Aedes aegypti, vector del dengue en el ter*: no encontrada. lo mas parecido: "Escenario de práctica para el fortalecimiento de competencias en vigilancia en s" (30 %)
- Q3 · *Dengue en el Perú: aspectos históricos y su diseminación en los últimos 20 años*: no encontrada. lo mas parecido: "La universidad y el poder en el Perú: los últimos cien años" (50 %)
- Q3 · *Boletín Epidemiológico del Perú (CDC-MINSA): reportes y sala situacional de dengue*: no encontrada. lo mas parecido: "Estudio epidemiológico del dengue en España, año 2022" (33 %)
- Q4 · *Vigilancia de la resistencia a insecticidas en Aedes aegypti en el Perú*: no encontrada. lo mas parecido: "Resistencia a insecticidas y detoxificación en el mosquito Aedes aegypti, vector" (67 %)
- Q6 · *Oxidative DNA damage preventive activity and antioxidant potential of Stevia rebaudiana (Bertoni) Bertoni, a n* (DOI 10.1021/jf071892+): existe con otro doi. el DOI no existe; el trabajo si existe con DOI 10.1021/jf071892q (Crossref)
- Q7 · *Evaluación de la calidad del agua de consumo humano en Chimbote (título aproximado, reconstruido de memoria)*: no verificable. sin DOI, sin enlace y sin titulo completo
- Q7 · *Calidad fisicoquímica y bacteriológica del agua potable en Nuevo Chimbote (título aproximado, reconstruido de *: no verificable. sin DOI, sin enlace y sin titulo completo

**LetXinet** (2):

- Q1 · *Conocimiento y Actitud preventiva sobre el Zika en mujeres del AAHH San Antonio del terminal del distrito De S*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Mosquitos culícidos en dos áreas endémicas de dengue en Ayacucho: taxonomía, ecología larval y distribución po*: url no confirmada. sin respuesta en 20 s (https://hdl.handle.net/20.500.12672/20873) (el sitio bloquea robots o no respondio; en un navegador puede abrir)
