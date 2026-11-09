// v1.5.3 — Token usage footer (sticky bottom of main chat area).
// Muestra IN / OUT / TOTAL del chat activo. Diseño compacto monospace.

import { TokenUsage } from '../lib/tokenUsage';
import { Activity } from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface TokenFooterProps {
  usage: TokenUsage;
}

export default function TokenFooter({ usage }: TokenFooterProps) {
  const { lang } = useI18n();

  return (
    <footer
      className="w-full shrink-0 border-t border-zinc-200/60 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 z-30"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          <Activity className="w-2.5 h-2.5" />
          {lang === 'en' ? 'Tokens' : 'Tokens'}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-400 dark:text-zinc-500">IN</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {usage.in.toLocaleString()}
          </span>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-400 dark:text-zinc-500">OUT</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {usage.out.toLocaleString()}
          </span>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-400 dark:text-zinc-500 uppercase">{lang === 'en' ? 'Total' : 'Total'}</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
            {usage.total.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="hidden md:block text-[9px] text-zinc-400 dark:text-zinc-600 italic">
        {lang === 'en' ? 'per active chat' : 'por chat activo'}
      </div>
    </footer>
  );
}
