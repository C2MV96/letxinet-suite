/**
 * MobileChatDrawer — Overlay deslizable desde la izquierda para el historial de chats.
 * En móvil, ChatSidebar está oculto (hidden md:block en App.tsx).
 * Este drawer replica el panel dentro de un overlay deslizable.
 *
 * v1.0.11-mobile — Añadido para navegación móvil completa.
 */
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function MobileChatDrawer({ open, onClose, children }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      />

      {/* Drawer panel (desde la izquierda, 80% del ancho, max 320px) */}
      <div
        ref={drawerRef}
        className="absolute top-0 left-0 bottom-0 w-[80%] max-w-[320px] bg-white dark:bg-zinc-950 shadow-2xl border-r border-zinc-200 dark:border-zinc-800 flex flex-col"
        style={{ animation: 'slideInLeft 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
            Chats
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
