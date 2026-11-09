# B: prueba de las herramientas PDF y de documentos de LetXinet v11 y MarkItDown

- Fecha: 2026-11-01, de 14:06 a 14:15 (hora local).
- Caso de prueba: la tesis UNT «Relación entre el perfil lipídico y el grado de la hipertensión arterial… Chimbote, 2025».
- Rutas: todas las rutas locales se pasaron con barras normales (`C:/Users/...`) y funcionaron. No hizo falta usar `\\`.
- Archivo .docx: se probó una COPIA en el scratchpad (`tesis_copia.docx`). El original no se tocó.
- Latencia: se midió con `date` antes y después de cada llamada. Es aproximada (±3 s) porque incluye la ida y vuelta del cliente.
- Criterio de timeout: más de 120 s. Ninguna llamada pasó de 120 s, pero una dio el error "The operation timed out" a unos 63 s (ver la n.º 20).

## Registro de llamadas

| # | Herramienta | Argumentos (resumen) | Estado | Latencia | Resultado y calidad |
|---|---|---|---|---|---|
| 1 | markitdown_health | — | ✅ éxito | ~1 s | El servicio responde (`http://127.0.0.1:7860`) con el motor PyMuPDF4LLM y acepta los formatos de páginas all/1-5/first5/last3. |
| 2 | resolve_pdf | `10.3389/fendo.2022.916951` | ✅ éxito | ~2 s | Resolvió la URL desde Unpaywall: `https://www.frontiersin.org/articles/10.3389/fendo.2022.916951/pdf`. Detalla los pasos seguidos. |
| 3 | download_pdf | `doi=10.3389/fendo.2022.916951` | ⚠️ parcial | ~2 s | **No descarga ningún archivo**: solo devuelve `pdfUrl = https://doi.org/10.3389/...`, que es la página del DOI y no el PDF, así que da peor resultado que resolve_pdf. Tampoco tiene un parámetro de carpeta de destino. Para guardar el archivo usé `curl` con la URL de resolve_pdf, que dejó `descargas/Xie_2022_fendo.pdf` (652 353 bytes, `%PDF-1.4`, mismo tamaño que `38_Xie_2022.pdf`). |
| 4 | pdf_metadata | Xie 2022 (local) | ✅ éxito | ~2 s | Devuelve el título, los 13 autores, 12 páginas, la fecha de creación y el tamaño. Los datos son exactos. |
| 5 | pdf_smart_summary | Xie 2022, maxTotalChars=8000 | ✅ éxito | ~10 s | Detecta el tipo (article), el idioma (en) y 8 secciones con su vista previa. Buen markdown (MinerU). El presupuesto de 8000 caracteres corta los resultados antes de los HR. |
| 6 | read_pdf | Xie, pages=1, format=text | ✅ éxito | ~2 s | Saca el texto limpio del abstract completo, incluido el HR 1.369 [1.164–1.610]. Pega algunas palabras ("HankunXie", "Thisfinding"). El rango de páginas sí se respetó. |
| 7 | extract_section | Xie, "results" | ✅ éxito | ~4 s | Extrajo 20 582 caracteres con las tablas 1, 2, 3 y 5 en texto plano (columnas pegadas pero legibles) y contó los n y los p. La "sección" mezcla fragmentos de los métodos y la discusión. |
| 8 | pdf_sections (DEPRECATED) | Xie 2022 | ✅ éxito | ~10 s | Encontró 8 secciones con una vista previa de unos 500 caracteres cada una. En un PDF de 12 páginas no hubo timeout. Aporta poco frente a pdf_smart_summary. |
| 9 | pdf_citations | Xie 2022 | ⚠️ baja calidad | ~4 s | Dice "42 citas", pero el artículo tiene unas 50 referencias. **Corta las referencias por línea**: autores = "Global", "to 2015", "doi:10"…, y los años salen del título (por ejemplo, 1990). No sirve para armar una bibliografía. |
| 10 | pdf_smart_summary | 05_BacaCarrasco_2020 | ✅ éxito | ~20 s | Detecta que es una tesis en español de 51 páginas. Devuelve el resumen, el diseño (no experimental, descriptivo correlacional), el análisis (chi-cuadrado de Pearson) y la tabla 1 en markdown, con algunas celdas partidas ("Va / rones"). |
| 11 | read_pdf_markdown | 32_SegoviaHuaman_2024, pages=first5, maxChars=8000 | ⚠️ éxito parcial | ~38 s | Markdown de buena calidad (tablas de metadatos, resumen y abstract). **El parámetro `pages` se ignoró**: procesó las 61 páginas (originalChars=88 360) y después recortó. Además devuelve los DNI de las autoras y del asesor que trae la hoja de metadatos (no los copio aquí). |
| 12 | extract_section | Segovia, "prueba de hipótesis" | ✅ éxito | ~4 s | La coincidencia difusa encontró "Hipótesis" y trajo las tablas 05 y 06 de la prueba de Fisher (p = 0,331 y 0,133, n = 141) y la operacionalización. Es la herramienta más útil para la discusión. |
| 13 | analyze_academic | 05_BacaCarrasco_2020 | ⚠️ éxito, salida excesiva | ~7 s | Devolvió 80 939 caracteres en 106 secciones, **más de lo que admite el cliente** (la salida se guardó en un archivo). Las estadísticas globales sí son útiles: 41 valores p, n = 76/191 y medias. Hay ruido ("f=28112" detectado como prueba F). |
| 14 | markitdown_convert | Baca Carrasco, pages=5-9, maxChars=7000 | ✅ éxito | ~5 s | Markdown limpio del índice de tablas, el resumen y el abstract. El rango de páginas sí se respetó. Con esto confirmé todos los p de Baca Carrasco. Es rápido y fiable. |
| 15 | extract_tables | 03_Aygun_2022, markdown | ✅ éxito | ~10 s | Extrajo 5 tablas (ESC/AHA/CCS: categorías de riesgo, modificadores de riesgo, metas de LDL-C y muy alto riesgo) con buena estructura y celdas multilínea con `<br>`. Una tabla tiene columnas desalineadas ("Fa / mily history"). **Aygun no trae una tabla de puntos de corte tipo NCEP**: sus metas dependen del riesgo. |
| 16 | extract_tables | 33_Solnica_2024, markdown | ✅ éxito | ~17 s | Extrajo 11 tablas, entre ellas TG, CT, HDL por sexo, LDL según el riesgo, no-HDL, apoB, Lp(a) y una tabla resumen. Las tablas simples salieron excelentes. La tabla V (LDL) salió con texto de nota al pie truncado e intercalado, pero los valores se pueden recuperar. |
| 17 | extract_formulas | 24_Medina_2023 | ⚠️ 0 resultados | ~23 s | `formulas: []`. Comprobé con pypdf que el libro (60 páginas) no tiene ninguna fórmula de tamaño de muestra, así que es un verdadero negativo. |
| 18 | extract_formulas | 16_Hadi_2023 | ⚠️ 0 resultados | ~30 s | `formulas: []`. Comprobé con pypdf que Hadi solo **define** "población finita" (p. 72) y habla del "tamaño adecuado" (pp. 74 y 77), sin fórmula. También es un verdadero negativo, así que la herramienta no pudo probarse con una fórmula real. |
| 19 | convert_document | tesis_copia.docx | ❌ error | ~5 s | `Invalid PDF: file does not start with %PDF- header`. **No admite DOCX**, aunque la descripción dice "PDF, DOCX, PPTX, XLSX". |
| 20 | batch_convert | docx + 13_Dabrowska + 36_WHO_2025 (7,2 MB) | ❌ timeout del cliente | ~63 s | "The operation timed out" sin ningún resultado parcial. Lo más probable es que lo causara el PDF grande de la OMS. |
| 21 | batch_convert | 13_Dabrowska + 03_Aygun | ⚠️ éxito, sin contenido | ~20 s | 2 de 2 bien (42 706 y 46 117 caracteres, extractor pdf-parse), pero **solo devuelve los recuentos y no el texto**. `maxCharsPerDoc` no tiene efecto visible. |
| 22 | markitdown_convert | tesis_copia.docx | ❌ error | ~3 s | "Solo se aceptan archivos PDF". Es una limitación documentada del servicio. |
| 23 | convert_document | 13_Dabrowska_2023 (PDF) | ✅ éxito con aviso | ~17 s (timing_ms 17 069) | El texto sale bien (título, autores, abstract e introducción). **Aviso interno**: `markitdown failed … can't open file 'C:\snapshot\LETXIPU-SEARCH-MCP-V11-LOCAL\scripts\pdf_to_markdown.py'`, es decir, falta un script en el paquete v11 y la herramienta recurre a otro extractor. La salida parece texto plano y no markdown. |
| 24 | batch_convert | solo tesis_copia.docx | ❌ error por archivo | ~6 s | `Invalid PDF: file does not start with %PDF- header` (0 de 1). Confirma que no admite DOCX. |
| 25 | analyze_academic | 38_Xie_2022 (artículo) | ⚠️ éxito, ruido | ~11 s | 51 secciones, muchas mal etiquetadas (agradecimientos y financiación como "Población y Muestra", referencias como "Instrumentos"). Detecta N = 2116, los p y los porcentajes, pero **no reconoce los HR ni los IC**, y toma "t(2018" de las referencias como prueba t (falso positivo). |
| — | (fuera de la suite) curl | URL de resolve_pdf, a `descargas/` | ✅ | ~4 s | Solo se usó para suplir la limitación de download_pdf. |

En total hubo 25 llamadas a las 16 herramientas: todas se probaron al menos una vez.

## Conclusión por herramienta

| Herramienta | Veredicto | Comentario |
|---|---|---|
| resolve_pdf | ✅ | Rápida y correcta (Unpaywall). Es la que hay que usar para obtener la URL del PDF. |
| download_pdf | ⚠️ | No guarda ningún archivo ni acepta una carpeta de destino, y solo devolvió el enlace doi.org, que no es el PDF. Hay que complementarla con curl. |
| read_pdf | ✅ | Respeta `pages` y `maxChars`. El texto es bueno, con algunas palabras pegadas. |
| read_pdf_markdown | ⚠️ | El markdown es de buena calidad, pero **ignora `pages`**, procesa todo el documento y es lento (38 s). |
| pdf_metadata | ✅ | Exacta e instantánea. |
| pdf_sections | ✅/⚠️ | Funcionó en 12 páginas, pero está marcada como DEPRECATED y es mejor usar pdf_smart_summary. |
| pdf_citations | ⚠️ | El análisis de referencias en dos columnas falla: autores y años erróneos. No sirve para la bibliografía. |
| extract_section | ✅ | La mejor del grupo: búsqueda difusa en español, contenido completo y estadísticos. |
| pdf_smart_summary | ✅ | Es un buen primer paso: detecta el tipo de documento, el idioma, el diseño y el análisis. |
| analyze_academic | ⚠️ | Detecta bien los p y los n, pero clasifica mal las secciones, no reconoce los HR/OR/IC, da falsos positivos y en tesis largas su salida desborda el contexto. |
| extract_tables | ✅ | Tablas de buena calidad en Aygun y Solnica. Algunas celdas con notas al pie salen desordenadas. |
| extract_formulas | ⚠️ | Devolvió 0 en los dos libros, lo cual es correcto porque no contienen la fórmula. Su capacidad real queda sin probar. |
| convert_document | ⚠️ | Funciona con PDF, aunque avisa de un script interno que falta. **Con DOCX da error**, aunque la descripción dice que lo admite. |
| batch_convert | ❌/⚠️ | Da timeout con un PDF de 7 MB, no admite DOCX y, cuando funciona, solo devuelve recuentos de caracteres y no el contenido. |
| markitdown_convert | ✅ (solo PDF) | Rápido, respeta las páginas y da un markdown limpio. Rechaza los DOCX por diseño. |
| markitdown_health | ✅ | Servicio en línea. |

### Limitaciones clave detectadas
1. **Ninguna de las tres herramientas de conversión admite .docx** (convert_document, batch_convert, markitdown_convert). Para la tesis en Word hay que usar python-docx, la extracción del XML o el skill docx. Para estas pruebas extraje el texto de la copia leyendo `word/document.xml`.
2. download_pdf no descarga nada: solo resuelve una URL, y además una peor que la de resolve_pdf.
3. Hay un bug de empaquetado en v11: falta `scripts/pdf_to_markdown.py` en `C:\snapshot\LETXIPU-SEARCH-MCP-V11-LOCAL`.
4. Ninguna herramienta pidió URL ni archivos remotos: todas aceptaron rutas locales con `/`.
5. Privacidad: read_pdf_markdown devolvió números de DNI de la hoja de metadatos de una tesis. Conviene no volcar esa hoja en documentos compartidos.
