/**
 * v11_top5_obscure.mjs
 * Compara top-5 real V11 con vs sin spaCy para queries con LOC no en country-keywords.json.
 * Captura: 3 corridas por query (warm), keep la 2da.
 * Guarda top5_obscure_A.json (spaCy UP) y top5_obscure_B.json (spaCy DOWN).
 */
const phase = process.env.PHASE || 'A';
const BASE = process.env.V11_BASE || 'http://127.0.0.1:4002';

async function search(body) {
    const r = await fetch(BASE + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8', 'User-Agent': 'opencode-bench/0.1' },
        body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    // Normalize: API returns either {data: {sources: [...]}} or {sources: [...]} or {data: [...]}
    if (Array.isArray(j)) return j;
    if (j?.data?.sources) return j.data.sources;
    if (Array.isArray(j?.data)) return j.data;
    if (j?.sources) return j.sources;
    return [];
}

// Queries con localidades oscuras (no en country-keywords.json)
// Combinamos fuentes globales (crossref/openalex) con fastMode=false para forzar spaCy path
const scenarios = [
    // S1: query con distrito Pallasca + fuente global, sin fastMode
    { id: 'O1', run: () => search({ query: 'sicariato Pallasca Conchucos 2024', sources: ['crossref', 'openalex'], maxResults: 25, fastMode: false }) },
    // S2: query con Llamellin, fastMode=true (para ver si spaCy no se invoca y ranking cambia)
    { id: 'O2', run: () => search({ query: 'homicidio Llamellin Ancash', sources: ['crossref', 'openalex'], maxResults: 25, fastMode: true }) },
    // S3: query con provincias Ancash (varias), sin fastMode
    { id: 'O3', run: () => search({ query: 'criminalidad Pallasca Pomabamba Sihuas Ancash', sources: ['crossref', 'openalex'], maxResults: 25, fastMode: false }) },
    // S4: query sin localidad poco comun (control: spaCy debe actuar igual en ambos）
    { id: 'O4', run: () => search({ query: 'sicariato juvenil Mexico', sources: ['crossref'], maxResults: 25, fastMode: false }) },
    // S5: latam con query tradicional con Ancash
    { id: 'O5', run: () => search({ query: 'delincuencia Ancash Huaraz Caraz', sources: ['scielo', 'redalyc'], maxResults: 25, fastMode: false }) },
    // S6: query muy especifica de crimen + distrito
    { id: 'O6', run: () => search({ query: 'extorsion mineria Ancash 2023', sources: ['crossref', 'openalex'], maxResults: 25, fastMode: false }) },
];

async function main() {
    console.log(`\n=== Top-5 obscure capture PHASE=${phase} ${new Date().toISOString()} ===`);
    console.log(`Target: ${BASE}\n`);

    try { const r = await fetch(BASE + '/health'); console.log(`V11 health: ${(await r.json()).version}`); }
    catch (e) { console.error(`V11 unreachable: ${e.message}`); process.exit(1); }

    try { const r = await fetch('http://127.0.0.1:4202/health'); const j = await r.json(); console.log(`spaCy: ${j.ready ? 'UP' : 'NOT READY'} (PHASE=${phase})`); }
    catch (e) { console.log(`spaCy: DOWN (${e.message})`); }

    const out = { phase, timestamp: new Date().toISOString(), results: {} };

    for (const s of scenarios) {
        console.log(`\n>>> ${s.id}`);
        const caps = [];
        for (let i = 0; i < 3; i++) {
            const arr = await s.run();
            caps.push(arr);
            await new Promise((res) => setTimeout(res, 800));
        }
        const arr = caps[1] || caps[0];
        const top5 = arr.slice(0, 5).map((r, idx) => ({
            rank: idx + 1,
            title: (r.title || '').substring(0, 140),
            year: r.year || null,
            source: r.source || '',
            relevanceScore: r.relevanceScore ?? r._relevance ?? null,
            doi: r.doi || null,
            country: r.country || '',
        }));
        const top20 = arr.slice(0, 20).map((r, idx) => ({
            rank: idx + 1,
            title: (r.title || '').substring(0, 130),
            year: r.year || null,
            source: r.source || '',
            relevanceScore: r.relevanceScore ?? null,
            doi: r.doi || null,
            country: r.country || '',
        }));
        out.results[s.id] = { count: arr.length, top5, top20 };
        console.log(`  count=${arr.length}, top-5:`);
        for (const t of top5) console.log(`    #${t.rank} [${t.year || '????'}] (${t.source}) score=${t.relevanceScore} | ${t.title}`);
    }

    const fs = await import('fs');
    const outfile = `D:/OTROS/LETXIPU-SEARCH-MCP-V11/top5_obscure_${phase}.json`;
    fs.writeFileSync(outfile, JSON.stringify(out, null, 2));
    console.log(`\nSaved: ${outfile}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
