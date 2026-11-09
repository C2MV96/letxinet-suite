import { useState, useEffect, useRef } from 'react';
import { ToolDefinition, ExecutionRecord } from '../types';
import { Terminal, Play, History, Copy, Check, Clock, AlertTriangle, FileJson, Sparkles, ChevronDown, ChevronRight, Square, Search, Layers, Filter } from 'lucide-react';
import ActiveToolsList from './ActiveToolsList';
import { useI18n } from '../lib/i18n';
import { getToolDescription } from '../lib/toolTranslations';

interface ConsolePlaygroundProps {
  tools: ToolDefinition[];
  selectedToolName: string;
  onSelectToolName: (name: string) => void;
  history: ExecutionRecord[];
  onAddHistory: (record: ExecutionRecord) => void;
  onClearHistory?: () => void;
  loadingTools?: boolean;
  onRefreshTools?: (server?: string) => Promise<void> | void;
}

// Complete, tested default argument presets for all 62 tools across all MCP servers
const DEFAULT_ARG_PRESETS: Record<string, any> = {
  // LetXipu Academic & Discovery Tools (Estrategia Atómica Dividir y Vencerás)
  batch_search: {
    queries: ["inteligencia artificial educacion Peru", "educacion superior universidad peruana"],
    sources: ["alicia", "renati", "latam", "global"],
    maxResults: 20
  },
  search: {
    query: "inteligencia artificial educacion Peru",
    sources: ["alicia", "renati", "latam", "global"],
    maxResults: 5
  },
  smart_search: {
    query: "robotica aplicada en la medicina peruana",
    sources: ["alicia", "renati", "latam", "global"],
    filterFalsePositives: true,
    maxSources: 15
  },
  enrich_metadata: {
    papers: [
      {
        id: "mcp_1",
        title: "BERT: Pre-training of Deep Bidirectional Transformers",
        authors: [],
        year: null,
        abstract: "",
        doi: "10.48550/arXiv.1810.04805"
      }
    ]
  },
  fetch_metadata: {
    doi: "10.48550/arXiv.1810.04805",
    title: "Attention Is All You Need"
  },
  recover_metadata: {
    doi: "10.48550/arXiv.1810.04805",
    title: "Deep Residual Learning for Image Recognition"
  },
  download_pdf: {
    doi: "10.48550/arXiv.1810.04805",
    url: "https://arxiv.org/pdf/1810.04805.pdf"
  },
  resolve_pdf: {
    identifier: "10.48550/arXiv.1810.04805"
  },
  list_sources: {},
  health_check: {},
  coverage_report: {
    use_cache: true
  },
  help: {
    topic: "search"
  },
  search_dblp: {
    query: "neural networks deep learning",
    maxResults: 5
  },
  search_paperswithcode: {
    query: "yolov8 object detection",
    maxResults: 5
  },
  trending_papers: {
    query: "llm reasoning",
    maxResults: 5
  },
  search_conferences: {
    query: "graph neural networks",
    maxResults: 5
  },

  // LetXipu PDF / OCR / Academic Document Processing
  read_pdf: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    maxChars: 5000,
    pages: "1-3",
    format: "markdown"
  },
  pdf_metadata: {
    source: "https://arxiv.org/pdf/1810.04805.pdf"
  },
  pdf_sections: {
    source: "https://arxiv.org/pdf/1810.04805.pdf"
  },
  pdf_citations: {
    source: "https://arxiv.org/pdf/1810.04805.pdf"
  },
  analyze_academic: {
    source: "https://arxiv.org/pdf/1810.04805.pdf"
  },
  extract_section: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    section: "metodología"
  },
  read_pdf_markdown: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    maxChars: 8000,
    pages: "1-5"
  },
  pdf_smart_summary: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    maxTotalChars: 6000
  },
  convert_document: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    maxChars: 10000
  },
  batch_convert: {
    sources: ["https://arxiv.org/pdf/1810.04805.pdf"],
    maxCharsPerDoc: 5000
  },
  extract_tables: {
    source: "https://arxiv.org/pdf/1810.04805.pdf",
    format: "markdown"
  },
  extract_formulas: {
    source: "https://arxiv.org/pdf/1810.04805.pdf"
  },

  // LetXinet Pipeline & Orchestration
  synthesize: {
    query: "sintesis de inteligencia artificial aplicada a la medicina en latinoamerica",
    strategy: "hierarchical",
    keywords: ["inteligencia artificial", "medicina", "diagnostico"],
    synthesisModel: "mistral-small-latest",
    planningModel: "mistral-large-2411"
  },
  research: {
    query: "estado del arte en computacion quantica y algoritmos hibridos",
    strategy: "hierarchical",
    sources: ["latam", "global"],
    maxSources: 10,
    agentRole: "Investigador Senior de IA",
    synthesisModel: "mistral-small-latest",
    planningModel: "mistral-large-2411"
  },
  super_research: {
    query: "modelos de lenguaje masivos y razonamiento logico en educacion superior",
    strategy: "hierarchical",
    iterations: 2,
    maxSources: 10,
    synthesisModel: "mistral-small-latest",
    planningModel: "mistral-large-2411"
  },
  orchestrate: {
    query: "impacto de la inteligencia artificial en educacion superior peruana"
  },
  research_async: {
    query: "nanotecnologia en tratamiento de cancer",
    maxSources: 3
  },
  job_status: {
    jobId: "job-1779751467031-bk2zn9eh1"
  },
  list_providers: {},

  // LetXipu OSM (OpenStreetMap / Geolocation)
  geocode_address: {
    address: "Plaza Mayor, Lima, Peru",
    region: "Peru"
  },
  reverse_geocode: {
    latitude: -12.046374,
    longitude: -77.042793
  },
  find_nearby_places: {
    latitude: -12.046374,
    longitude: -77.042793,
    radius: 1000,
    category: "restaurant",
    limit: 5
  },
  find_parking_facilities: {
    latitude: -12.046374,
    longitude: -77.042793,
    radius: 800,
    limit: 5
  },
  find_schools_nearby: {
    latitude: -12.046374,
    longitude: -77.042793,
    radius: 1500,
    limit: 5
  },
  find_charging_stations: {
    latitude: -12.046374,
    longitude: -77.042793,
    radius: 2000,
    limit: 5
  },
  explore_area: {
    latitude: -12.046374,
    longitude: -77.042793,
    radius: 1000
  },
  analyze_neighborhood: {
    latitude: -12.046374,
    longitude: -77.042793,
    neighborhood_name: "Miraflores",
    radius: 1000,
    include_price_data: false
  },
  get_route_directions: {
    start_lat: -12.046374,
    start_lon: -77.042793,
    end_lat: -12.1211,
    end_lon: -77.0292,
    mode: "driving"
  },
  route_fetch: {
    start: [-12.046374, -77.042793],
    end: [-12.1211, -77.0292],
    mode: "driving"
  },
  analyze_commute: {
    home_latitude: -12.046374,
    home_longitude: -77.042793,
    work_latitude: -12.1211,
    work_longitude: -77.0292,
    transport_modes: ["driving", "transit"]
  },
  geo_distance: {
    from: [-12.046374, -77.042793],
    to: [-12.1211, -77.0292]
  },
  suggest_meeting_point: {
    locations: [
      { latitude: -12.046374, longitude: -77.042793 },
      { latitude: -12.1211, longitude: -77.0292 }
    ],
    category: "cafe",
    limit: 3
  },
  centroid_points: {
    points: [
      [-12.046374, -77.042793],
      [-12.1211, -77.0292]
    ]
  },
  bbox_from_points: {
    points: [
      [-12.046374, -77.042793],
      [-12.1211, -77.0292]
    ]
  },
  polyline_encode: {
    points: [
      [-12.046374, -77.042793],
      [-12.1211, -77.0292]
    ]
  },
  polyline_decode: {
    polyline: "_p~iF~ps|U_ulLnnqC"
  },
  route_sample: {
    polyline: "_p~iF~ps|U_ulLnnqC",
    interval: 100
  },
  enrich_emissions: {
    options: [
      { mode: "driving", distance_km: 10 },
      { mode: "walking", distance_km: 10 }
    ]
  },
  get_map_image: {
    latitude: -12.046374,
    longitude: -77.042793,
    zoom: 14
  },
  get_version: {},
  osm_query_bbox: {
    bbox: [-12.05, -77.05, -12.04, -77.03],
    tags: { amenity: "restaurant" }
  },
  filter_tags: {
    elements: [{ id: 1, tags: { amenity: "school" } }],
    tags: { amenity: "school" }
  },
  sort_by_distance: {
    ref: { latitude: -12.046374, longitude: -77.042793 },
    elements: [{ latitude: -12.05, longitude: -77.04 }]
  },
  tile_cache: {
    action: "status"
  },

  // Local / Web Search / Webwright / Anti-Hallucination
  web_search: {
    query: "noticias ciencia y tecnologia Peru 2026",
    max_results: 5
  },
  "webwright.run.cli": {
    query: "Buscar publicaciones recientes sobre energia solar",
    start_url: "https://concytec.gob.pe"
  },
  verify_antihallucination_data: {
    text_to_verify: "El repositorio ALICIA es gestionado por CONCYTEC en Perú.",
    extracted_source_texts: ["ALICIA es el Repositorio Nacional Digital gestionado por CONCYTEC."]
  }
};

// Fallback schema generator if a tool is not explicitly defined in DEFAULT_ARG_PRESETS
function generateSampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return {};
  if (schema.properties) {
    const obj: Record<string, any> = {};
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      const desc = (prop.description || '').toLowerCase();
      if (prop.type === 'string') {
        if (desc.includes('doi')) obj[key] = "10.48550/arXiv.1810.04805";
        else if (desc.includes('url') || key.includes('url')) obj[key] = "https://arxiv.org/pdf/1810.04805.pdf";
        else if (desc.includes('address') || key.includes('address')) obj[key] = "Plaza Mayor, Lima, Peru";
        else if (key.includes('query') || desc.includes('query')) obj[key] = "inteligencia artificial Peru";
        else obj[key] = "ejemplo";
      } else if (prop.type === 'number' || prop.type === 'integer') {
        if (key.includes('lat')) obj[key] = -12.046374;
        else if (key.includes('lon')) obj[key] = -77.042793;
        else if (key.includes('max') || key.includes('limit')) obj[key] = 5;
        else obj[key] = 10;
      } else if (prop.type === 'boolean') {
        obj[key] = true;
      } else if (prop.type === 'array') {
        obj[key] = prop.items?.type === 'string' ? ["latam", "global"] : [];
      } else if (prop.type === 'object') {
        obj[key] = {};
      } else {
        obj[key] = "valor";
      }
    }
    return obj;
  }
  return {};
}

// Preset categories for easy quick filtering in the Playground
const PRESET_CATEGORIES: { id: string; label: string; tools: string[] }[] = [
  {
    id: "all",
    label: "⚡ Todos",
    tools: Object.keys(DEFAULT_ARG_PRESETS)
  },
  {
    id: "letxinet",
    label: "🚀 LetXinet Pipeline",
    tools: [
      "synthesize", "research", "super_research", "orchestrate", 
      "research_async", "job_status", "list_providers"
    ]
  },
  {
    id: "academic",
    label: "🎓 Académico & Búsqueda",
    tools: [
      "batch_search", "search", "smart_search", "enrich_metadata", "fetch_metadata", 
      "recover_metadata", "resolve_pdf", "download_pdf", "list_sources", "health_check", 
      "coverage_report", "help", "search_dblp", "search_paperswithcode", "trending_papers", 
      "search_conferences", "orchestrate", "research_async", "job_status"
    ]
  },
  {
    id: "pdf",
    label: "📄 PDF & Documentos",
    tools: [
      "read_pdf", "pdf_metadata", "pdf_sections", "pdf_citations", "analyze_academic", 
      "extract_section", "read_pdf_markdown", "pdf_smart_summary", "convert_document", 
      "batch_convert", "extract_tables", "extract_formulas"
    ]
  },
  {
    id: "osm",
    label: "📍 Geodatos OpenStreetMap",
    tools: [
      "geocode_address", "reverse_geocode", "find_nearby_places", "find_parking_facilities", 
      "find_schools_nearby", "find_charging_stations", "explore_area", "analyze_neighborhood", 
      "get_route_directions", "route_fetch", "analyze_commute", "geo_distance", 
      "suggest_meeting_point", "centroid_points", "bbox_from_points", "polyline_encode", 
      "polyline_decode", "route_sample", "enrich_emissions", "get_map_image", "get_version", 
      "osm_query_bbox", "filter_tags", "sort_by_distance", "tile_cache"
    ]
  },
  {
    id: "agents",
    label: "🌐 Agentes & Web",
    tools: ["web_search", "webwright.run.cli", "verify_antihallucination_data"]
  }
];

export default function ConsolePlayground({
  tools,
  selectedToolName,
  onSelectToolName,
  history,
  onAddHistory,
  onClearHistory,
  loadingTools,
  onRefreshTools
}: ConsolePlaygroundProps) {
  const { lang, t } = useI18n();
  const currentTool = tools.find(t => t.name === selectedToolName) || tools[0];

  const [argumentsJson, setArgumentsJson] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<any | null>(null);
  const [currentMetrics, setCurrentMetrics] = useState<{ duration: number; success: boolean } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedDropdownServers, setExpandedDropdownServers] = useState<Record<string, boolean>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleDropdownServer = (e: React.MouseEvent, server: string) => {
    e.stopPropagation();
    setExpandedDropdownServers(prev => ({ ...prev, [server]: !prev[server] }));
  };

  // Apply inputs preset whenever active tool changes
  useEffect(() => {
    if (currentTool) {
      const preset = DEFAULT_ARG_PRESETS[currentTool.name] ?? generateSampleFromSchema(currentTool.inputSchema);
      setArgumentsJson(JSON.stringify(preset, null, 2));
      setJsonError(null);
    }
  }, [selectedToolName, currentTool]);

  const handleJsonChange = (val: string) => {
    setArgumentsJson(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(`${t.invalidJson} ${e.message}`);
    }
  };

  const executeTool = async () => {
    if (!currentTool) return;
    
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(argumentsJson);
    } catch (e) {
      setJsonError(t.jsonErrorFix);
      return;
    }

    setExecuting(true);
    setCurrentResponse(null);
    setCurrentMetrics(null);

    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    try {
      const res = await fetch("/api/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: currentTool.name,
          arguments: parsedArgs
        }),
        signal: abortControllerRef.current.signal
      });

      const floatDuration = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;
      const data = await res.json();

      if (res.ok && data.success) {
        setCurrentResponse(data.response || data);
        setCurrentMetrics({ duration: floatDuration, success: true });
        
        onAddHistory({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          toolName: currentTool.name,
          args: parsedArgs,
          duration: floatDuration,
          status: 'success',
          response: data.response || data
        });
      } else {
        const errorMsg = data.error || (lang === 'en' ? "MCP server failure." : lang === 'pt' ? "Falha de servidor MCP." : "Falla del servidor MCP.");
        setCurrentResponse({ error: errorMsg, raw: data });
        setCurrentMetrics({ duration: floatDuration, success: false });
        
        onAddHistory({
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          toolName: currentTool.name,
          args: parsedArgs,
          duration: floatDuration,
          status: 'failed',
          error: errorMsg,
          response: data
        });
      }
    } catch (err: any) {
      const floatDuration = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;
      
      let errorMsg;
      if (err.name === 'AbortError') {
        errorMsg = lang === 'en' ? "Execution aborted by user." : lang === 'pt' ? "Execução abortada pelo usuário." : "Ejecución abortada por el usuario.";
      } else {
        errorMsg = err.message || (lang === 'en' ? "Network failure." : lang === 'pt' ? "Falha de rede." : "Falla de red.");
      }
      
      setCurrentResponse({ error: errorMsg });
      setCurrentMetrics({ duration: floatDuration, success: false });
      
      onAddHistory({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        toolName: currentTool.name,
        args: parsedArgs,
        duration: floatDuration,
        status: 'failed',
        error: errorMsg,
        response: { error: err.toString() }
      });
    } finally {
      setExecuting(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const copyToClipboard = () => {
    if (!currentResponse) return;
    navigator.clipboard.writeText(JSON.stringify(currentResponse, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadPreset = (presetName: string) => {
    onSelectToolName(presetName);
  };

  const loadHistoryItem = (item: ExecutionRecord) => {
    onSelectToolName(item.toolName);
    setArgumentsJson(JSON.stringify(item.args, null, 2));
    setCurrentResponse(item.response || { status: item.status, error: item.error });
    setCurrentMetrics({ duration: item.duration, success: item.status === 'success' });
  };

  // Filter tools for dropdown
  const filteredTools = tools.filter(tool => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const desc = getToolDescription(tool, lang).toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      desc.includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      (tool.serverName || '').toLowerCase().includes(q)
    );
  });

  // Active category preset keys
  const categoryConfig = PRESET_CATEGORIES.find(c => c.id === selectedCategory) || PRESET_CATEGORIES[0];
  const activePresetKeys = Object.keys(DEFAULT_ARG_PRESETS).filter(key => {
    if (selectedCategory === 'all') return true;
    return categoryConfig.tools.includes(key);
  });

  return (
    <div id="mcp-playground-box" className="flex flex-col lg:flex-row gap-4 h-full min-h-0 overflow-hidden">
      
      {/* 1st COLUMN: Active Tools List — sidebar izq fijo */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <ActiveToolsList
          tools={tools}
          loading={loadingTools ?? false}
          onSelectTool={onSelectToolName}
          onRefreshTools={onRefreshTools}
        />
      </div>

      {/* 2nd+3rd COLUMN wrapper: Consola + Respuesta + Historial stacked vertical
          (v1.5.0 P5 Opción A — la respuesta queda justo debajo del botón Ejecutar,
          y el Historial abajo de todo. Flujo natural ejecutar→ver→historial.) */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">

      {/* 2nd COLUMN: Input parameters editor (Consola Técnica) */}
      <div className="flex flex-col gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 text-zinc-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-500" />
              <h2 className="font-display font-bold text-sm md:text-base">{t.playgroundTitle}</h2>
            </div>
            <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200/50 dark:border-indigo-800/50">
              {tools.length} Herramientas
            </span>
          </div>

          {/* Selector de herramienta con filtro de búsqueda */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t.selectMcpTool}
            </label>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {selectedToolName || "Selecciona una herramienta..."}
                  </span>
                  {currentTool?.serverName && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-sans font-bold">
                      {currentTool.serverName}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>
              
              {dropdownOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-96 overflow-hidden flex flex-col">
                  {/* Search box inside dropdown */}
                  <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xs flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                    <input
                      type="text"
                      placeholder="Buscar entre 62 herramientas..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400"
                      autoFocus
                    />
                  </div>

                  <div className="overflow-y-auto max-h-80 divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredTools.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-400 italic">
                        No se encontraron herramientas que coincidan con &quot;{searchFilter}&quot;
                      </div>
                    ) : (
                      Object.entries(
                        filteredTools.reduce((acc, tool) => {
                          const server = tool.serverName || "Unknown MCP";
                          if (!acc[server]) acc[server] = [];
                          acc[server].push(tool);
                          return acc;
                        }, {} as Record<string, ToolDefinition[]>)
                      ).map(([serverName, serverTools]) => {
                        const isExpanded = expandedDropdownServers[serverName] !== false;
                        return (
                          <div key={serverName}>
                            <button
                              onClick={(e) => toggleDropdownServer(e, serverName)}
                              className="w-full flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/20 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                {serverName === "local" ? "Herramientas Locales" : `Servidor: ${serverName}`}
                                <span className="ml-2 bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-500 dark:text-zinc-400 normal-case font-medium">
                                  {serverTools.length}
                                </span>
                              </span>
                            </button>
                                   {isExpanded && (
                              <div className="py-1">
                                {serverTools.map(toolItem => (
                                  <button
                                    key={toolItem.name}
                                    onClick={() => {
                                      onSelectToolName(toolItem.name);
                                      setDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-6 py-1.5 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2 ${
                                      selectedToolName === toolItem.name 
                                        ? 'bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold' 
                                        : 'text-zinc-700 dark:text-zinc-300'
                                    }`}
                                  >
                                    <span className="font-mono truncate">{toolItem.name}</span>
                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]">
                                      {getToolDescription(toolItem, lang).split('.')[0]}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información de herramienta actual */}
          {currentTool && (
            <div className="mb-4 bg-slate-50 dark:bg-zinc-800/20 p-3.5 border border-zinc-100 dark:border-zinc-800 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 font-sans">
                  {t.descriptionLabel}
                </span>
                <span className="text-[9px] font-mono text-zinc-400">
                  {currentTool.inputSchema?.properties ? `${Object.keys(currentTool.inputSchema.properties).length} parámetros` : 'Sin parámetros'}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {getToolDescription(currentTool, lang)}
              </p>
            </div>
          )}
 
          {/* Editor JSON */}
          <div className="relative mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {t.argumentsJson}
              </span>
              <button
                onClick={() => {
                  const preset = DEFAULT_ARG_PRESETS[selectedToolName] ?? generateSampleFromSchema(currentTool?.inputSchema);
                  setArgumentsJson(JSON.stringify(preset, null, 2));
                  setJsonError(null);
                }}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Restablecer argumentos JSON
              </button>
            </div>

            <textarea
              id="mcp-args-textarea"
              value={argumentsJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-[180px] bg-zinc-950 text-emerald-400 dark:text-emerald-300 font-mono text-xs p-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shadow-inner resize-none select-text"
              spellCheck="false"
            />

            {jsonError && (
              <div className="mt-1.5 text-xs text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg border border-red-200/20">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>

          {executing ? (
            <button
              onClick={handleStopExecution}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer text-white shadow-md bg-red-500 hover:bg-red-600 active:scale-98"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{lang === 'en' ? "Stop" : lang === 'pt' ? "Interromper" : "Detener"}</span>
            </button>
          ) : (
            <button
              id="mcp-execute-btn"
              onClick={executeTool}
              disabled={!!jsonError}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer text-white shadow-md ${
                !!jsonError
                  ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 active:scale-98"
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{t.executeBtn}</span>
            </button>
          )}
        </div>
 
        {/* PRESETS QUICK TRIGGER CARD WITH CATEGORIES */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Argumentos Preconfigurados ({activePresetKeys.length})
            </h3>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2">
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {activePresetKeys.map((key) => (
              <button
                key={key}
                onClick={() => handleLoadPreset(key)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-lg transition-colors border cursor-pointer ${
                  selectedToolName === key
                    ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40 font-bold"
                    : "bg-zinc-50 border-zinc-200/60 text-zinc-650 hover:bg-zinc-100 dark:bg-zinc-800/30 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
                }`}
              >
                {key}()
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3rd COLUMN: Output display and metrics (ahora dentro del wrapper central) */}
      <div className="flex flex-col gap-4">
        <div className="bg-zinc-950 text-zinc-100 rounded-2xl p-5 border border-zinc-800 flex flex-col flex-1 min-h-[420px] shadow-lg relative">
          
          <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-500" />
              <span className="font-display font-semibold text-sm">{t.serverResponse}</span>
            </div>

            {/* Metrics pills */}
            {currentMetrics && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-mono bg-zinc-900 px-2 py-1 rounded text-zinc-400">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>{currentMetrics.duration}s</span>
                </div>
                
                <span className={`text-[9px] font-mono font-semibold uppercase px-2 py-1 rounded ${
                  currentMetrics.success 
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                    : 'bg-red-950/60 text-red-400 border border-red-900/30'
                }`}>
                  {currentMetrics.success ? 'HTTP 200 / OK' : 'RPC ERROR'}
                </span>

                <button
                  onClick={copyToClipboard}
                  className="p-1 px-1.5 rounded bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer flex items-center justify-center gap-1"
                  title="Copiar respuesta JSON"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[9px]">Copiar</span>
                </button>
              </div>
            )}
          </div>

          {/* RESPONSE VIEWER AREA */}
          <div className="flex-1 overflow-auto max-h-[360px] font-mono text-[11px] text-zinc-300 focus:outline-none">
            {executing ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 py-12 gap-3">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                </div>
                <span>Ejecutando herramienta {selectedToolName} en servidor MCP...</span>
              </div>
            ) : currentResponse ? (
              <pre className="whitespace-pre overflow-x-auto select-text p-1">{JSON.stringify(currentResponse, null, 2)}</pre>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-650 py-12">
                <Terminal className="w-8 h-8 text-zinc-800 mb-2 stroke-[1.5]" />
                <span className="text-xs">Usa &quot;Ejecutar Herramienta&quot; para enviar un comando JSON-RPC</span>
                <span className="text-[10px] text-zinc-700 mt-1">Los resultados formateados aparecerán aquí</span>
              </div>
            )}
          </div>
        </div>

        {/* LOG DE HISTORIAL DE CONSULTAS */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {t.execHistoryTitle} ({history.length})
              </h3>
            </div>
            {history.length > 0 && onClearHistory && (
              <button
                onClick={() => {
                  const msg = lang === 'es' ? '¿Borrar todo el historial?' : lang === 'pt' ? 'Limpar todo o histórico?' : 'Clear all history?';
                  if (window.confirm(msg)) {
                    onClearHistory();
                  }
                }}
                className="text-[10px] px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded transition-colors cursor-pointer"
              >
                {lang === 'es' ? 'Limpiar Todo' : lang === 'pt' ? 'Limpar Tudo' : 'Clear All'}
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic pl-1">
              {t.emptySessionHistory}
            </p>
          ) : (
            <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="flex items-center justify-between p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850/60 cursor-pointer transition text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {item.toolName}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono truncate">
                      {JSON.stringify(item.args)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                    <span className="text-zinc-500 dark:text-zinc-400">{item.duration}s</span>
                    <span className="text-zinc-400 dark:text-zinc-500 font-sans">{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      {/* Cierre del wrapper central (col2+col3 stacked) */}
      </div>
    </div>
  );
}
