/**
 * S6: Extended V11 vs V10 — 25 rounds, 2 scenarios
 *   A) search crossref+openalex, fastMode=true (test Mejora 1 + 6)
 *   B) search crossref ONLY, fastMode=false (test Mejora 1 alone)
 * Identical query repeated to maximize cache hits on V11.
 */
const V10 = 'http://127.0.0.1:4000';
const V11 = 'http://127.0.0.1:4002';
const ROUNDS = 25;
const QUERY = 'sicariato Peru 2024';

async function bs(base, q, sources, fastMode) {
    const t0 = process.hrtime.bigint();
    try {
        const r = await fetch(base + '/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q, sources, maxResults: 20, fastMode }),
        });
        await r.json().catch(() => null);
        return Number(process.hrtime.bigint() - t0) / 1e6;
    } catch (e) {
        return Number(process.hrtime.bigint() - t0) / 1e6;
    }
}

function p(arr, pct) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * pct / 100) - 1)];
}

function median(arr) { return p(arr, 50); }
function stdev(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

async function runScenario(name, sources, fastMode, rounds = ROUNDS) {
    console.log(`\n>>> ${name} — ${rounds} rounds same query='${QUERY}', fastMode=${fastMode}`);
    console.log('    warmup 5 c/u (fill cache + sockets)');
    for (let i = 0; i < 5; i++) {
        await bs(V10, QUERY, sources, fastMode);
        await bs(V11, QUERY, sources, fastMode);
    }
    const v10 = [], v11 = [];
    for (let i = 0; i < rounds; i++) {
        // Alternate order to reduce upstream drift bias
        const order = i % 2 === 0;
        const a = await bs(order ? V10 : V11, QUERY, sources, fastMode);
        const b = await bs(order ? V11 : V10, QUERY, sources, fastMode);
        const t10 = order ? a : b;
        const t11 = order ? b : a;
        v10.push(t10); v11.push(t11);
        if (i % 5 === 0) console.log(`  round ${i + 1}/${rounds}: V10=${t10.toFixed(0)}ms V11=${t11.toFixed(0)}ms`);
        await new Promise((r) => setTimeout(r, 300));
    }
    const p50v10 = median(v10), p50v11 = median(v11);
    const p95v10 = p(v10, 95), p95v11 = p(v11, 95);
    const meanV10 = v10.reduce((a, b) => a + b, 0) / v10.length;
    const meanV11 = v11.reduce((a, b) => a + b, 0) / v11.length;
    console.log(`    V10: mean=${meanV10.toFixed(0)}ms p50=${p50v10.toFixed(0)}ms p95=${p95v10.toFixed(0)}ms stdev=${stdev(v10).toFixed(0)}ms`);
    console.log(`    V11: mean=${meanV11.toFixed(0)}ms p50=${p50v11.toFixed(0)}ms p95=${p95v11.toFixed(0)}ms stdev=${stdev(v11).toFixed(0)}ms`);
    const dmean = ((meanV11 - meanV10) / meanV10 * 100).toFixed(1);
    const dp50 = ((p50v11 - p50v10) / p50v10 * 100).toFixed(1);
    const dp95 = ((p95v11 - p95v10) / p95v10 * 100).toFixed(1);
    console.log(`    Δ: mean=${dmean}% p50=${dp50}% p95=${dp95}%`);
    return { name, rounds, v10mean: meanV10, v11mean: meanV11, v10p50: p50v10, v11p50: p50v11, v10p95: p95v10, v11p95: p95v11, dmean, dp50, dp95 };
}

async function main() {
    console.log(`\n=== S6: Extended V10 vs V11 — ${ROUNDS} rounds === ${new Date().toISOString()} ===`);
    console.log(`V10 ${V10} | V11 ${V11}\n`);

    // Health probe
    for (const [n, u] of [['V10', V10], ['V11', V11]]) {
        try { const r = await fetch(u + '/health'); console.log(`[setup] ${n} ${(await r.json()).version}`); }
        catch (e) { console.error(`${n} DOWN ${e.message}`); process.exit(1); }
    }

    const r1 = await runScenario(
        'A) search [crossref, openalex] fastMode=true',
        ['crossref', 'openalex'], true
    );
    const r2 = await runScenario(
        'B) search [crossref] fastMode=false',
        ['crossref'], false
    );

    console.log('\n=== Summary ===');
    console.log('Scenario                                | V10 mean | V11 mean | V10 p50 | V11 p50 | V10 p95 | V11 p95 | Δmean | Δp50 | Δp95');
    console.log('----------------------------------------|----------|----------|---------|---------|---------|---------|-------|-----|-----');
    for (const r of [r1, r2]) {
        console.log(
            r.name.substring(0, 39).padEnd(40) + '|' +
            r.v10mean.toFixed(0).padStart(7) + 'ms |' +
            r.v11mean.toFixed(0).padStart(7) + 'ms |' +
            r.v10p50.toFixed(0).padStart(6) + 'ms |' +
            r.v11p50.toFixed(0).padStart(6) + 'ms |' +
            r.v10p95.toFixed(0).padStart(6) + 'ms |' +
            r.v11p95.toFixed(0).padStart(6) + 'ms |' +
            (r.dmean + '%').padStart(5) + ' |' +
            (r.dp50 + '%').padStart(4) + ' |' +
            (r.dp95 + '%').padStart(5)
        );
    }
}
main().catch((e) => { console.error(e); process.exit(1); });
