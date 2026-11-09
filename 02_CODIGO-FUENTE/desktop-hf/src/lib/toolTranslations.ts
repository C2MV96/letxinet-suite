import { Language } from './i18n';

export interface ToolDescriptionObject {
  name: string;
  description?: string;
}

const TOOL_DESCRIPTIONS: Record<string, { es: string; en: string; pt: string }> = {
  // LetXipu Academic & Scientific Search
  batch_search: {
    es: "Búsqueda académica paralela multiconsulta en más de 32 fuentes científicas. Deduplica globalmente y amplía la cobertura en Latinoamérica y repositorios mundiales.",
    en: "Parallel multi-query academic search across 32+ scientific sources. Globally deduplicates and expands coverage across LatAm and global repositories.",
    pt: "Pesquisa acadêmica paralela com múltiplas consultas em mais de 32 fontes científicas. Elimina duplicatas globalmente e amplia a cobertura em repositórios da América Latina e mundiais."
  },
  search: {
    es: "Búsqueda académica simple en más de 32 fuentes científicas. Filtra por año, universidad y palabras clave.",
    en: "Single-query academic search across 32+ scientific sources. Filters by year, university, and keywords.",
    pt: "Pesquisa acadêmica simples em mais de 32 fontes científicas. Filtra por ano, universidade e palavras-chave."
  },
  smart_search: {
    es: "Búsqueda académica inteligente con generación automática de variaciones de términos, sinónimos y filtrado de falsos positivos.",
    en: "Smart academic search with automatic query variation, synonyms, and false positive filtering.",
    pt: "Pesquisa acadêmica inteligente com geração automática de variações de termos, sinônimos e filtragem de falsos positivos."
  },
  enrich_metadata: {
    es: "Enriquece metadatos de artículos (resumen, DOI, año, universidad, autores, URL de PDF) usando la red de fuentes LetXipu.",
    en: "Enriches paper metadata (abstract, DOI, year, university, authors, PDF URL) using the LetXipu network.",
    pt: "Enriquece metadados de artigos (resumo, DOI, ano, universidade, autores, URL do PDF) usando a rede LetXipu."
  },
  fetch_metadata: {
    es: "Obtiene metadatos completos para un documento científico individual por DOI, URL o título.",
    en: "Fetches complete metadata for a single scientific paper by DOI, URL, or title.",
    pt: "Obtém metadados completos de um artigo científico individual por DOI, URL ou título."
  },
  recover_metadata: {
    es: "Recuperación profunda de metadatos mediante encadenamiento de identificadores (DOI, URL, handle o título).",
    en: "Deep metadata recovery chaining multiple identifiers (DOI, URL, handle, or title).",
    pt: "Recuperação profunda de metadados via encadeamento de identificadores (DOI, URL, handle ou título)."
  },
  download_pdf: {
    es: "Resuelve y obtiene el enlace directo de descarga del PDF desde DOI, URL de repositorio o PMC.",
    en: "Resolves and gets the direct PDF download URL from DOI, repository URL, or PMC.",
    pt: "Resolve e obtém o link direto de download do PDF a partir de DOI, URL de repositório ou PMC."
  },
  resolve_pdf: {
    es: "Resuelve la URL final del PDF sin descargarlo, indicando la fuente de resolución.",
    en: "Resolves the final PDF URL without downloading it, indicating the resolution source.",
    pt: "Resolve a URL final do PDF sem baixá-lo, indicando a fonte de resolução."
  },
  list_sources: {
    es: "Lista todas las fuentes de búsqueda científica disponibles con sus identificadores y descripciones.",
    en: "Lists all available scientific search sources with their IDs and descriptions.",
    pt: "Lista todas as fontes de pesquisa científica disponíveis com seus identificadores e descrições."
  },
  health_check: {
    es: "Verifica el estado de conectividad y disponibilidad de todas las fuentes académicas configuradas.",
    en: "Checks connectivity and availability status of all configured academic sources.",
    pt: "Verifica o status de conectividade e disponibilidade de todas as fontes acadêmicas configuradas."
  },
  coverage_report: {
    es: "Obtiene métricas de cobertura por país y fuente: repositorios activos, latencia y disponibilidad.",
    en: "Gets coverage metrics by country and source: active repositories, latency, and uptime.",
    pt: "Obtém métricas de cobertura por país e fonte: repositórios ativos, latência e disponibilidade."
  },
  help: {
    es: "Obtiene ayuda y ejemplos de uso para cualquier herramienta o fuente específica del MCP.",
    en: "Gets help and usage examples for any specific MCP tool or source.",
    pt: "Obtém ajuda e exemplos de uso para qualquer ferramenta ou fonte específica do MCP."
  },
  search_dblp: {
    es: "Busca en la bibliografía de ciencias de la computación DBLP por publicaciones, autores o conferencias.",
    en: "Searches DBLP Computer Science Bibliography for publications, authors, or venues.",
    pt: "Pesquisa na bibliografia de ciência da computação DBLP por publicações, autores ou conferências."
  },
  search_paperswithcode: {
    es: "Busca en Papers With Code artículos científicos con código fuente, benchmarks y datasets asociados.",
    en: "Searches Papers With Code for research papers featuring source code, benchmarks, and datasets.",
    pt: "Pesquisa no Papers With Code artigos científicos com código fonte, benchmarks e conjuntos de dados."
  },
  trending_papers: {
    es: "Obtiene artículos científicos en tendencia de HuggingFace Daily Papers con opción de filtro por tema.",
    en: "Fetches trending research papers from HuggingFace Daily Papers with optional topic filtering.",
    pt: "Obtém artigos científicos em tendência do HuggingFace Daily Papers com opção de filtro por tópico."
  },
  search_conferences: {
    es: "Busca artículos de conferencias internacionales (ICLR, NeurIPS, ICML, etc.) en OpenReview.",
    en: "Searches international conference papers (ICLR, NeurIPS, ICML, etc.) on OpenReview.",
    pt: "Pesquisa artigos de conferências internacionais (ICLR, NeurIPS, ICML, etc.) no OpenReview."
  },

  // LetXipu PDF / OCR / Document Processing
  read_pdf: {
    es: "Extrae el contenido de un documento PDF en formato Markdown estructurado mediante MinerU AI con OCR.",
    en: "Extracts PDF document text into structured Markdown using MinerU AI with OCR.",
    pt: "Extrai o conteúdo de um documento PDF em formato Markdown estruturado usando MinerU AI com OCR."
  },
  pdf_metadata: {
    es: "Obtiene los metadatos de un PDF: título, autor, número de páginas, fecha de creación y tamaño.",
    en: "Gets PDF document metadata: title, author, page count, creation date, and file size.",
    pt: "Obtém os metadados de um PDF: título, autor, número de páginas, data de criação e tamanho."
  },
  pdf_sections: {
    es: "Detecta automáticamente las secciones de un artículo científico (Resumen, Introducción, Métodos, Resultados, Conclusiones).",
    en: "Automatically detects academic paper sections (Abstract, Introduction, Methods, Results, Conclusions).",
    pt: "Detecta automaticamente as seções de um artigo científico (Resumo, Introdução, Métodos, Resultados, Conclusões)."
  },
  pdf_citations: {
    es: "Extrae y analiza las citas bibliográficas y la lista de referencias de un artículo en PDF.",
    en: "Extracts and parses citations and the reference list from an academic PDF paper.",
    pt: "Extrai e analisa as citações e a lista de referências de um artigo em PDF."
  },
  analyze_academic: {
    es: "Análisis académico profundo de tesis y artículos: detecta tipo de documento, estructura y aportes principales.",
    en: "Deep academic analysis of theses and papers: detects document type, structure, and key contributions.",
    pt: "Análise acadêmica profunda de teses e artigos: detecta tipo de documento, estrutura e contribuições principais."
  },
  extract_section: {
    es: "Extrae una sección específica de un PDF por su nombre (ej. metodología, marco teórico, conclusiones).",
    en: "Extracts a specific section from a PDF by name (e.g., methodology, literature review, conclusions).",
    pt: "Extrai uma seção específica de um PDF pelo nome (ex.: metodologia, fundamentação teórica, conclusões)."
  },
  read_pdf_markdown: {
    es: "Convierte PDF a Markdown estructurado preservando encabezados, tablas y listas ordenadas.",
    en: "Converts PDF to structured Markdown preserving headings, tables, and ordered lists.",
    pt: "Converte PDF para Markdown estruturado preservando cabeçalhos, tabelas e listas."
  },
  pdf_smart_summary: {
    es: "Genera un resumen inteligente y compacto de un documento PDF académico optimizado en consumo de tokens.",
    en: "Generates a token-efficient smart summary of an academic PDF document.",
    pt: "Gera um resumo inteligente e compacto de um documento PDF acadêmico otimizado em uso de tokens."
  },
  convert_document: {
    es: "Convierte cualquier documento (PDF, DOCX, PPTX, XLSX, imágenes) a Markdown estructurado mediante MinerU AI.",
    en: "Converts any document (PDF, DOCX, PPTX, XLSX, images) to structured Markdown via MinerU AI.",
    pt: "Converte qualquer documento (PDF, DOCX, PPTX, XLSX, imagens) para Markdown estruturado via MinerU AI."
  },
  batch_convert: {
    es: "Convierte múltiples documentos a Markdown en paralelo utilizando procesamiento por lotes con MinerU AI.",
    en: "Converts multiple documents to Markdown in parallel using batch processing with MinerU AI.",
    pt: "Converte múltiplos documentos para Markdown em paralelo usando processamento em lote com MinerU AI."
  },
  extract_tables: {
    es: "Extrae todas las tablas de un documento en formato HTML o Markdown con detección inteligente de celdas.",
    en: "Extracts all tables from a document as HTML or Markdown using ML-based table detection.",
    pt: "Extrai todas as tabelas de um documento em formato HTML ou Markdown com detecção inteligente de células."
  },
  extract_formulas: {
    es: "Extrae todas las fórmulas matemáticas de un documento convirtiéndolas a código LaTeX con UniMERNet.",
    en: "Extracts all mathematical formulas from a document converting them to LaTeX via UniMERNet.",
    pt: "Extrai todas as fórmulas matemáticas de um documento convertendo-as para código LaTeX com UniMERNet."
  },

  // Orchestration & Async
  orchestrate: {
    es: "Orquestación automática de búsqueda y síntesis científica autónoma basada en una consulta temática.",
    en: "Automated orchestration for scientific search and synthesis based on a thematic query.",
    pt: "Orquestração automática de pesquisa e síntese científica autônoma baseada em uma consulta temática."
  },
  research_async: {
    es: "Inicia un trabajo de investigación en segundo plano y devuelve un ID de seguimiento (jobId).",
    en: "Launches a background research task and returns a job tracking ID (jobId).",
    pt: "Inicia uma tarefa de pesquisa em segundo plano e retorna um ID de acompanhamento (jobId)."
  },
  job_status: {
    es: "Consulta el estado en tiempo real y progreso de un trabajo de investigación asíncrono.",
    en: "Checks real-time status and progress of an asynchronous research job.",
    pt: "Consulta o status em tempo real e progresso de uma tarefa de pesquisa assíncrona."
  },

  // LetXipu OSM (OpenStreetMap / Geolocation)
  geocode_address: {
    es: "Convierte una dirección, lugar o coordenadas militares a coordenadas geográficas (latitud, longitud).",
    en: "Converts an address, landmark, or military grid location to geographic coordinates (lat, lon).",
    pt: "Converte um endereço, local ou coordenadas militares em coordenadas geográficas (latitude, longitude)."
  },
  reverse_geocode: {
    es: "Convierte coordenadas geográficas (latitud, longitud) a una dirección física legible.",
    en: "Converts geographic coordinates (latitude, longitude) to a human-readable street address.",
    pt: "Converte coordenadas geográficas (latitude, longitude) em um endereço físico legível."
  },
  find_nearby_places: {
    es: "Encuentra puntos de interés (restaurantes, farmacias, tiendas) cerca de una ubicación específica.",
    en: "Finds points of interest (restaurants, pharmacies, shops) near a specific location.",
    pt: "Encontra pontos de interesse (restaurantes, farmácias, lojas) perto de uma localização específica."
  },
  find_parking_facilities: {
    es: "Encuentra estacionamientos y zonas de aparcamiento cerca de una coordenada.",
    en: "Finds parking facilities and zones near specific coordinates.",
    pt: "Encontra estacionamentos e áreas de paragem perto de coordenadas específicas."
  },
  find_schools_nearby: {
    es: "Encuentra instituciones educativas (colegios, universidades) cercanas a una coordenada.",
    en: "Finds educational institutions (schools, universities) near specific coordinates.",
    pt: "Encontra instituições educacionais (escolas, universidades) próximas a coordenadas específicas."
  },
  find_charging_stations: {
    es: "Localiza estaciones de carga para vehículos eléctricos cerca de una posición.",
    en: "Locates EV charging stations near a specified location.",
    pt: "Locatiza estações de carregamento para veículos elétricos perto de uma posição."
  },
  explore_area: {
    es: "Explora y describe una zona geográfica calculando densidad de puntos de interés y servicios.",
    en: "Explores and describes a geographic area, computing POI density and amenities.",
    pt: "Explora e descreve uma área geográfica calculando densidade de pontos de interesse e serviços."
  },
  analyze_neighborhood: {
    es: "Evalúa la habitabilidad de un barrio o vecindario para análisis inmobiliario o de reubicación.",
    en: "Evaluates neighborhood livability for real estate or relocation analysis.",
    pt: "Avalia a habitabilidade de um bairro para análise imobiliária ou de relocação."
  },
  get_route_directions: {
    es: "Obtiene instrucciones paso a paso para una ruta entre dos ubicaciones (auto, caminata, bici).",
    en: "Gets turn-by-turn driving, walking, or cycling directions between two locations.",
    pt: "Obtém instruções passo a passo para uma rota entre duas localizações (carro, caminhada, bicicleta)."
  },
  route_fetch: {
    es: "Obtiene la geometría de ruta y tiempos de viaje mediante servicio OSRM entre dos puntos.",
    en: "Fetches route geometry and estimated travel times using OSRM routing service.",
    pt: "Obtém a geometria da rota e tempos de viagem via serviço OSRM entre dois pontos."
  },
  analyze_commute: {
    es: "Analiza opciones de transporte e itinerario de desplazamiento diario entre hogar y trabajo.",
    en: "Analyzes daily commute transportation options between home and work locations.",
    pt: "Analisa opções de transporte e trajeto diário entre casa e trabalho."
  },
  geo_distance: {
    es: "Calcula la distancia geográfica en línea recta entre dos coordenadas usando la fórmula de Haversine.",
    en: "Calculates the straight-line geographic distance between two coordinates using the Haversine formula.",
    pt: "Calcula a distância geográfica em linha reta entre duas coordenadas usando a fórmula de Haversine."
  },
  suggest_meeting_point: {
    es: "Sugiere un punto de encuentro equidistante y óptimo para múltiples participantes.",
    en: "Suggests an optimal equidistant meeting point for multiple participants.",
    pt: "Sugere um ponto de encontro equidistante e ideal para múltiplos participantes."
  },
  centroid_points: {
    es: "Calcula el centroide geográfico (punto medio ponderado) de un conjunto de coordenadas.",
    en: "Calculates the geographic centroid (mean center) of a set of coordinates.",
    pt: "Calcula o centroide geográfico (ponto médio ponderado) de um conjunto de coordenadas."
  },
  bbox_from_points: {
    es: "Crea una caja delimitadora (bounding box) que engloba un conjunto de puntos geográficos.",
    en: "Creates a bounding box encompassing a set of geographic points.",
    pt: "Cria uma caixa delimitadora (bounding box) que engloba um conjunto de pontos geográficos."
  },
  polyline_encode: {
    es: "Codifica una serie de coordenadas geográficas en una cadena de polilínea compacta.",
    en: "Encodes a series of geographic coordinates into a compact polyline string.",
    pt: "Codifica uma série de coordenadas geográficas em uma string de polilinha compacta."
  },
  polyline_decode: {
    es: "Decodifica una cadena de polilínea compacta a su lista original de coordenadas.",
    en: "Decodes a compact polyline string into its original list of coordinates.",
    pt: "Decodifica uma string de polilinha compacta em sua lista original de coordenadas."
  },
  route_sample: {
    es: "Muestra puntos muestreados a lo largo de una polilínea de ruta a intervalos especificados.",
    en: "Samples points along a route polyline at specified intervals.",
    pt: "Amostra pontos ao longo de uma polilinha de rota em intervalos especificados."
  },
  enrich_emissions: {
    es: "Calcula estimaciones de emisiones de CO2, consumo de calorías y costos para rutas de transporte.",
    en: "Estimates CO2 emissions, calorie burn, and travel costs for transport options.",
    pt: "Calcula estimativas de emissões de CO2, queima de calorias e custos para rotas de transporte."
  },
  get_map_image: {
    es: "Obtiene y muestra una imagen de mapa satelital/estático de OpenStreetMap para análisis.",
    en: "Retrieves an OpenStreetMap static map image for geographic analysis.",
    pt: "Obtém e exibe uma imagem de mapa estático do OpenStreetMap para análise."
  },
  get_version: {
    es: "Obtiene información de versión y estado del servicio de datos OpenStreetMap.",
    en: "Gets version and status information of the OpenStreetMap MCP service.",
    pt: "Obtém informações de versão e status do serviço OpenStreetMap MCP."
  },
  osm_query_bbox: {
    es: "Consulta datos raw de OpenStreetMap dentro de un recuadro geográfico con filtros de etiquetas.",
    en: "Queries raw OpenStreetMap data within a bounding box with tag filters.",
    pt: "Consulta dados brutos do OpenStreetMap dentro de uma caixa delimitadora com filtros de tags."
  },
  filter_tags: {
    es: "Filtra elementos de OpenStreetMap por etiquetas de atributos específicos (ej. amenity, highway).",
    en: "Filters OpenStreetMap elements by specific attribute tags (e.g., amenity, highway).",
    pt: "Filtra elementos do OpenStreetMap por tags de atributos específicos (ex.: amenity, highway)."
  },
  sort_by_distance: {
    es: "Ordena una lista de elementos u objetos geográficos según su distancia a un punto de referencia.",
    en: "Sorts a list of geographic elements by distance relative to a reference point.",
    pt: "Ordena uma lista de elementos geográficos por distância em relação a um ponto de referência."
  },
  tile_cache: {
    es: "Gestiona el almacenamiento en caché de teselas de mapa para un rendimiento óptimo de renderizado.",
    en: "Manages map tile caching for optimized rendering performance.",
    pt: "Gerencia o armazenamento em cache de blocos de mapa para desempenho ideal de renderização."
  },

  // Agents & Search
  web_search: {
    es: "Búsqueda web general en tiempo real (vía Yahoo/Motores agregados). Retorna sitios y noticias actualizadas.",
    en: "Real-time general web search (via Yahoo/Aggregated engines). Returns live sites and news.",
    pt: "Pesquisa web geral em tempo real (via Yahoo/Mecanismos agregados). Retorna sites e notícias atualizadas."
  },
  "webwright.run.cli": {
    es: "Agente navegador Webwright CLI: realiza navegación activa en sitios web, scraping dinámico e interacción.",
    en: "Webwright browser agent CLI: performs active web navigation, dynamic scraping, and site interaction.",
    pt: "Agente navegador Webwright CLI: realiza navegação web ativa, extração dinâmica e interação em sites."
  },
  verify_antihallucination_data: {
    es: "Agente de verificación y autocorrección anti-alucinación. Contrasta afirmaciones contra evidencias de origen.",
    en: "Anti-hallucination verification and self-correction agent. Cross-checks claims against source evidence.",
    pt: "Agente de verificação e autocorreção anti-alucinação. Compara afirmações com evidências de origem."
  }
};

/**
 * Returns the tool description translated into Spanish, English, or Portuguese based on `lang`.
 */
export function getToolDescription(tool: ToolDescriptionObject | undefined, lang: Language = 'es'): string {
  if (!tool) return '';
  const item = TOOL_DESCRIPTIONS[tool.name];
  if (item && item[lang]) {
    return item[lang];
  }
  // Fallback to existing tool.description or empty string
  return tool.description || '';
}
