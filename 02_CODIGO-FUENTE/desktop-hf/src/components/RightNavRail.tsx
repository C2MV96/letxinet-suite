/**
 * RightNavRail (Variante C v1.5.0 → v1.5.3) — Sidebar vertical derecho de navegación.
 * Sustituye la fila de pill buttons superior. Patrones:
 *  - Cada botón cambia `activeTab` en el padre (App.tsx)
 *  - Modo colapsado (w-14): solo iconos + tooltip al hover
 *  - Modo expandido (w-56): icono + label
 *  - Botón "Chat" marcado como primario arriba
 *  - z-30 para no tapar el header z-40 ni el input sticky z-40
 *
 * v1.5.3 — Bloque "SKILLS ACTIVOS" debajo de las secciones (separador).
 *  - visible solo en rail expandido (lg)
 *  - Si no hay skills activos: muestra "Ninguno"
 *  - Si hay: lista chips expandible/colapsable con chevron
 *  - SkillsList pasada como prop desde App.tsx (cargada del endpoint /api/skills)
 */
import { useState } from 'react';
import { Brain, Terminal, Lightbulb, Database, Key, Settings, Server, ChevronRight, ChevronLeft, MessageSquare, ChevronDown, Zap } from 'lucide-react';

export type TabId = 'chat' | 'playground' | 'skills' | 'sources' | 'keys' | 'system-variables' | 'providers';

export interface ActiveSkillInfo {
  name: string;
  description?: string;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: any;
  primary?: boolean;
}

interface Props {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  activeSkills?: ActiveSkillInfo[];
}

export default function RightNavRail({ activeTab, setActiveTab, activeSkills = [] }: Props) {
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const items: NavItem[] = [
    { id: 'chat',             label: 'Chat (Agente)',    icon: Brain,      primary: true },
    { id: 'playground',       label: 'Agente Playground',icon: Terminal },
    { id: 'skills',           label: 'Galería de Skills',icon: Lightbulb },
    { id: 'sources',          label: 'Fuentes y APIs',  icon: Database },
    { id: 'keys',             label: 'API Keys',         icon: Key },
    { id: 'system-variables', label: 'Variables Sistema',icon: Settings },
    { id: 'providers',        label: 'Proveedores',     icon: Server },
  ];

  const skillsCount = activeSkills.length;

  return (
    <nav
      aria-label="Navegación principal"
      className="flex flex-col w-full h-full border-l border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl overflow-hidden"
    >
      {/* Header del rail */}
      <div className="px-2 py-3 border-b border-zinc-200 dark:border-zinc-800 hidden lg:block">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest px-2">
          <MessageSquare className="w-3 h-3" />
          <span>Secciones</span>
        </div>
      </div>

      {/* Lista de botones verticales — flex-1 para empujar skills al fondo */}
      <ul className="flex flex-col flex-1 min-h-0 overflow-y-auto py-1.5 gap-0.5 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-pressed={isActive}
                className={`group relative w-full flex items-center gap-2.5 lg:gap-3 px-2 lg:px-3 py-2.5 mx-1.5 rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-200/50 dark:ring-indigo-800/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2]' : 'stroke-[1.6]'}`} />
                {/* Label visible solo en lg (rail expandido) */}
                <span className="hidden lg:inline text-xs font-semibold truncate">
                  {item.label}
                </span>
                {/* Indicador lateral activo */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-indigo-500 dark:bg-indigo-400" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer del rail (oculto en colapsado) */}
      <div className="hidden lg:block px-4 py-2 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-[9px] text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
          Suite v1.5.8 Variante C
        </p>
      </div>
    </nav>
  );
}

