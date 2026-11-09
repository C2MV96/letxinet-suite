/**
 * S4: Comparative V10 vs V11 — search latam+global WITHOUT fastMode (spaCy on)
 *     5 rounds alternating, 2 distinct queries.
 *
 * Expected: V11 wins via Mejora 1 (extractKeyTerms cache) when same query repeats
 */
const V10 = 'http://127.0.0.1:4000';
const V11 = 'http://127.0.0.1:4002';

async function bs(base, q) {
    const t0 = process.hrtime.bigint();
    const r = await fetch(base + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sources: ['latam', 'global'], maxResults: 20, fastMode: false }),
    });
    const j = await r.json().catch(() => null);
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, count: j?.data?.sources?.length || 0 };
}

function p(arr, pct) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * pct / 100) - 1)];
}

async function main() {
    console.log('\n=== S4: search latam+global sin fastMode, 5 rounds (Alt q) ===');
    console.log('>>> warmup 1 c/u');
    await bs(V10, 'sicariato x');
    await bs(V11, 'sicariato x');

    const v10 = [], v11 = [];
    const queries = ['sicariato Peru 2024', 'ducen ancash crimen'];
    for (let i = 0; i < 5; i++) {
        const q = queries[i % queries.length];
        const r10 = await bs(V10, q);
        const r11 = await bs(V11, q);
        v10.push(r10.ms); v11.push(r11.ms);
        console.log(`  round ${i + 1} q='${q}': V10=${r10.ms.toFixed(0)}ms (n=${r10.count}) | V11=${r11.ms.toFixed(0)}ms (n=${r11.count})`);
        await new Promise((r) => setTimeout(r, 900));
    }
    const p50v10 = p(v10, 50), p95v10 = p(v10, 95);
    const p50v11 = p(v11, 50), p95v11 = p(v11, 95);
    console.log(`  V10 p50=${p50v10.toFixed(0)} p95=${p95v10.toFixed(0)}`);
    console.log(`  V11 p50=${p50v11.toFixed(0)} p95=${p95v11.toFixed(0)}`);
    const dp50 = ((p50v11 - p50v10) / p50v10 * 100).toFixed(1);
    const dp95 = ((p95v11 - p95v10) / p95v10 * 100).toFixed(1);
    console.log(`  Δp50=${dp50}%  Δp95=${dp95}%`);
}
main().catch((e) => { console.error(e); process.exit(1); });
