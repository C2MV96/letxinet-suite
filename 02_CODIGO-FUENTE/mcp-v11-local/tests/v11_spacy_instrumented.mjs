/**
 * v11_spacy_instrumented.mjs
 * Test弗雷什 queries (siempre únicas con timestamp) para forzar cache miss en extractKeyTermsSmart.
 * Compara latencia: spaCy UP vs spaCy DOWN.
 * Si latencia UP >> DOWN pero resultados idénticos → spaCy se está llamando pero no aporta nada.
 * Si latencia UP ≈ DOWN → cache hit o spaCy nunca se llama.
 */
const phase = process.env.PHASE || 'A';
const BASE = process.env.V11_BASE || 'http://127.0.0.1:4002';

async function search(body) {
    const t0 = Date.now();
    const r = await fetch(BASE + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8', 'User-Agent': 'opencode-bench/0.1' },
        body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    const ms = Date.now() - t0;
    const arr = Array.isArray(j) ? j : (j?.data?.sources || j?.sources || []);
    return { ms, arr };
}

const baseQueries = [
    'sicariato Pallasca Conchucos Ancash',
    'homicidio Llamellin Ancash',
    'extorsion mineria Ancash Huaraz',
    'criminalidad Pomabamba Sihuas',
    'delincuencia Caraz Yungay',
];

async function main() {
    console.log(`\n=== Instrumented test PHASE=${phase} ${new Date().toISOString()} ===`);
    try { const r = await fetch(BASE + '/health'); console.log(`V11 health: ${(await r.json()).version}`); } catch (e) { process.exit(1); }
    try { const r = await fetch('http://127.0.0.1:4202/health'); const j = await r.json(); console.log(`spaCy: ${j.ready ? 'UP' : 'NOT READY'}`); } catch (e) { console.log(`spaCy: DOWN`); }

    for (const q of baseQueries) {
        // Append random suffix to force cache miss
        const seed = Math.floor(Math.random() * 100000);
        const freshQuery = `${q} ${seed.toString(36)}`;
        const { ms, arr } = await search({ query: freshQuery, sources: ['crossref', 'openalex'], maxResults: 10, fastMode: false });
        const top3 = arr.slice(0, 3).map((r, i) => `#${i + 1}[${r.year || '?'}] score=${r.relevanceScore ?? '?'} | ${(r.title || '').substring(0, 60)}`);
        console.log(`\n>>> "${freshQuery}"`);
        console.log(`  ${ms}ms  count=${arr.length}`);
        top3.forEach((s) => console.log(`   ${s}`));
        await new Promise((res) => setTimeout(res, 400));
    }
}

main().catch(console.error);
