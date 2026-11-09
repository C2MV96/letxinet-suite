/**
 * Captura cruda del top-5 (titulo + score + year + source) para cada escenario
 * Output: D:/OTROS/LETXIPU-SEARCH-MCP-V11/top5_raw_<PHASE>.json
 *
 * Usage:
 *   PHASE=A node tests/v11_top5_capture.mjs   (spaCy UP)
 *   PHASE=B node tests/v11_top5_capture.mjs   (spaCy DOWN)
 */
const phase = process.env.PHASE || 'A';
const BASE = process.env.V11_BASE || 'http://127.0.0.1:4002';

async function post(path, body) {
    const r = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'opencode-bench/0.1' },
        body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    return j?.data?.sources || (Array.isArray(j?.data) ? j.data : []);
}

async function mcpBatch(body) {
    const rpcBody = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'batch_search', arguments: body } };
    const r = await fetch(BASE + '/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'opencode-bench/0.1' },
        body: JSON.stringify(rpcBody),
    });
    const j = await r.json().catch(() => null);
    if (j?.result?.content?.[0]?.text) {
        try { return JSON.parse(j.result.content[0].text)?.data?.sources || []; } catch { return []; }
    }
    return [];
}

const scenarios = [
    { id: 'S1', run: () => post('/api/search', { query: 'sicariato Peru 2024', sources: ['crossref'], maxResults: 20, fastMode: true }) },
    { id: 'S2', run: () => post('/api/search', { query: 'homicidio doloso Ancash', sources: ['crossref', 'openalex'], maxResults: 20, fastMode: false }) },
    { id: 'S3', run: () => post('/api/search', { query: 'agricultura tradicional', sources: ['scielo', 'redalyc'], maxResults: 20, fastMode: false }) },
    { id: 'S4', run: () => mcpBatch({ queries: ['sicariato', 'extorsion'], sources: ['latam', 'global'], maxResults: 20, fastMode: true }) },
];

async function main() {
    console.log(`\n=== Top-5 raw capture PHASE=${phase} ${new Date().toISOString()} ===`);
    console.log(`Target: ${BASE}\n`);

    try { const r = await fetch(BASE + '/health'); console.log(`V11 health: ${(await r.json()).version}`); }
    catch (e) { console.error(`V11 unreachable: ${e.message}`); process.exit(1); }

    try { const r = await fetch('http://127.0.0.1:4202/health'); const j = await r.json(); console.log(`spaCy: ${j.ready ? 'UP' : 'NOT READY'} (PHASE=${phase})`); }
    catch (e) { console.log(`spaCy: DOWN (${e.message})`); }

    const out = { phase, timestamp: new Date().toISOString(), results: {} };

    for (const s of scenarios) {
        console.log(`\n>>> ${s.id}`);
        // 3 calls and keep the median-order one (reduce variance)
        const captures = [];
        for (let i = 0; i < 3; i++) {
            const arr = await s.run();
            captures.push(arr);
            await new Promise((res) => setTimeout(res, 600));
        }
        // Use the second capture (warm cache)
        const arr = captures[1] || captures[0];
        const top5 = arr.slice(0, 5).map((r, idx) => ({
            rank: idx + 1,
            title: (r.title || '').substring(0, 140),
            year: r.year || null,
            source: r.source || '',
            relevanceScore: r.relevanceScore ?? r._relevance ?? null,
            doi: r.doi || null,
            country: r.country || '',
        }));
        out.results[s.id] = {
            count: arr.length,
            top5,
            // Also capture full ordering signal: top-10 titles for comparison
            top10_titles: arr.slice(0, 10).map((r, idx) => ({ rank: idx + 1, title: (r.title || '').substring(0, 140), year: r.year || null, source: r.source || '' })),
        };
        console.log(`  count=${arr.length}, captured top-5:`);
        for (const t of top5) {
            console.log(`    #${t.rank} [${t.year || '????'}] (${t.source}) ${t.title}`);
        }
    }

    const fs = await import('fs');
    const outfile = `D:/OTROS/LETXIPU-SEARCH-MCP-V11/top5_raw_${phase}.json`;
    fs.writeFileSync(outfile, JSON.stringify(out, null, 2));
    console.log(`\nSaved: ${outfile}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
