import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, FileText, Image, File, X, Lock, Ban, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { AttachedFile, KeysConfigured } from '../types';
import {
  ATTACHMENT_TOOLS,
  isToolAvailable,
  categorizeByExt,
  ACCEPTED_EXTENSIONS,
  FORMAT_GROUPS,
  formatBytes,
} from '../lib/attachment-tool-matrix';

interface Props {
  attachedFiles: AttachedFile[];
  setAttachedFiles: (files: AttachedFile[]) => void;
  onProcede: () => void;
  setInputMessage: (text: string) => void;
  i18n: {
    title: string;
    elegir: string;
    close: string;
    procede: string;
    noKey: string;
    noFormat: string;
    markitdownOffline: string;
    matrixTitle: string;
    filesTitle: string;
    keysStatus: string;
    remove: string;
    preview: string;
    noFiles: string;
    selectTool: string;
    selectAll: string;
    deselectAll: string;
    selectedCount: string;
  };
}

export default function AttachmentExtraToolsPanel({
  attachedFiles,
  setAttachedFiles,
  onProcede,
  setInputMessage,
  i18n,
}: Props) {
  const [open, setOpen] = useState(false);
  // Map<filePath, toolName[]> de tools seleccionados por archivo
  const [selectedTools, setSelectedTools] = useState<Record<string, string[]>>({});
  const [keys, setKeys] = useState<KeysConfigured>({ mineruApiKey: false, markitdownAvailable: false });
  const [toast, setToast] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingKeys(true);
    fetch('/api/keys')
      .then((r) => r.json())
      .then((d) => {
        setKeys({
          mineruApiKey: !!d.mineruApiKeyConfigured,
          markitdownAvailable: !!d.markitdownAvailable,
        });
      })
      .catch(() => setKeys({ mineruApiKey: false, markitdownAvailable: false }))
      .finally(() => setLoadingKeys(false));
  }, [open]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fase P10 — Construye un mensaje de query para el textarea del chat,
  // basado en los archivos adjuntos y los tools seleccionados para cada uno.
  // Cada archivo genera un bloque con sus tools (descripción incluida).
  // Si no hay tools seleccionados, no se inserta query (usuario escribe manual).
  const buildQueryForSelected = useCallback((): string => {
    if (attachedFiles.length === 0) return '';
    const lines: string[] = [];
    lines.push('Analiza los siguientes archivos adjuntos usando las tools indicadas:');
    lines.push('');
    for (const file of attachedFiles) {
      const tools = selectedTools[file.path] || [];
      lines.push(`**${file.name}** (${formatBytes(file.size)}, \`${file.ext}\`)`);
      lines.push(`  Path: \`${file.path}\``);
      if (tools.length === 0) {
        lines.push('  ⚠️ No se seleccionaron tools específicos — la IA decidirá automáticamente.');
      } else if (tools.length === 1) {
        lines.push(`  Tool: \`${tools[0]}\``);
      } else {
        lines.push('  Tools:');
        for (const tn of tools) {
          const t = ATTACHMENT_TOOLS.find((x) => x.tool === tn);
          lines.push(`    - \`${tn}\`: ${t?.description ?? ''}`);
        }
      }
      lines.push('');
    }
    lines.push('-- Fin de archivos adjuntos --');
    return lines.join('\n');
  }, [attachedFiles, selectedTools]);

  const toggleToolSelection = useCallback((filePath: string, toolName: string) => {
    setSelectedTools((prev) => {
      const current = prev[filePath] || [];
      const next = current.includes(toolName)
        ? current.filter((t) => t !== toolName)
        : [...current, toolName];
      return { ...prev, [filePath]: next };
    });
  }, []);

  const selectAllToolsForFile = useCallback((filePath: string, availableTools: string[]) => {
    setSelectedTools((prev) => ({ ...prev, [filePath]: [...availableTools] }));
  }, []);

  const deselectAllToolsForFile = useCallback((filePath: string) => {
    setSelectedTools((prev) => ({ ...prev, [filePath]: [] }));
  }, []);

  const handleProcede = useCallback(() => {
    const query = buildQueryForSelected();
    if (query) {
      setInputMessage(query);
      showToast('✅ Query insertado — revisa y edita antes de enviar (Enter)');
    } else {
      showToast('⚠️ Selecciona al menos un archivo o tool');
    }
    setOpen(false);
    onProcede();
    setTimeout(() => {
      const ta = document.querySelector('textarea#mcp-chat-input') as HTMLTextAreaElement | null;
      if (ta) { ta.focus(); if (ta.value) ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 100);
  }, [buildQueryForSelected, setInputMessage, onProcede, showToast]);

  const handlePickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      const newFiles: AttachedFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        // Electron 32+ depreca File.path. Con contextIsolation:true, el preload
        // (preload.cjs) expone window.letxipuDrops.getPathForFile(file) usando
        // webUtils.getPathForFile() del main process. Si no hay preload, falla
        // y pide arrastrar.
        let path: string = '';
        const drops = (window as any).letxipuDrops;
        if (drops && typeof drops.getPathForFile === 'function') {
          try { path = drops.getPathForFile(f) || ''; } catch (_) { path = ''; }
        }
        if (!path) {
          path = (f as any).path || (f as any).webkitRelativePath || '';
        }
        if (!path) {
          showToast('⚠️ Picker no expone path absoluto. Arrastra el archivo al panel.');
          continue;
        }
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const format = categorizeByExt(ext);
        newFiles.push({
          path,
          name: f.name,
          ext: ext as AttachedFile['ext'],
          size: f.size,
          format,
        });
      }
      setAttachedFiles([...attachedFiles, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [attachedFiles, setAttachedFiles, showToast]
  );

  // Fase P10 — DRAG & DROP: Electron 32+ expone File.path SÓLO en dataTransfer.files
  // (no en input HTML con contextIsolation:true). Drag-drop es el path canónico.
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const fileList = e.dataTransfer.files;
      if (!fileList || fileList.length === 0) return;
      const newFiles: AttachedFile[] = [];
      const drops = (window as any).letxipuDrops;
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        // Electron expose path absoluto via preload (webUtils.getPathForFile).
        let path: string = '';
        if (drops && typeof drops.getPathForFile === 'function') {
          try { path = drops.getPathForFile(f) || ''; } catch (_) { path = ''; }
        }
        if (!path) path = (f as any).path || '';
        if (!path) {
          showToast(`⚠️ "${f.name}" no expone path. Necesitas Suite Electron.`);
          continue;
        }
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes('.' + ext)) {
          showToast(`🚫 "${f.name}": formato .${ext} no soportado`);
          continue;
        }
        const format = categorizeByExt(ext);
        newFiles.push({
          path,
          name: f.name,
          ext: ext as AttachedFile['ext'],
          size: f.size,
          format,
        });
      }
      if (newFiles.length > 0) {
        setAttachedFiles([...attachedFiles, ...newFiles]);
        showToast(`✅ ${newFiles.length} archivo(s) añadido(s)`);
      }
    },
    [attachedFiles, setAttachedFiles, showToast]
  );

  const handleRemoveFile = useCallback(
    (idx: number) => {
      setAttachedFiles(attachedFiles.filter((_, i) => i !== idx));
    },
    [attachedFiles, setAttachedFiles]
  );

  const handleToolClick = useCallback(
    (toolName: string, file: AttachedFile | null) => {
      const tool = ATTACHMENT_TOOLS.find((t) => t.tool === toolName);
      if (!tool) return;
      const status = isToolAvailable(tool, keys, file);
      if (!status.active) {
        if (status.reason === 'no_key') {
          showToast(`🔒 ${toolName} requiere ${status.blockingEnvVar} — configúrala en Ajustes de API Keys`);
        } else if (status.reason === 'invalid_format') {
          showToast(`🚫 ${toolName} no soporta .${file?.ext} — solo: ${status.supportedFormats?.join(', ')}`);
        } else if (status.reason === 'batch_overflow') {
          showToast(`🚫 ${toolName} excede el máximo (10 archivos por batch)`);
        } else {
          showToast(`⚠️ ${toolName} no disponible`);
        }
        return;
      }
      // Modo directo: ejecutar tool con file.path
      fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          arguments: { path: file?.path, source: file?.path, maxChars: 4000 },
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          showToast(`✅ ${toolName} ejecutado (${d.duration?.toFixed(2) || '?'}s)`);
        })
        .catch((e) => showToast(`❌ ${toolName} falló: ${e.message}`));
    },
    [keys, showToast]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-0 ${
          open
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
        }`}
        title="Attachment / Extra Tools"
      >
        <Plus className="w-4 h-4 stroke-[2]" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">📎 {i18n.title}</h3>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md"
              title={i18n.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* DROPZONE — arrastra archivos aquí. Electron expone path absoluto
                en dataTransfer.files (no en input HTML con contextIsolation). */}
            <div>
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="w-full px-4 py-4 bg-indigo-50/80 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-400 dark:border-indigo-700 rounded-xl text-center text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition cursor-pointer"
                title="Arrastra archivos aquí (o click para picker)"
                onClick={handlePickFiles}
              >
                <div className="text-2xl mb-1">📂</div>
                <div className="font-bold">{i18n.elegir}</div>
                <div className="text-[10px] opacity-70 mt-1">Arrastra archivos al panel o click para picker</div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1.5 px-1">
                Acepta: {ACCEPTED_EXTENSIONS.map((e) => e.slice(1)).join(' · ')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS.join(',')}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* KEYS STATUS */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="font-bold uppercase tracking-widest text-zinc-500">{i18n.keysStatus}:</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${keys.mineruApiKey ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                MinerU API: {keys.mineruApiKey ? '✅ configurada' : '🔒 sin key'}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${keys.markitdownAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                MarkItDown: {keys.markitdownAvailable ? '✅ online' : '⚠️ offline'}
              </span>
              {loadingKeys && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
            </div>

            {/* ADJUNTOS */}
            {attachedFiles.length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{i18n.filesTitle} ({attachedFiles.length}):</p>
                <div className="space-y-2">
                  {attachedFiles.map((file, idx) => {
                    const icon = file.format === 'pdf' ? <FileText className="w-4 h-4 text-rose-500" /> : file.format === 'image' ? <Image className="w-4 h-4 text-emerald-500" /> : file.format === 'office' ? <File className="w-4 h-4 text-indigo-500" /> : <File className="w-4 h-4 text-zinc-500" />;
                    return (
                      <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {icon}
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">{file.name}</span>
                            <span className="text-[10px] text-zinc-400 shrink-0">{formatBytes(file.size)}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(idx)}
                            className="p-1 text-zinc-400 hover:text-rose-500 rounded-md"
                            title={i18n.remove}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <ToolList
                          file={file}
                          keys={keys}
                          selectedTools={selectedTools[file.path] || []}
                          onToolToggle={(tool) => toggleToolSelection(file.path, tool)}
                          onSelectAll={(tools) => selectAllToolsForFile(file.path, tools)}
                          onDeselectAll={() => deselectAllToolsForFile(file.path)}
                          i18nSelectAll={i18n.selectAll}
                          i18nDeselectAll={i18n.deselectAll}
                          i18nSelectedCount={i18n.selectedCount}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">{i18n.noFiles}</p>
            )}

            {/* MATRIZ COMPLETA */}
            <details className="group">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <ChevronRight className="w-3 h-3 group-open:hidden" />
                <ChevronDown className="w-3 h-3 hidden group-open:inline" />
                {i18n.matrixTitle}
              </summary>
              <div className="mt-2 pl-3 space-y-3 text-xs">
                {FORMAT_GROUPS.map((grp) => (
                  <div key={grp.category}>
                    <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">▸ {grp.label}</p>
                    <ul className="space-y-1">
                      {ATTACHMENT_TOOLS.filter((t) => grp.formats.some((f) => t.formats.includes(f))).map((tool) => {
                        const status = isToolAvailable(tool, keys, null);
                        const isLocked = !status.active;
                        return (
                          <li
                            key={tool.tool}
                            className={`flex items-center gap-2 ${isLocked ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer hover:text-indigo-500'}`}
                            title={
                              status.reason === 'no_key'
                                ? `Requiere ${status.blockingEnvVar} — configúrala en Ajustes de API Keys`
                                : !status.active && status.reason === 'markitdownOffline'
                                ? 'MarkItDown API local offline — revisa NSSM MarkitdownApi'
                                : tool.description
                            }
                          >
                            {status.active ? (
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            ) : status.reason === 'invalid_format' ? (
                              <Ban className="w-3 h-3 text-rose-500 shrink-0" />
                            ) : (
                              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                            <code className="font-mono text-[11px]">{tool.tool}</code>
                            <span className="text-[10px] text-zinc-400">— {tool.engine}</span>
                            {tool.requiresKey && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                {keys.mineruApiKey ? '✅ key' : '🔒 key'}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>

            {/* PREVIEW */}
            {attachedFiles.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 group-open:hidden" />
                  <ChevronDown className="w-3 h-3 hidden group-open:inline" />
                  {i18n.preview}
                </summary>
                <pre className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
{buildPreview(attachedFiles, keys)}
                </pre>
              </details>
            )}

            {/* BOTONES */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 rounded-lg"
              >
                {i18n.close}
              </button>
              <button
                onClick={handleProcede}
                disabled={attachedFiles.length === 0}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {i18n.procede}
              </button>
            </div>
          </div>

          {toast && (
            <div className="absolute top-3 right-3 max-w-xs px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium rounded-lg shadow-xl animate-fade-in">
              {toast}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ToolList({
  file,
  keys,
  selectedTools,
  onToolToggle,
  onSelectAll,
  onDeselectAll,
  i18nSelectAll,
  i18nDeselectAll,
  i18nSelectedCount,
}: {
  file: AttachedFile;
  keys: KeysConfigured;
  selectedTools: string[];
  onToolToggle: (tool: string) => void;
  onSelectAll: (availableTools: string[]) => void;
  onDeselectAll: () => void;
  i18nSelectAll: string;
  i18nDeselectAll: string;
  i18nSelectedCount: string;
}) {
  const applicable = ATTACHMENT_TOOLS.filter((t) => t.formats.includes(file.format));
  const availableTools = applicable.filter((t) => isToolAvailable(t, keys, file).active).map((t) => t.tool);
  const allSelected = availableTools.length > 0 && availableTools.every((t) => selectedTools.includes(t));

  return (
    <div className="space-y-1.5">
      {/* Fila de acciones rápidas: Todos / Ninguno / contador */}
      <div className="flex items-center gap-2 text-[10px]">
        <button
          type="button"
          onClick={() => allSelected ? onDeselectAll() : onSelectAll(availableTools)}
          disabled={availableTools.length === 0}
          className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition focus:outline-none"
          title={allSelected ? i18nDeselectAll : i18nSelectAll}
        >
          {allSelected ? i18nDeselectAll : i18nSelectAll}
        </button>
        <span className="text-zinc-400">
          {i18nSelectedCount}: {selectedTools.length}/{availableTools.length}
        </span>
      </div>
      {/* Chips de tools toggle */}
      <div className="flex flex-wrap gap-1">
        {applicable.map((tool) => {
          const status = isToolAvailable(tool, keys, file);
          const isLocked = !status.active;
          const isSelected = !isLocked && selectedTools.includes(tool.tool);
          return (
            <button
              key={tool.tool}
              type="button"
              onClick={() => !isLocked && onToolToggle(tool.tool)}
              disabled={isLocked}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition focus:outline-none ${
                isLocked
                  ? status.reason === 'invalid_format'
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 cursor-not-allowed'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 cursor-not-allowed'
                  : isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-300 dark:ring-indigo-700 hover:bg-indigo-700 cursor-pointer'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer'
              }`}
              title={
                status.reason === 'no_key'
                  ? `🔒 Requiere ${status.blockingEnvVar}`
                  : status.reason === 'invalid_format'
                    ? `🚫 No soporta .${file.ext}`
                    : status.reason === 'markitdownOffline'
                      ? '⚠️ MarkItDown offline'
                      : isSelected
                        ? `✅ Seleccionado: ${tool.description}`
                        : `Click para seleccionar: ${tool.description}`
              }
            >
              {isLocked
                ? status.reason === 'invalid_format'
                  ? <Ban className="w-2.5 h-2.5" />
                  : <Lock className="w-2.5 h-2.5" />
                : isSelected
                  ? <Check className="w-2.5 h-2.5" />
                  : <Plus className="w-2.5 h-2.5" />}
              <code className="font-mono">{tool.tool}</code>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildPreview(files: AttachedFile[], keys: KeysConfigured): string {
  const lines: string[] = [];
  lines.push('> Archivos adjuntos (paths absolutos):');
  for (const file of files) {
    lines.push(`>   • ${file.path} [${file.ext}, ${formatBytes(file.size)}]`);
    const active: string[] = [];
    const blocked: string[] = [];
    for (const tool of ATTACHMENT_TOOLS) {
      const status = isToolAvailable(tool, keys, file);
      if (status.active) active.push(tool.tool);
      else if (status.reason === 'no_key') blocked.push(`${tool.tool} (🔒)`);
      else if (status.reason === 'invalid_format') blocked.push(`${tool.tool} (🚫)`);
    }
    if (active.length) lines.push(`>     ✅ ${active.join(', ')}`);
    if (blocked.length) lines.push(`>     ${blocked.join(' | ')}`);
  }
  lines.push('>');
  lines.push('> IMPORTANTE: NO intentes llamar las tools marcadas con 🔒 o 🚫.');
  return lines.join('\n');
}
