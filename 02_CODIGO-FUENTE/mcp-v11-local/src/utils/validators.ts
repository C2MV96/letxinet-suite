/**
 * Zod schemas for MCP tool input validation.
 * Provides type-safe, user-friendly error messages with examples.
 */
import { z } from 'zod';

// ─── Shared helpers ───

const YearString = z.string().regex(/^\d{4}$/, 'Must be a 4-digit year (e.g. "2023")');

const SourceArray = z.union([z.string(), z.array(z.string())]).optional().transform(
  v => typeof v === 'string' ? [v] : v
).describe(
  'Source IDs or groups. Valid: "latam", "global", "tesis", "iberoamerica", "peru", "all", or specific IDs like "alicia", "openalex"'
);

// ─── batch_search ───

const BatchSearchSchema = z.object({
  queries: z.array(z.string().min(1, 'Query cannot be empty').max(200)).max(10, 'Max 10 queries per batch').optional(),
  query: z.string().trim().min(1, 'Query cannot be empty').max(200).optional(),
  sources: SourceArray,
  maxResults: z.number().int().min(1, 'minResults must be >= 1').max(120, 'maxResults cannot exceed 120').optional(),
  yearStart: YearString.optional(),
  yearEnd: YearString.optional(),
  university: z.string().optional(),
  location: z.string().optional(),
  fastMode: z.boolean().optional(),
  filterFalsePositives: z.boolean().optional(),
}).refine(data => data.queries || data.query, {
  message: 'Provide at least one of: queries (array) or query (string)',
}).refine(data => {
  if (data.queries && data.queries.length === 0) return false;
  return true;
}, {
  message: 'queries array cannot be empty',
}).refine(data => {
  if (data.yearStart && data.yearEnd) {
    return parseInt(data.yearStart) <= parseInt(data.yearEnd);
  }
  return true;
}, {
  message: 'yearStart must be <= yearEnd',
});

// ─── search / smart_search ───

const SearchSchema = z.object({
  query: z.string().trim().min(1, 'Query cannot be empty').max(200, 'Query too long (max 200 chars)'),
  sources: SourceArray,
  maxSources: z.number().int().min(1).max(100, 'maxSources cannot exceed 100').optional(),
  maxResults: z.number().int().min(1).max(120).optional(),
  yearStart: YearString.optional(),
  yearEnd: YearString.optional(),
  university: z.string().optional(),
  location: z.string().optional(),
  fastMode: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  includeThesisVariants: z.boolean().optional(),
  filterFalsePositives: z.boolean().optional(),
}).refine(data => {
  if (data.yearStart && data.yearEnd) {
    return parseInt(data.yearStart) <= parseInt(data.yearEnd);
  }
  return true;
}, {
  message: 'yearStart must be <= yearEnd',
});

// ─── PDF source (shared by 8+ tools) ───

const PdfSourceSchema = z.object({
  source: z.string({ error: 'source is required' })
    .min(1, 'source is required')
    .max(2000)
    .refine(
      s => s.startsWith('http://') || s.startsWith('https://') ||
           s.startsWith('10.') || s.includes('/') || s.match(/^[A-Z]:\\/),
      'source must be a URL (http/https), DOI (10.XXXX/...), or file path'
    ),
});

// ─── extract_section ───

const ExtractSectionSchema = PdfSourceSchema.extend({
  section: z.string().min(1, 'section name is required').max(100),
});

// ─── read_pdf / read_pdf_markdown ───

const ReadPdfSchema = PdfSourceSchema.extend({
  maxChars: z.number().int().min(-1).max(500000).optional(),
  pages: z.string().max(50).optional().describe('Page range: "1-5", "1,3,7", "last3", "first5"'),
  format: z.enum(['markdown', 'text']).optional(),
});

// ─── pdf_smart_summary ───

const PdfSmartSummarySchema = PdfSourceSchema.extend({
  maxTotalChars: z.number().int().min(100).max(200000).optional(),
});

// ─── convert_document ───

const ConvertDocumentSchema = PdfSourceSchema.extend({
  maxChars: z.number().int().min(-1).max(500000).optional(),
});

// ─── batch_convert ───

const BatchConvertSchema = z.object({
  sources: z.array(z.string().min(1)).min(1, 'At least 1 source required').max(10, 'Max 10 files per batch'),
  maxCharsPerDoc: z.number().int().min(100).max(100000).optional(),
});

// ─── extract_tables ───

const ExtractTablesSchema = PdfSourceSchema.extend({
  format: z.enum(['html', 'markdown']).optional(),
});

// ─── enrich_metadata ───

const EnrichMetadataSchema = z.object({
  papers: z.array(z.object({
    title: z.string().optional(),
    doi: z.string().optional(),
    url: z.string().optional(),
  }).passthrough()).min(1, 'At least 1 paper required').max(50, 'Max 50 papers per batch'),
});

// ─── fetch_metadata / recover_metadata ───

const MetadataIdentifierSchema = z.object({
  doi: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
}).refine(data => data.doi || data.url || data.title, {
  message: 'Provide at least one of: doi, url, title',
}).refine(data => {
  if (data.doi) return /^10\.\d{4,}\/.+/.test(data.doi);
  return true;
}, {
  message: 'Invalid DOI format. Expected: 10.XXXX/... (e.g. "10.1038/s41586-020-2649-2")',
});

// ─── download_pdf ───

const DownloadPdfSchema = z.object({
  url: z.string().optional(),
  doi: z.string().optional(),
}).refine(data => data.doi || data.url, {
  message: 'Provide at least one of: doi, url',
});

// ─── resolve_pdf ───

const ResolvePdfSchema = z.object({
  identifier: z.string().min(1, 'identifier is required').max(2000),
});

// ─── help ───

const HelpSchema = z.object({
  topic: z.string().optional(),
});

// ─── specialized search tools ───

const SpecializedSearchSchema = z.object({
  query: z.string().trim().min(1, 'Query cannot be empty').max(200),
  maxResults: z.number().int().min(1).max(100).optional(),
});

// ─── trending_papers (query optional) ───

const TrendingPapersSchema = z.object({
  query: z.string().max(200).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});

// ─── Empty schemas (no args needed) ───

const EmptySchema = z.object({});

// ─── coverage_report ───

const CoverageReportSchema = z.object({
  use_cache: z.boolean().optional(),
  format: z.enum(['json', 'text']).optional(),
});

// ─── Schema map ───

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  batch_search: BatchSearchSchema,
  search: SearchSchema,
  smart_search: SearchSchema,
  read_pdf: ReadPdfSchema,
  pdf_metadata: PdfSourceSchema,
  pdf_sections: PdfSourceSchema,
  pdf_citations: PdfSourceSchema,
  analyze_academic: PdfSourceSchema,
  extract_section: ExtractSectionSchema,
  read_pdf_markdown: ReadPdfSchema,
  pdf_smart_summary: PdfSmartSummarySchema,
  convert_document: ConvertDocumentSchema,
  batch_convert: BatchConvertSchema,
  extract_tables: ExtractTablesSchema,
  extract_formulas: PdfSourceSchema,
  enrich_metadata: EnrichMetadataSchema,
  fetch_metadata: MetadataIdentifierSchema,
  recover_metadata: MetadataIdentifierSchema,
  download_pdf: DownloadPdfSchema,
  resolve_pdf: ResolvePdfSchema,
  health_check: EmptySchema,
  list_sources: EmptySchema,
  help: HelpSchema,
  coverage_report: CoverageReportSchema,
  search_dblp: SpecializedSearchSchema,
  search_paperswithcode: SpecializedSearchSchema,
  trending_papers: TrendingPapersSchema,
  search_conferences: SpecializedSearchSchema,
};

// ─── Performance warnings (non-blocking) ───

const SOURCE_WARNINGS: Array<{ condition: (data: any) => boolean; message: string }> = [
  {
    condition: (d) => d.sources?.includes('peru'),
    message: 'sources=["peru"] averages 91s per query. Consider ["alicia","renati"] for faster results.',
  },
  {
    condition: (d) => d.sources?.length === 1 && d.sources[0] === 'latam',
    message: 'sources=["latam"] may timeout with 5+ concurrent requests. Add specific sources for reliability.',
  },
];

// ─── Validation entry point ───

export type ValidationResult =
  | { ok: true; data: any; warnings: string[] }
  | { ok: false; error: string; hint?: string };

const TOOL_HINTS: Record<string, string> = {
  batch_search: 'Example: { "queries": ["acido indolacetico bacterias"], "sources": ["latam"], "maxResults": 30 }',
  search: 'Example: { "query": "acido indolacetico bacterias", "sources": ["latam"] }',
  smart_search: 'Example: { "query": "acido indolacetico bacterias" }',
  resolve_pdf: 'Example: { "identifier": "10.1038/s41586-020-2649-2" }',
  batch_convert: 'Example: { "sources": ["https://arxiv.org/pdf/2301.00001.pdf"] }',
  enrich_metadata: 'Example: { "papers": [{"title": "...", "doi": "10.xxx/..."}] }',
  fetch_metadata: 'Example: { "doi": "10.1038/s41586-020-2649-2" } or { "title": "paper title" }',
  recover_metadata: 'Example: { "doi": "10.1038/s41586-020-2649-2" }',
  extract_section: 'Example: { "source": "https://...", "section": "metodología" }',
  read_pdf: 'Example: { "source": "https://arxiv.org/pdf/2301.00001.pdf" }',
  download_pdf: 'Example: { "doi": "10.1038/s41586-020-2649-2" }',
};

export function validateToolInput(toolName: string, args: any): ValidationResult {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return { ok: true, data: args, warnings: [] };

  const result = schema.safeParse(args);
  if (result.success) {
    const warnings: string[] = [];
    for (const w of SOURCE_WARNINGS) {
      if (w.condition(result.data)) warnings.push(w.message);
    }
    return { ok: true, data: result.data, warnings };
  }

  const firstIssue = result.error.issues[0];
  const fieldPath = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '(root)';
  const hint = TOOL_HINTS[toolName];

  return {
    ok: false,
    error: `Invalid input for "${toolName}" — field ${fieldPath}: ${firstIssue.message}`,
    hint,
  };
}
