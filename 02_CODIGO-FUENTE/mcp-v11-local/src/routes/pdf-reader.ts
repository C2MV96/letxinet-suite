/**
 * PDF Reader Routes — REST API for PDF analysis
 * POST /api/pdf/read      — Extract text from PDF
 * POST /api/pdf/metadata   — Get PDF metadata
 * POST /api/pdf/sections   — Detect academic sections
 * POST /api/pdf/citations  — Extract citations
 * POST /api/pdf/analyze    — Deep academic analysis (thesis/article)
 */

import { Router, Request, Response } from 'express';
import {
    extractText, extractMarkdown, getMetadata, detectSections, extractCitations, analyzeAcademicDocument, smartSummary
} from '../providers/pdf-processor';

const router = Router();

// POST /api/pdf/read — Extract text from PDF
router.post('/read', async (req: Request, res: Response) => {
    try {
        const { source, maxChars, pages, format } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source" (URL or file path)' });
        }

        console.log(`[PDF-API] /read — ${source.substring(0, 60)}...`);

        if (format === 'text') {
            const result = await extractText(source);
            res.json({ success: true, data: { text: result.text, pages: result.pages, info: result.info, textLength: result.text.length, format: 'text' } });
        } else {
            const result = await extractMarkdown(source, { maxChars: maxChars ?? 20000, pages });
            res.json({ success: true, data: { text: result.text, pages: result.pages, info: result.info, textLength: result.text.length, format: result.format } });
        }
    } catch (e: any) {
        console.error(`[PDF-API] /read error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/metadata — Get PDF metadata
router.post('/metadata', async (req: Request, res: Response) => {
    try {
        const { source } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /metadata — ${source.substring(0, 60)}...`);
        const metadata = await getMetadata(source);

        res.json({ success: true, data: metadata });
    } catch (e: any) {
        console.error(`[PDF-API] /metadata error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/sections — Detect academic sections
router.post('/sections', async (req: Request, res: Response) => {
    try {
        const { source } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /sections — ${source.substring(0, 60)}...`);
        const sections = await detectSections(source);

        res.json({
            success: true,
            data: {
                sections: sections.map(s => ({
                    name: s.name,
                    contentPreview: s.content.substring(0, 500),
                    contentLength: s.content.length,
                })),
                totalSections: sections.length,
            }
        });
    } catch (e: any) {
        console.error(`[PDF-API] /sections error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/citations — Extract citations
router.post('/citations', async (req: Request, res: Response) => {
    try {
        const { source } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /citations — ${source.substring(0, 60)}...`);
        const citations = await extractCitations(source);

        res.json({
            success: true,
            data: {
                citations,
                totalCitations: citations.length,
            }
        });
    } catch (e: any) {
        console.error(`[PDF-API] /citations error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/analyze — Deep academic document analysis
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { source } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /analyze — ${source.substring(0, 60)}...`);
        const analysis = await analyzeAcademicDocument(source);

        res.json({
            success: true,
            data: {
                documentType: analysis.documentType,
                language: analysis.language,
                pages: analysis.pages,
                totalWords: analysis.totalWords,
                sections: analysis.sections.map(s => ({
                    name: s.name,
                    category: s.category,
                    contentPreview: s.content.substring(0, 800),
                    contentLength: s.contentLength,
                    hasNumericalData: s.hasNumericalData,
                    statistics: s.statistics,
                })),
                globalStatistics: analysis.globalStatistics,
                summary: analysis.summary,
            }
        });
    } catch (e: any) {
        console.error(`[PDF-API] /analyze error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/markdown — Convert PDF to structured Markdown
router.post('/markdown', async (req: Request, res: Response) => {
    try {
        const { source, maxChars, pages } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /markdown — ${source.substring(0, 60)}...`);
        const result = await extractMarkdown(source, { maxChars: maxChars ?? 30000, pages });

        res.json({
            success: true,
            data: {
                text: result.text,
                pages: result.pages,
                info: result.info,
                textLength: result.text.length,
                format: result.format,
            }
        });
    } catch (e: any) {
        console.error(`[PDF-API] /markdown error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/pdf/summary — Token-efficient smart summary
router.post('/summary', async (req: Request, res: Response) => {
    try {
        const { source, maxTotalChars } = req.body;
        if (!source) {
            return res.status(400).json({ success: false, error: 'Missing "source"' });
        }

        console.log(`[PDF-API] /summary — ${source.substring(0, 60)}...`);
        const result = await smartSummary(source, maxTotalChars ?? 8000);

        res.json({ success: true, data: result });
    } catch (e: any) {
        console.error(`[PDF-API] /summary error: ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
