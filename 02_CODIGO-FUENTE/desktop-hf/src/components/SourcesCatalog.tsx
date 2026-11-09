import { useState, useEffect } from 'react';
import { SourceDefinition, SourceGroup } from '../types';
import { Database, Globe, Search, ShieldCheck, ShieldAlert, Key, CheckCircle2, AlertCircle, RefreshCw, Cpu, Server, FileText, Layers, ExternalLink, ClipboardCopy, X, Plus } from 'lucide-react';

export default function SourcesCatalog() {
  const [sources, setSources] = useState<SourceDefinition[]>([]);
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogOrigin, setCatalogOrigin] = useState('letxipu-v11');
  const [manualSourceIds, setManualSourceIds] = useState<string[]>([]);
  const [copiedSources, setCopiedSources] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'free' | 'premium'>('all');
  const [healthData, setHealthData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'groups' | 'endpoints' | 'health'>('catalog');

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        setGroups(data.groups || []);
        setCatalogOrigin(data.origin || 'local-fallback');
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error('Error fetching health status:', err);
    }
  };

  useEffect(() => {
    fetchSources();
    fetchHealth();
  }, []);

  const filteredSources = sources.filter((src) => {
    const matchesQuery =
      src.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      src.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      src.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      src.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'free'
        ? !src.keyNeeded
        : src.keyNeeded;

    let matchesGroup = true;
    if (selectedGroup !== 'all') {
      const groupObj = groups.find((g) => g.id === selectedGroup);
      if (groupObj) {
        matchesGroup = groupObj.sources.includes(src.id);
      }
    }

    return matchesQuery && matchesCategory && matchesGroup;
  });

  const toggleManualSource = (sourceId: string) => {
    setManualSourceIds((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId]);
  };

  const copyManualSources = async () => {
    await navigator.clipboard.writeText(`sources: ${JSON.stringify(manualSourceIds)}`);
    setCopiedSources(true);
    window.setTimeout(() => setCopiedSources(false), 1800);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-zinc-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LetXipu Search MCP V11.1 STABLE — Catálogo Oficial
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              39 Fuentes Académicas & 16 Grupos de Repositorio
            </h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Indexación dual batch-first que combina repositorios universitarios latinoamericanos (ALICIA, RENATI, La Referencia, BDTD, CONAHCyT) con motores globales (OpenAlex, Crossref, Scopus, PubMed, arXiv).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
              <div className="text-2xl font-black text-emerald-400">{sources.length || '—'}</div>
              <div className="text-[11px] text-zinc-300 font-medium">Fuentes Activas</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center">
              <div className="text-2xl font-black text-indigo-300">{groups.length || '—'}</div>
              <div className="text-[11px] text-zinc-300 font-medium">Grupos Región</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center col-span-2 sm:col-span-1">
              <div className="text-2xl font-black text-amber-300">28</div>
              <div className="text-[11px] text-zinc-300 font-medium">Herramientas MCP</div>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Catálogo de Fuentes (39)</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'groups'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Grupos de Búsqueda (16)</span>
          </button>

          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'endpoints'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Endpoints REST API</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Estado & Diagnóstico</span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchSources();
            fetchHealth();
          }}
          disabled={loading}
          className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-xl transition cursor-pointer"
          title="Actualizar catálogo de fuentes"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* TAB 1: CATALOG OF 39 SOURCES */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="relative flex items-center col-span-1 md:col-span-1">
              <Search className="absolute left-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por fuente, id, país o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 shrink-0">Grupo:</span>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todos los grupos ({sources.length})</option>
                {groups.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.name} ({grp.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 shrink-0">Acceso:</span>
              <div className="grid grid-cols-3 w-full bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`py-1 rounded-lg transition ${
                    selectedCategory === 'all'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                      : 'text-zinc-500'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setSelectedCategory('free')}
                  className={`py-1 rounded-lg transition ${
                    selectedCategory === 'free'
                      ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                      : 'text-zinc-500'
                  }`}
                >
                  Libre
                </button>
                <button
                  onClick={() => setSelectedCategory('premium')}
                  className={`py-1 rounded-lg transition ${
                    selectedCategory === 'premium'
                      ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                      : 'text-zinc-500'
                  }`}
                >
                  Key Requ.
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
                  <ClipboardCopy className="h-4 w-4" /> Selección manual para el Playground
                </div>
                <p className="mt-1 text-xs text-slate-400">Elige fuentes individuales y copia el parámetro listo para usar. Catálogo: {catalogOrigin}.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setManualSourceIds([])} disabled={!manualSourceIds.length} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40">Limpiar</button>
                <button onClick={copyManualSources} disabled={!manualSourceIds.length} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <ClipboardCopy className="h-3.5 w-3.5" /> {copiedSources ? 'Copiado' : `Copiar ${manualSourceIds.length || ''}`}
                </button>
              </div>
            </div>
            {manualSourceIds.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {manualSourceIds.map((sourceId) => (
                  <button key={sourceId} onClick={() => toggleManualSource(sourceId)} className="inline-flex items-center gap-1 rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-100 transition hover:bg-indigo-500/25">
                    {sourceId}<X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ) : <p className="mt-4 text-xs text-slate-500">Todavía no seleccionaste fuentes. Usa “Añadir” en cualquier tarjeta.</p>}
          </div>

          {/* SOURCES GRID */}
          {loading ? (
            <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold">Cargando catálogo de 39 fuentes científicas...</p>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
              <p className="text-sm font-bold">No se encontraron fuentes con el criterio especificado.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGroup('all');
                  setSelectedCategory('all');
                }}
                className="mt-3 px-4 py-1.5 text-xs bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSources.map((src) => (
                <div
                  key={src.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-indigo-400/50 dark:hover:border-indigo-500/40 transition-all duration-200 flex flex-col justify-between group shadow-2xs hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {src.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                            📍 {src.country}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {src.name}
                        </h3>
                      </div>

                      {src.keyNeeded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shrink-0">
                          <Key className="w-3 h-3" />
                          Key Requerida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Acceso Libre
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                      {src.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>sources: ["{src.id}"]</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigator.clipboard.writeText(src.id)} className="hover:text-indigo-500 transition cursor-pointer font-sans text-[10px] font-bold" title="Copiar ID de fuente">Copiar ID</button>
                      <button onClick={() => toggleManualSource(src.id)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-sans text-[10px] font-bold transition ${manualSourceIds.includes(src.id) ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200' : 'border-slate-700 text-slate-400 hover:border-indigo-400/40 hover:text-indigo-200'}`}>
                        {manualSourceIds.includes(src.id) ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {manualSourceIds.includes(src.id) ? 'Quitar' : 'Añadir'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 16 SOURCE GROUPS */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((grp) => (
            <div
              key={grp.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 hover:border-indigo-500/40 transition shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                    {grp.name}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {grp.count} fuentes
                </span>
              </div>

              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                sources: [{grp.sources.map((s) => `"${s}"`).join(', ')}]
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {grp.sources.map((sId) => {
                  const srcObj = sources.find((s) => s.id === sId);
                  return (
                    <span
                      key={sId}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80"
                    >
                      {srcObj ? srcObj.name : sId}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: REST API ENDPOINTS */}
      {activeTab === 'endpoints' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              Catálogo de Endpoints REST API (Port 3000)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Todos los endpoints aceptan solicitudes HTTP POST/GET y responden en JSON estructurado.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                method: 'GET',
                path: '/api/sources',
                desc: 'Retorna el catálogo completo de 39 fuentes y 16 grupos en formato JSON.',
                sample: 'curl http://localhost:3000/api/sources'
              },
              {
                method: 'POST',
                path: '/api/search',
                desc: 'Búsqueda académica multi-fuente en tiempo real (idéntico a la herramienta search del MCP).',
                sample: 'curl -X POST http://localhost:3000/api/search -H "Content-Type: application/json" -d \'{"query":"machine learning Peru", "sources":["latam","global"]}\''
              },
              {
                method: 'POST',
                path: '/api/metadata/enrich',
                desc: 'Enriquecimiento batch de metadatos (OpenAlex → Crossref → Semantic Scholar → DSpace 7).',
                sample: 'curl -X POST http://localhost:3000/api/metadata/enrich -H "Content-Type: application/json" -d \'{"papers":[{"doi":"10.1038/s41586-020-2649-2"}]}\''
              },
              {
                method: 'POST',
                path: '/api/pdf/read',
                desc: 'Extracción de texto o Markdown estructurado desde un archivo o URL de PDF.',
                sample: 'curl -X POST http://localhost:3000/api/pdf/read -H "Content-Type: application/json" -d \'{"source":"https://example.com/paper.pdf", "format":"markdown"}\''
              },
              {
                method: 'POST',
                path: '/api/pdf/summary',
                desc: 'Resumen token-eficiente de PDF (~8000 caracteres por defecto).',
                sample: 'curl -X POST http://localhost:3000/api/pdf/summary -H "Content-Type: application/json" -d \'{"source":"https://example.com/paper.pdf"}\''
              },
              {
                method: 'GET',
                path: '/health',
                desc: 'Chequeo de salud del servidor, motores de extracción MinerU/MarkItDown y puerto de spaCy.',
                sample: 'curl http://localhost:3000/health'
              },
              {
                method: 'GET',
                path: '/metrics',
                desc: 'Métricas de rendimiento en formato Prometheus (text/plain).',
                sample: 'curl http://localhost:3000/metrics'
              }
            ].map((ep) => (
              <div
                key={ep.path}
                className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                      ep.method === 'GET'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <code className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {ep.path}
                  </code>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{ep.desc}</p>
                <pre className="text-[11px] font-mono bg-zinc-900 text-zinc-200 p-2.5 rounded-lg overflow-x-auto">
                  {ep.sample}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: HEALTH & DIAGNOSTICS */}
      {activeTab === 'health' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-500" />
                Diagnóstico de Estado & Circuit Breaker (V11.1)
              </h3>
              <p className="text-xs text-zinc-500">
                Monitoreo de conectividad a los 9 dominios críticos e inter-process provider gate.
              </p>
            </div>
            <button
              onClick={fetchHealth}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
            >
              Probar Ahora
            </button>
          </div>

          {healthData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="text-zinc-400 font-bold uppercase text-[10px]">Información del Servicio</div>
                <div>Service: <span className="text-emerald-500 font-bold">{healthData.service}</span></div>
                <div>Version: <span className="text-indigo-400 font-bold">{healthData.version}</span> ({healthData.release})</div>
                <div>Herramientas MCP: <span className="text-amber-400 font-bold">{healthData.tools}</span></div>
                <div>Fuentes Registradas: <span className="text-zinc-200 font-bold">{healthData.activeSourcesCount}</span></div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="text-zinc-400 font-bold uppercase text-[10px]">Motor de Extracción</div>
                <div>Modo Extractor: <span className="text-indigo-400 font-bold">{healthData.extraction?.mode}</span></div>
                <div>MinerU Cloud: <span className="text-emerald-400 font-bold">{healthData.extraction?.engines?.mineru}</span></div>
                <div>MarkItDown: <span className="text-zinc-300 font-bold">{healthData.extraction?.engines?.markitdown}</span></div>
                <div>spaCy Sidecar Port: <span className="text-amber-300 font-bold">:{healthData.spacySidecarPort}</span></div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-zinc-400 text-xs">Cargando diagnóstico de salud...</div>
          )}
        </div>
      )}
    </div>
  );
}
