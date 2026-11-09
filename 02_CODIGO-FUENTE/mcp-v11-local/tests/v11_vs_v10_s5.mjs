/**
 * S5: Quick comparative V10 vs V11 — search [crossref, openalex], fastMode=true
 *     5 rounds alternating, identical query (cache benefit visible).
 */
const V10 = 'http://127.0.0.1:4000';
const V11 = 'http://127.0.0.1:4002';
const ROUNDS = 5;

async function bs(base, q) {
    const t0 = process.hrtime.bigint();
    const r = await fetch(base + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sources: ['crossref', 'openalex'], maxResults: 20, fastMode: true }),
    });
    const j = await r.json().catch(() => null);
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, count: j?.data?.sources?.length || 0 };
}

function p(arr, pct) {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * pct / 100) - 1)];
}

async function main() {
    console.log(`\n=== S5: search crossref+openalex, fastMode=true, ${ROUNDS} rounds identical query ===`);
    console.log('>>> warmup 1 c/u');
    await bs(V10, 'sicariato Peru 2024');
    await bs(V11, 'sicariato Peru 2024');

    const v10 = [], v11 = [];
    for (let i = 0; i < ROUNDS; i++) {
        const r10 = await bs(V10, 'sicariato Peru 2024');
        const r11 = await bs(V11, 'sicariato Peru 2024');
        v10.push(r10.ms); v11.push(r11.ms);
        console.log(`  round ${i + 1}: V10=${r10.ms.toFixed(0)}ms | V11=${r11.ms.toFixed(0)}ms`);
        await new Promise((r) => setTimeout(r, 500));
    }
    const p50v10 = p(v10, 50), p95v10 = p(v10, 95);
    const p50v11 = p(v11, 50), p95v11 = p(v11, 95);
    console.log(`  V10 p50=${p50v10.toFixed(0)} p95=${p95v10.toFixed(0)}`);
    console.log(`  V11 p50=${p50v11.toFixed(0)} p95=${p95v11.toFixed(0)}`);
    console.log(`  Δp50=${((p50v11 - p50v10) / p50v10 * 100).toFixed(1)}%  Δp95=${((p95v11 - p95v10) / p95v10 * 100).toFixed(1)}%`);
}
main().catch((e) => { console.error(e); process.exit(1); });
