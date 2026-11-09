# Informe del pool de harnesses de LetXinet Suite

Fecha: 8/11/2026, 8:59:49 a. m.. Carpeta: `C:\Users\USER\Downloads\LetXinet-Suite-v1.1.0-Paquete-Completo\04_SCRIPTS-MANTENIMIENTO\harness\pool\resultados\20261108-1236`.

**Resumen:** 214 pruebas en 11 harnesses: 179 OK, 24 avisos, 1 fallas, 10 fallos de la red externa y 0 omitidas.

Estados: **OK** correcto; **AVISO** funciona con una limitación; **FALLA** error de LetXinet; **RED** falló un servicio externo o la red (no LetXinet); **OMITIDA** no aplicaba.

| Harness | OK | Avisos | Fallas | Red | Omitidas | Duración |
|---|---|---|---|---|---|---|
| h01 Servicios y salud | 10 | 0 | 0 | 0 | 0 | 9 s |
| h02 V11: las 28 herramientas | 35 | 4 | 0 | 0 | 0 | 284 s |
| h03 V11: cada fuente por separado (consulta "dengue") | 23 | 16 | 0 | 0 | 0 | 104 s |
| h04 OSM: las 28 herramientas | 22 | 1 | 1 | 10 | 0 | 809 s |
| h05 MarkItDown | 4 | 2 | 0 | 0 | 0 | 10 s |
| h06 Puentes MCP por stdio | 24 | 0 | 0 | 0 | 0 | 64 s |
| h07 Configurador de clientes | 20 | 0 | 0 | 0 | 0 | 12 s |
| h08 Gateway de LetXinet Desktop | 10 | 0 | 0 | 0 | 0 | 2 s |
| h09 Rendimiento y carga | 7 | 1 | 0 | 0 | 0 | 27 s |
| h10 Seguridad | 16 | 0 | 0 | 0 | 0 | 12 s |
| h11 Comparativo: lado LetXinet | 8 | 0 | 0 | 0 | 0 | 403 s |

## Fallas, avisos y fallos de red

### Fallas (1)

- **h04 · Nominatim · geocode_address (hospital):** {"code":"LOW_CONFIDENCE_RESULTS","message":"All candidates were filtered out by the importance threshold","query":"Hospital Regional Eleazar Guzmán Barrón, Nuevo Chimbote","threshold":0.05,"discarded":[{"name":"Hospital Eleazar Guzmán Barrón, Avenida Brasil, S

### Avisos (24)

- **h02 · Metadatos · recover_metadata por titulo:** no recupero el DOI: { "success": true, "data": { "title": "Is dengue vector control deficient in effectiveness or evidence?", "authors": [], "year": null, "abstract": "",
- **h02 · PDF · resolve_pdf desde repositorio peruano:** sin PDF: El repositorio (repositorio.usmp.edu.pe) pide una verificacion anti-robots: abre el enlace en un navegador
- **h02 · PDF · read_pdf con ruta local de Windows:** no acepta rutas locales de este PC; hay que pasar una URL o un DOI
- **h02 · Configuracion · MINERU_API_KEY y convert_document con URL:** tiene un valor de 11 caracteres que no parece una clave completa; desde 1.1.3 convert_document lo tolera, pero MinerU no funcionara hasta cargar la clave real
- **h03 · Global · openalex (OpenAlex):** 0 resultados en 0 s
- **h03 · Global · semantic (Semantic Scholar):** 0 resultados en 1 s
- **h03 · Global · scopus (Scopus):** 0 resultados en 1 s
- **h03 · Global · zenodo (Zenodo):** 0 resultados en 7 s
- **h03 · Global · core (CORE):** 0 resultados en 2 s
- **h03 · LatAm · redalyc (Redalyc):** 0 resultados en 3 s
- **h03 · Mexico · laref_mexico (La Referencia (México)):** 0 resultados en 29 s
- **h03 · Argentina · laref_argentina (La Referencia (Argentina)):** 0 resultados en 25 s
- **h03 · Uruguay · uruguay (Timbo):** 0 resultados en 42 s
- **h03 · Ecuador · laref_ecuador (La Referencia (Ecuador)):** 0 resultados en 41 s
- **h03 · Colombia · laref_colombia (La Referencia (Colombia)):** 0 resultados en 24 s
- **h03 · Global · dblp (DBLP):** 0 resultados en 13 s
- **h03 · Global · serpapi (Google Scholar):** 0 resultados en 18 s
- **h03 · Chile · laref_chile (La Referencia (Chile)):** 0 resultados en 24 s
- **h03 · Global · huggingface (HuggingFace Daily Papers):** 0 resultados en 7 s
- **h03 · Global · paperswithcode (Papers With Code):** 0 resultados en 7 s
- **h04 · Calculo local · filter_tags con id numerico (como lo da Overpass):** rechaza id numerico con un mensaje poco claro: Invalid input format
- **h05 · API · DOCX (Word):** no convierte Word (HTTP 400); esta API solo acepta PDF
- **h05 · API · XLSX (Excel):** no convierte Excel (HTTP 400); esta API solo acepta PDF
- **h09 · V11 · latencia fetch_metadata (5 llamadas):** p50 2449 ms, p95 6686 ms, max 6686 ms, fallos 0

### Fallos de la red externa (10)

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

23 de 39 fuentes devolvieron resultados.

| Fuente | Región | Resultados | Tiempo | Estado |
|---|---|---|---|---|
| PubMed (`pubmed`) | Global | 40 | 14.7 s | OK |
| ALICIA (CONCYTEC) (`alicia`) | Peru | 39 | 0.9 s | OK |
| RENATI (SUNEDU) (`renati`) | Peru | 39 | 31.1 s | OK |
| RRAAE (`rraae`) | Ecuador | 28 | 3.2 s | OK |
| BDTD (`bdtd`) | Brazil | 28 | 4.2 s | OK |
| Oasisbr (`oasisbr`) | Brazil | 23 | 3.6 s | OK |
| ANID (`anid`) | Chile | 22 | 4.5 s | OK |
| La Referencia (`lareferencia`) | LatAm | 19 | 7.6 s | OK |
| SNRD (`snrd`) | Argentina | 10 | 5.3 s | OK |
| La Referencia (Brasil) (`laref_brasil`) | Brazil | 8 | 2.5 s | OK |
| SciELO (`scielo`) | LatAm/Spain | 8 | 3.2 s | OK |
| OpenAIRE (`openaire`) | Europe | 8 | 4.4 s | OK |
| MinCiencias (`minciencias`) | Colombia | 8 | 5.3 s | OK |
| Crossref (`crossref`) | Global | 8 | 7.5 s | OK |
| UNAM (`unam`) | Mexico | 8 | 7.6 s | OK |
| CONAHCyT (`conacyt`) | Mexico | 8 | 9.0 s | OK |
| DOAJ (`doaj`) | Global | 8 | 12.6 s | OK |
| arXiv (`arxiv`) | Global | 8 | 13.8 s | OK |
| La Referencia (Perú) (`laref_peru`) | Peru | 7 | 2.4 s | OK |
| KIMUK (`costarica`) | Costa Rica | 7 | 4.6 s | OK |
| OpenReview (`openreview`) | Global | 7 | 6.9 s | OK |
| Recolecta (`espana`) | Spain | 4 | 4.2 s | OK |
| REDICCES (`elsalvador`) | El Salvador | 3 | 2.5 s | OK |
| OpenAlex (`openalex`) | Global | 0 | 0.1 s | sin resultados |
| Semantic Scholar (`semantic`) | Global | 0 | 0.8 s | sin resultados |
| Scopus (`scopus`) | Global | 0 | 1.4 s | sin resultados |
| CORE (`core`) | Global | 0 | 1.6 s | sin resultados |
| Redalyc (`redalyc`) | LatAm | 0 | 3.4 s | sin resultados |
| HuggingFace Daily Papers (`huggingface`) | Global | 0 | 6.6 s | sin resultados |
| Papers With Code (`paperswithcode`) | Global | 0 | 6.7 s | sin resultados |
| Zenodo (`zenodo`) | Global | 0 | 7.1 s | sin resultados |
| DBLP (`dblp`) | Global | 0 | 13.2 s | sin resultados |
| Google Scholar (`serpapi`) | Global | 0 | 18.3 s | sin resultados |
| La Referencia (Colombia) (`laref_colombia`) | Colombia | 0 | 24.1 s | sin resultados |
| La Referencia (Chile) (`laref_chile`) | Chile | 0 | 24.1 s | sin resultados |
| La Referencia (Argentina) (`laref_argentina`) | Argentina | 0 | 24.8 s | sin resultados |
| La Referencia (México) (`laref_mexico`) | Mexico | 0 | 29.0 s | sin resultados |
| La Referencia (Ecuador) (`laref_ecuador`) | Ecuador | 0 | 41.1 s | sin resultados |
| Timbo (`uruguay`) | Uruguay | 0 | 42.4 s | sin resultados |

## Rendimiento

| Medición | p50 | p95 | Máximo | Fallos |
|---|---|---|---|---|
| geo distance | 3 ms | 104 ms | 104 ms | 0 |
| list sources | 16 ms | 20 ms | 20 ms | 0 |
| fetch metadata | 2449 ms | 6686 ms | 6686 ms | 0 |
| search laref peru | 646 ms | 1012 ms | 1012 ms | 0 |
| search pubmed | 1490 ms | 1546 ms | 1546 ms | 0 |

- 6 busquedas simultaneas en V11: 6 de 6 en 1455 ms (la mas lenta 1454 ms)
- 30 llamadas simultaneas a OSM (calculo local): 30 de 30 en 136 ms
- busqueda grande (maxSources 100): 50 resultados, 47 KB en 3205 ms

## Comparativo: LetXinet frente a IA con búsqueda web y a IA sin búsqueda

Pertinente = el título contiene los conceptos clave de la pregunta (misma regla para los tres lados, solo con el título). La IA elige sus referencias; LetXinet devuelve la lista completa de las bases de datos, con ruido.

| Indicador | LetXinet | IA con búsqueda web | IA sin búsqueda (memoria) |
|---|---|---|---|
| Referencias en total (8 consultas) | 165 | 50 | 51 |
| Pertinentes | 86 (52 % de precisión) | 44 (88 % de precisión) | 29 (57 % de precisión) |
| Pertinentes sobre el Perú | 38 | 24 | 11 |
| Tesis pertinentes | 22 | 13 | 2 |
| Tiempo por consulta | 30 s | 28 s | - |
| Sobre el Perú o de instituciones peruanas | 71 (43 %) | 28 (56 %) | 23 (45 %) |
| Tesis | 26 | 14 | 2 |
| Con DOI | 139 (84 %) | 8 (16 %) | 28 (55 %) |
| Con año | 152 (92 %) | 26 (52 %) | 46 (90 %) |
| Verificadas (DOI correcto, enlace que abre o encontrada por título) | 35 de 36 (97 %)* | 41 de 50 (82 %) | 42 de 51 (82 %) |
| Errores claros (DOI inexistente o de otro trabajo) | 0 | 0 | 0 |
| Sin confirmar (fuera de Crossref y OpenAlex, sitio que bloquea robots o DOI equivocado de un trabajo real) | 1 | 9 | 9 |

\* En LetXinet se verificó una muestra (hasta 3 con DOI y 3 con enlace por consulta); sus referencias vienen directamente de las bases de datos.

### Por consulta (pertinentes de las encontradas)

| Consulta | LetXinet | IA con búsqueda web | IA sin búsqueda (memoria) |
|---|---|---|---|
| Q1. Control vectorial de Aedes aegypti en el Perú | 16 de 16 | 8 de 9 | 2 de 8 |
| Q2. Efectividad de la nebulización espacial con insecticidas para el control del dengue | 0 de 1 | 7 de 9 | 3 de 7 |
| Q3. Dengue en Chimbote, Áncash: epidemiología y factores de riesgo | 3 de 19 | 2 de 2 | 0 de 3 |
| Q4. Resistencia a insecticidas piretroides en Aedes aegypti en Perú | 6 de 17 | 6 de 8 | 1 de 7 |
| Q5. Anemia infantil en el Perú: factores asociados | 11 de 19 | 5 de 5 | 5 de 7 |
| Q6. Stevia rebaudiana: actividad antioxidante y usos | 15 de 16 | 7 de 7 | 8 de 8 |
| Q7. Calidad del agua de consumo humano en Chimbote (tesis) | 0 de 15 | 3 de 4 | 2 de 3 |
| Q8. Machine learning for dengue outbreak prediction | 35 de 62 | 6 de 6 | 8 de 8 |

### Referencias con problemas

**IA con busqueda web** (9):

- Q1 · *Costos del control del vector en Loreto durante la implementacion de un plan regional de vigilancia y control *: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Cepas nativas de Bacillus thuringiensis de la costa peruana con actividad larvicida sobre Aedes (Stegomyia) ae*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Percepcion de efectividad del producto y renuencia de los hogares a actividades de control vectorial en distri*: url no confirmada. fetch failed ECONNRESET (https://repositorioslatinoamericanos.uchile.cl/handle/2 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q1 · *Presentacion CNSP-INS: resistencia de Aedes aegypti a insecticidas en distritos del Peru (teleconferencia DGE-*: url no confirmada. sin respuesta en 20 s (https://www.dge.gob.pe/portal/docs/tools/teleconferencia/ (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q2 · *Bioensayos de formulaciones de insecticidas en nebulizacion en frio y termonebulizacion en cepas de Aedes de C*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q4 · *Presentacion CNSP-INS: mapas de distritos con poblaciones de Aedes aegypti resistentes a piretroides 2015 y 20*: url no confirmada. sin respuesta en 20 s (https://www.dge.gob.pe/portal/docs/tools/teleconferencia/ (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q5 · *Tesis USAT (archivo TL_SanchezNunezElizet; titulo no visible, tema anemia infantil no confirmado)*: url rota. fetch failed ENOTFOUND (https://tesis.usat.edu.pe/bitstream/20.500.12423/7078/1/
- Q6 · *Stevia rebaudiana Bertoni'nin Antioksidan, Antimikrobiyal ve Antidiyabetik Ozellikleri: Sistematik Derleme*: url no confirmada. HTTP 403 (el sitio bloquea robots o no respondio; en un navegador puede abrir)
- Q7 · *Sistema de abastecimiento de agua potable en el AA.HH. Los Conquistadores, Nuevo Chimbote, con evaluacion de l*: url no confirmada. sin respuesta en 20 s (https://repositorio.ucv.edu.pe/bitstream/handle/20.500.12 (el sitio bloquea robots o no respondio; en un navegador puede abrir)

**IA sin busqueda (memoria)** (9):

- Q1 · *Dengue en el Perú: aspectos históricos y su diseminación en los últimos 20 años*: no encontrada. lo mas parecido: "La universidad y el poder en el Perú: los últimos cien años" (50 %)
- Q1 · *Norma técnica de salud para la vigilancia entomológica y control de Aedes aegypti, vector del dengue en el ter*: no encontrada. lo mas parecido: "Escenario de práctica para el fortalecimiento de competencias en vigilancia en s" (30 %)
- Q3 · *Dengue en el Perú: a 25 años de su reemergencia*: no encontrada. sin coincidencias en Crossref ni OpenAlex
- Q3 · *Dengue en el Perú: aspectos históricos y su diseminación en los últimos 20 años*: no encontrada. lo mas parecido: "La universidad y el poder en el Perú: los últimos cien años" (50 %)
- Q3 · *Boletín Epidemiológico del Perú (CDC-MINSA): reportes y sala situacional de dengue*: no encontrada. lo mas parecido: "Situation of Dengue after the Phenomenon of the Coastal El Niño" (17 %)
- Q4 · *Vigilancia de la resistencia a insecticidas en Aedes aegypti en el Perú*: no encontrada. lo mas parecido: "Resistencia a insecticidas y detoxificación en el mosquito Aedes aegypti, vector" (67 %)
- Q6 · *Oxidative DNA damage preventive activity and antioxidant potential of Stevia rebaudiana (Bertoni) Bertoni, a n* (DOI 10.1021/jf071892+): existe con otro doi. el DOI no existe; el trabajo si existe con DOI 10.1021/jf071892q (Crossref)
- Q7 · *Evaluación de la calidad del agua de consumo humano en Chimbote (título aproximado, reconstruido de memoria)*: no verificable. sin DOI, sin enlace y sin titulo completo
- Q7 · *Calidad fisicoquímica y bacteriológica del agua potable en Nuevo Chimbote (título aproximado, reconstruido de *: no verificable. sin DOI, sin enlace y sin titulo completo

**LetXinet** (1):

- Q2 · *“Casos positivos de dengue relacionado a los métodos de intervención entomológica de la localidad de San Franc*: url no confirmada. sin respuesta en 20 s (https://hdl.handle.net/20.500.12952/7027) (el sitio bloquea robots o no respondio; en un navegador puede abrir)
