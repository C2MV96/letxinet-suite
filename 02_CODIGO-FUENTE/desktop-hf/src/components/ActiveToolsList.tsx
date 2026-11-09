import { ToolDefinition } from '../types';
import { Box, Code, HelpCircle, TableProperties, Info, ChevronDown, ChevronRight, RefreshCw, FolderClosed, FolderOpen, ShieldCheck, Cpu, Globe, MapPin, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { getToolDescription } from '../lib/toolTranslations';

interface ActiveToolsProps {
  tools: ToolDefinition[];
  loading: boolean;
  onSelectTool?: (toolName: string) => void;
  onRefreshTools?: (server?: string) => Promise<void> | void;
}

export default function ActiveToolsList({ tools, loading, onSelectTool, onRefreshTools }: ActiveToolsProps) {
  const { lang } = useI18n();
  const [selectedInspect, setSelectedInspect] = useState<ToolDefinition | null>(null);
  // DEFAULT REPLEGADOS (COLLAPSED) BY DEFAULT as strictly requested
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});
  const [syncingServer, setSyncingServer] = useState<string | null>(null);

  const toggleServer = (server: string) => {
    setExpandedServers(prev => ({ ...prev, [server]: !prev[server] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    Object.keys(groupedTools).forEach(s => { allExpanded[s] = true; });
    setExpandedServers(allExpanded);
  };

  const collapseAll = () => {
    setExpandedServers({});
  };

  const handleSync = async (server?: string) => {
    const key = server || 'total';
    setSyncingServer(key);
    try {
      if (onRefreshTools) {
        await onRefreshTools(server);
      }
    } catch (e) {
      console.error("Error during tools sync:", e);
    } finally {
      setTimeout(() => {
        setSyncingServer(null);
      }, 400);
    }
  };

  if (loading && tools.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 w-1/2 rounded animate-pulse"></div>
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 w-1/4 rounded animate-pulse"></div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800/60 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Group tools by server
  const groupedTools = tools.reduce((acc, tool) => {
    const server = tool.serverName || "Unknown MCP";
    if (!acc[server]) acc[server] = [];
    acc[server].push(tool);
    return acc;
  }, {} as Record<string, ToolDefinition[]>);

  const mcpCategories = [
    { id: 'total', label: 'Total Sync', icon: RefreshCw, color: 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50' },
    { id: 'letxipu', label: 'LetXipu', icon: Cpu, color: 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-200 dark:border-blue-900/50' },
    { id: 'letxinet', label: 'LetXinet', icon: Globe, color: 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' },
    { id: 'letxipu_osm', label: 'LetXipu OSM', icon: MapPin, color: 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
    { id: 'local', label: 'Locales', icon: Wrench, color: 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-900/50' },
  ];

  const isAnyExpanded = Object.values(expandedServers).some(Boolean);

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
            <Box className="w-4 h-4 text-indigo-500" />
            {lang === 'en' ? `Active MCP Tools (${tools.length})` : lang === 'pt' ? `Ferramentas MCP Ativas (${tools.length})` : `Herramientas MCP Activas (${tools.length})`}
          </span>

          <div className="flex items-center gap-2">
            {/* Global Sincronización Total Button */}
            <button
              onClick={() => handleSync()}
              disabled={loading || syncingServer === 'total'}
              className="px-2.5 py-1 text-[10px] font-extrabold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Sincronización Total de todos los MCPs y herramientas locales"
            >
              <RefreshCw className={`w-3 h-3 ${loading || syncingServer === 'total' ? 'animate-spin' : ''}`} />
              <span>{loading ? (lang === 'en' ? 'Syncing...' : 'Sincronizando...') : (lang === 'en' ? 'Sync All' : 'Sincronización Total')}</span>
            </button>

            <button
              onClick={() => {
                const helpTool = tools.find(t => t.name === 'help');
                if (helpTool && onSelectTool) {
                   onSelectTool('help');
                } else {
                   alert(lang === 'en' ? "Please use the Playground or Chat to invoke the 'help' tool." : lang === 'pt' ? "Por favor, use o Playground ou Chat para chamar a ferramenta 'help'." : "Utilice el Playground o el chat para llamar la herramienta de 'help'.");
                }
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              title="Documentación MCP"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* INDIVIDUAL MCP SYNC BUTTONS BAR */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight mr-1">
            {lang === 'en' ? 'Sync Server:' : 'Sincronizar:'}
          </span>
          {mcpCategories.map(cat => {
            const Icon = cat.icon;
            const isSyncing = syncingServer === cat.id;
            const isTotal = cat.id === 'total';
            return (
              <button
                key={cat.id}
                onClick={() => handleSync(isTotal ? undefined : cat.id)}
                disabled={!!syncingServer}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition flex items-center gap-1 cursor-pointer bg-zinc-50/60 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 ${cat.color}`}
                title={`Sincronizar ${cat.label}`}
              >
                <Icon className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTROLS: COLLAPSE / EXPAND ALL */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 pt-1">
          <span className="italic">
            {lang === 'en' ? 'Tools are collapsed by default' : 'Replegadas por defecto'}
          </span>
          <div className="flex items-center gap-2">
            {isAnyExpanded ? (
              <button
                onClick={collapseAll}
                className="hover:text-indigo-500 transition flex items-center gap-1 cursor-pointer font-semibold"
              >
                <FolderClosed className="w-3 h-3" />
                <span>{lang === 'en' ? 'Collapse All' : 'Replegar todas'}</span>
              </button>
            ) : (
              <button
                onClick={expandAll}
                className="hover:text-indigo-500 transition flex items-center gap-1 cursor-pointer font-semibold"
              >
                <FolderOpen className="w-3 h-3" />
                <span>{lang === 'en' ? 'Expand All' : 'Expandir todas'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ACCORDION GROUP LIST (COLLAPSED / REPLEGADO BY DEFAULT) */}
      <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
        {Object.entries(groupedTools).map(([serverName, serverTools]) => {
          // STRICT DEFAULT: REPLEGADO (false) unless explicitly toggled to true
          const isExpanded = expandedServers[serverName] === true;
          const isSyncingThis = syncingServer === serverName;

          return (
            <div 
              key={serverName} 
              className="border border-zinc-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-950/20 transition-all"
            >
              {/* SERVER ACCORDION HEADER */}
              <div className="flex items-center justify-between p-2.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition">
                <button 
                  onClick={() => toggleServer(serverName)}
                  className="flex items-center gap-2 flex-1 text-left focus:outline-none cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <span>{serverName === "local" ? "Herramientas Locales" : `Servidor: ${serverName}`}</span>
                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.5 rounded-full">
                      {serverTools.length} {lang === 'en' ? 'tools' : 'herramientas'}
                    </span>
                  </h4>
                </button>

                {/* INDIVIDUAL SERVER REFRESH BUTTON */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSync(serverName);
                  }}
                  disabled={!!syncingServer}
                  className="p-1.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                  title={`Sincronizar ${serverName}`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingThis ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              </div>
              
              {/* ACCORDION CONTENT */}
              {isExpanded && (
                <div className="p-2 space-y-2 border-t border-zinc-200/60 dark:border-zinc-800/80 bg-white dark:bg-zinc-900">
                  {serverTools.map((tool) => (
                    <div
                      key={tool.name}
                      className="group relative flex items-start justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-indigo-800/60 bg-zinc-50/50 dark:bg-zinc-800/20 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-all duration-150"
                    >
                      <div className="flex flex-col flex-1 min-w-0 pr-2">
                        <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate">
                          <Code className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          {tool.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {getToolDescription(tool, lang).split('.')[0] + '.'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setSelectedInspect(tool)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700 rounded transition cursor-pointer"
                          title="Detalle del esquema JSON"
                        >
                          <TableProperties className="w-3.5 h-3.5" />
                        </button>
                        
                        {onSelectTool && (
                          <button
                            onClick={() => onSelectTool(tool.name)}
                            className="px-2 py-1 text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-50 text-white dark:text-zinc-900 rounded transition cursor-pointer"
                            title="Cargar en el Playground"
                          >
                            {lang === 'en' ? "Try" : lang === 'pt' ? "Testar" : "Probar"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex gap-2 items-start bg-slate-50 dark:bg-zinc-800/10 p-3 rounded-xl">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {lang === 'en' ? (
            <>
              The chat bot <span className="font-semibold text-zinc-700 dark:text-zinc-300">LetXinet</span> executes these tools according to your Priority Panel order.
            </>
          ) : lang === 'pt' ? (
            <>
              O chat bot <span className="font-semibold text-zinc-700 dark:text-zinc-300">LetXinet</span> executa essas ferramentas conforme a ordem do Painel de Prioridades.
            </>
          ) : (
            <>
              El bot de chat <span className="font-semibold text-zinc-700 dark:text-zinc-300">LetXinet</span> ejecutará estas herramientas respetando el orden del Panel de Control de Prioridades.
            </>
          )}
        </p>
      </div>

      {/* INSPECT SCHEMA DIALOG MODAL */}
      {selectedInspect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-scale-in">
            <h3 className="font-display font-semibold text-lg text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
              <TableProperties className="w-5 h-5 text-indigo-500" />
              Esquema de Entrada: <span className="font-mono text-zinc-700 dark:text-zinc-300">{selectedInspect.name}</span>
            </h3>
            
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 whitespace-normal leading-relaxed">
              {getToolDescription(selectedInspect, lang)}
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl max-h-[300px] overflow-y-auto mb-5 border border-zinc-150 dark:border-zinc-800 font-mono text-xs text-zinc-700 dark:text-zinc-300">
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
                // Parámetros esperados por la herramienta
              </div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedInspect.inputSchema, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2">
              {onSelectTool && (
                <button
                  onClick={() => {
                    onSelectTool(selectedInspect.name);
                    setSelectedInspect(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer"
                >
                  Cargar en Playground
                </button>
              )}
              <button
                onClick={() => setSelectedInspect(null)}
                className="px-4 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 rounded-lg transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
