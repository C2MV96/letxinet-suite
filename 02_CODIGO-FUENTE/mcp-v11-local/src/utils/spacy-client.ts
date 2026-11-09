/**
 * spaCy HTTP Microservice client v9.1
 *
 * REPLACES synchronous subprocess calls with async HTTP fetch to a local Flask sidecar.
 * This resolves the Node.js event loop blocking issue.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

let sidecarProcess: ChildProcess | null = null;
let sidecarReady = false;

const SPACY_PORT = parseInt(process.env.SPACY_PORT || '4002', 10);
const SPACY_URL = `http://127.0.0.1:${SPACY_PORT}`;

export interface SpaCyAnalysis {
    lang: string;
    tokens: string[];
    lemmas: string[];
    entities: Array<{ text: string; label: string; start: number; end: number }>;
    detected_country: string | null;
    noun_chunks: string[];
    noun_chunks_lemmatized: string[];
    stopwords: string[];
    content_words: Array<{ text: string; lemma: string; pos: string; tag: string }>;
}

/**
 * Start the Python Flask sidecar asynchronously.
 */
export async function startSidecar(): Promise<boolean> {
    if (sidecarProcess) return true;

    console.log(`[spaCy] Iniciando microservicio HTTP en puerto ${SPACY_PORT}...`);

    // Resolve script path differently depending on if we are running from dist/ or src/.
    // Patch B3 (2026-07-30): en producción (install/portable), el script vive en
    // <install>/python/spacy_server.py (NO en <install>/src/python/spacy_server.py
    // porque el installer no incluye el directorio src/). El path anterior
    // apuntaba a src/python/ (válido solo en dev mode), fallando con ENOENT en
    // el install portable. Ahora intenta primero el path de install, y si no
    // existe, fallback al path de dev.
    const isProduction = __dirname.includes('dist');
    // SPACY_SCRIPT env takes precedence (used by pkg-bundled portable exe where
    // __dirname points inside the snapshot and the .py lives next to the .exe).
    let scriptPath: string;
    if (process.env.SPACY_SCRIPT) {
        scriptPath = process.env.SPACY_SCRIPT;
    } else if (isProduction) {
        // Try install layout: <install>/python/spacy_server.py
        const installPath = path.join(__dirname, '..', '..', 'python', 'spacy_server.py');
        const devPath = path.join(__dirname, '..', '..', 'src', 'python', 'spacy_server.py');
        scriptPath = fs.existsSync(installPath) ? installPath : devPath;
    } else {
        // Dev mode: <repo>/src/python/spacy_server.py (when running ts directly) or
        // <repo>/python/spacy_server.py (when running from dist/ in dev checkout).
        const devSrc = path.join(__dirname, '..', 'python', 'spacy_server.py');
        const devFallback = path.join(__dirname, '..', '..', 'src', 'python', 'spacy_server.py');
        scriptPath = fs.existsSync(devSrc) ? devSrc : devFallback;
    }

    // SPACY_PYTHON env → override python.exe path. Default: "python" from PATH.
    // For portable pkg build, the launcher sets SPACY_PYTHON=<install>/python-embedded/python.exe.
    const pythonCmd = process.env.SPACY_PYTHON || 'python';

    sidecarProcess = spawn(pythonCmd, [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SPACY_PORT: String(SPACY_PORT) }
    });

    sidecarProcess.stdout?.on('data', (data) => {
        console.log(`[spaCy-Server] ${data.toString().trim()}`);
    });

    sidecarProcess.stderr?.on('data', (data) => {
        console.error(`[spaCy-Server ERR] ${data.toString().trim()}`);
    });

    sidecarProcess.on('close', (code) => {
        console.log(`[spaCy] Sidecar cerrado con código ${code}`);
        sidecarProcess = null;
        sidecarReady = false;
    });

    // Wait for the server to be ready (up to 15 seconds)
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`${SPACY_URL}/health`);
            if (res.ok) {
                const data = (await res.json()) as any;
                if (data.ready) {
                    console.log(`[spaCy] ¡Microservicio HTTP LISTO!`);
                    sidecarReady = true;
                    return true;
                }
            }
        } catch {
            // Ignore error, server not up yet
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.error(`[spaCy] Timeout esperando al microservicio HTTP.`);
    return false;
}

export function stopSidecar(): void {
    if (sidecarProcess) {
        sidecarProcess.kill();
        sidecarProcess = null;
    }
    sidecarReady = false;
}

export function isSidecarReady(): boolean {
    return sidecarReady;
}

/**
 * Detect language quickly + extract lemmas + NER via HTTP.
 */
export async function analyzeText(text: string, lang: string = 'auto'): Promise<SpaCyAnalysis | null> {
    if (!sidecarReady) return null;
    try {
        const res = await fetch(`${SPACY_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang })
        });
        if (!res.ok) return null;
        return await res.json() as SpaCyAnalysis;
    } catch {
        return null;
    }
}

/**
 * Average word-vector similarity between two lemma sets (used for reranking) via HTTP.
 */
export async function conceptMatch(concept: string, haystack: string): Promise<boolean> {
    if (!sidecarReady) return false;
    if (!concept || !haystack) return false;
    
    try {
        const res = await fetch(`${SPACY_URL}/concept_match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept, haystack })
        });
        if (!res.ok) return false;
        const data = await res.json() as any;
        return data.match ?? false;
    } catch {
        return false;
    }
}

/**
 * Compute cosine similarity between two word sets using word vectors via HTTP.
 */
export async function wordSimilarity(word1: string, word2: string): Promise<number> {
    if (!sidecarReady) return 0.0;
    try {
        const res = await fetch(`${SPACY_URL}/similarity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word1, word2 })
        });
        if (!res.ok) return 0.0;
        const data = await res.json() as any;
        return data.score ?? 0.0;
    } catch {
        return 0.0;
    }
}

/**
 * Average word-vector similarity between two lemma sets (used for reranking) via HTTP.
 */
export async function batchSimilarity(
    queryLemmas: string[],
    candidateLemmas: string[],
): Promise<number[]> {
    if (!sidecarReady) return candidateLemmas.map(() => 0.0);
    if (!queryLemmas.length || !candidateLemmas.length) return candidateLemmas.map(() => 0.0);
    
    try {
        const res = await fetch(`${SPACY_URL}/batch_similarity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query_lemmas: queryLemmas, candidate_lemmas: candidateLemmas })
        });
        if (!res.ok) return candidateLemmas.map(() => 0.0);
        const data = await res.json() as any;
        return data.scores ?? candidateLemmas.map(() => 0.0);
    } catch {
        return candidateLemmas.map(() => 0.0);
    }
}

/**
 * Compare one word against multiple candidates. Returns scores for each.
 * Used for synonym generation in generateQueryVariations.
 */
export async function batchWordSimilarity(
    word: string,
    candidates: string[],
): Promise<number[]> {
    if (!sidecarReady) return candidates.map(() => 0.0);
    if (!word || !candidates.length) return candidates.map(() => 0.0);

    try {
        const res = await fetch(`${SPACY_URL}/batch_word_similarity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, candidates })
        });
        if (!res.ok) return candidates.map(() => 0.0);
        const data = await res.json() as any;
        return data.scores ?? candidates.map(() => 0.0);
    } catch {
        return candidates.map(() => 0.0);
    }
}

/**
 * Patch B (2026-07-27): Dynamic synonym discovery via spaCy word vectors.
 * Replaces the hardcoded CANDIDATE_POOL in mcp.ts:generateQueryVariations.
 * Returns up to `topn` synonyms above `threshold` for the given word.
 * Falls back to empty array if sidecar not ready, word is OOV, or timeout.
 * Cost: ~120ms per call (matrix dot-product over 20k vectors).
 */
export async function mostSimilar(
    word: string,
    topn: number = 10,
    threshold: number = 0.7,
): Promise<Array<{ word: string; score: number }>> {
    if (!sidecarReady) return [];
    if (!word) return [];
    try {
        const res = await fetch(`${SPACY_URL}/most_similar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, topn, threshold }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const data = await res.json() as any;
        return Array.isArray(data.synonyms) ? data.synonyms : [];
    } catch {
        return [];
    }
}
