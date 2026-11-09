import type { AttachedFile, KeysConfigured } from '../types';

export type ToolEngine =
  | 'MinerU Cloud'
  | 'MinerU OCR'
  | 'MinerU AI'
  | 'MarkItDown local'
  | 'pdf-parse'
  | 'omni-word-mcp';

export type KeyRequirement = 'MINERU_API_KEY' | 'MARKITDOWN_API_URL' | null;

export type AttachmentFormatCategory = 'pdf' | 'office' | 'image' | 'text';

export interface ToolCapability {
  tool: string;
  requiresKey: KeyRequirement;
  formats: AttachmentFormatCategory[];
  engine: ToolEngine;
  description: string;
  category: 'pdf-text' | 'pdf-scanned-image' | 'office' | 'word-create';
}

export const ATTACHMENT_TOOLS: ToolCapability[] = [
  {
    tool: 'markitdown_convert',
    requiresKey: null,
    formats: ['pdf'],
    engine: 'MarkItDown local',
    description: 'Conversión local a Markdown estructurado (PyMuPDF4LLM). Sin cloud, sin límites. Soporta rango de páginas.',
    category: 'pdf-text',
  },
  {
    tool: 'pdf_metadata',
    requiresKey: null,
    formats: ['pdf'],
    engine: 'pdf-parse',
    description: 'Metadatos del PDF: título, autor, páginas, fecha creación, tamaño.',
    category: 'pdf-text',
  },
  {
    tool: 'read_pdf',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Extracción Markdown con OCR, tablas y fórmulas. Acepta URL, DOI o path local. Rango páginas + maxChars.',
    category: 'pdf-text',
  },
  {
    tool: 'read_pdf_markdown',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Markdown estructurado preservando headings, tablas y listas. OCR y layout analysis.',
    category: 'pdf-text',
  },
  {
    tool: 'pdf_smart_summary',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Resumen token-eficiente con secciones clave (abstract, methods, results, conclusions).',
    category: 'pdf-text',
  },
  {
    tool: 'pdf_sections',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Detecta secciones académicas (Abstract, Introduction, Methods, Results, Conclusion, References).',
    category: 'pdf-text',
  },
  {
    tool: 'pdf_citations',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Extrae citas y lista de referencias (estilos numerado [1] y autor-año).',
    category: 'pdf-text',
  },
  {
    tool: 'analyze_academic',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Análisis profundo: detecta tipo documento, idioma, 22 tipos de sección, extrae datos estadísticos (p-values, correlaciones, ANOVA, chi², regresiones).',
    category: 'pdf-text',
  },
  {
    tool: 'extract_section',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf'],
    engine: 'MinerU Cloud',
    description: 'Extrae sección específica por nombre (fuzzy matching ES/EN). Texto COMPLETO sin límite de caracteres.',
    category: 'pdf-text',
  },
  {
    tool: 'extract_tables',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf', 'image'],
    engine: 'MinerU OCR',
    description: 'Extrae todas las tablas como HTML o Markdown (reconocimiento ML). Maneja tablas rotadas, cross-page, merged-cells.',
    category: 'pdf-scanned-image',
  },
  {
    tool: 'extract_formulas',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf', 'image'],
    engine: 'MinerU OCR',
    description: 'Extrae fórmulas matemáticas como LaTeX (UniMERNet). Expresiones anidadas, multi-línea, display math.',
    category: 'pdf-scanned-image',
  },
  {
    tool: 'convert_document',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf', 'office', 'image'],
    engine: 'MinerU AI',
    description: 'Convierte PDF/DOCX/PPTX/XLSX/imágenes a Markdown estructurado. OCR 109 idiomas + reconocimiento tablas + fórmulas.',
    category: 'office',
  },
  {
    tool: 'batch_convert',
    requiresKey: 'MINERU_API_KEY',
    formats: ['pdf', 'office', 'image'],
    engine: 'MinerU AI',
    description: 'Conversión paralela de múltiples documentos (máx 10). Markdown por documento.',
    category: 'office',
  },
];

export const OFFICE_TOOLS: ToolCapability[] = [
  {
    tool: 'omni-word-mcp',
    requiresKey: null,
    formats: ['text'],
    engine: 'omni-word-mcp',
    description: 'Crea/edita documentos Word: add_heading, add_paragraph, add_table, add_picture, format_table, convert_to_pdf.',
    category: 'word-create',
  },
];

export interface ToolAvailabilityResult {
  active: boolean;
  reason?: 'no_key' | 'invalid_format' | 'batch_overflow' | 'markitdownOffline';
  blockingEnvVar?: string;
  supportedFormats?: string[];
}

export function isToolAvailable(
  tool: ToolCapability,
  keys: KeysConfigured,
  file: AttachedFile | null,
  options: { batchSize?: number } = {}
): ToolAvailabilityResult {
  // MarkItDown local es la única tool que requiere que la API local esté online.
  // Si MARKITDOWN_API_URL no está configurada (o el servicio NSSM está caído),
  // marcamos la tool como bloqueada con reason='markitdownOffline' (prioridad más
  // alta que 'invalid_format' porque no hay nada que el usuario pueda hacer con un PDF
  // hasta que MarkItDown vuelva). Si MINERU_API_KEY está configurada, el usuario puede
  // seguir usando las tools cloud de MinerU, por lo que esto NO bloquea todo el panel.
  if (tool.tool === 'markitdown_convert' && !keys.markitdownAvailable) {
    return {
      active: false,
      reason: 'markitdownOffline',
      blockingEnvVar: 'MARKITDOWN_API_URL',
    };
  }
  const keyOk =
    tool.requiresKey === null ||
    (tool.requiresKey === 'MINERU_API_KEY' && keys.mineruApiKey) ||
    (tool.requiresKey === 'MARKITDOWN_API_URL' && keys.markitdownAvailable);
  if (!keyOk) {
    return {
      active: false,
      reason: 'no_key',
      blockingEnvVar: tool.requiresKey || undefined,
    };
  }
  if (!file) return { active: true };
  if (!tool.formats.includes(file.format)) {
    return {
      active: false,
      reason: 'invalid_format',
      supportedFormats: tool.formats,
    };
  }
  if (tool.tool === 'batch_convert' && options.batchSize && options.batchSize > 10) {
    return {
      active: false,
      reason: 'batch_overflow',
      supportedFormats: tool.formats,
    };
  }
  return { active: true };
}

export function categorizeByExt(ext: string): AttachedFile['format'] {
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'pptx':
    case 'xlsx':
      return 'office';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'tiff':
    case 'tif':
    case 'bmp':
    case 'webp':
      return 'image';
    case 'txt':
    case 'md':
      return 'text';
    default:
      return 'text';
  }
}

export const ACCEPTED_EXTENSIONS: string[] = [
  '.pdf', '.docx', '.pptx', '.xlsx',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp',
  '.txt', '.md',
];

export const FORMAT_GROUPS: { category: ToolCapability['category']; label: string; formats: AttachmentFormatCategory[] }[] = [
  { category: 'pdf-text', label: 'PDF (texto)', formats: ['pdf'] },
  { category: 'pdf-scanned-image', label: 'PDF escaneado / Imagen (PNG/JPG/TIFF/BMP/WebP)', formats: ['pdf', 'image'] },
  { category: 'office', label: 'DOCX / PPTX / XLSX', formats: ['office'] },
  { category: 'word-create', label: 'Word/Markdown (creación y edición)', formats: ['text'] },
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
