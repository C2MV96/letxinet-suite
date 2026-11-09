/**
 * V10 vs V11 comparative benchmark — measures p50/p95 latency for batch_search.
 *
 * Run after both servers are up:
 *   V10 on http://127.0.0.1:4000
 *   V11 on http://127.0.0.1:4002
 *
 * Usage: node tests/v11_vs_v10_bench.mjs
 */

const V10 = 'http://127.0.0.1:4000';
const V11 = 'http://127.0.0.1:4002';
const ROUNDS = 3;

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const idx = Math.min(s.length - 1, Math.ceil(s.length * p / 100) - 1);
    return s[idx];
}

async function timeSearch(baseUrl, body) {
    const t0 = process.hrtime.bigint();
    try {
        const r = await fetch(baseUrl + '/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const t1 = process.hrtime.bigint();
        const ms = Number(t1 - t0) / 1e6;
        const j = await r.json().catch(() => null);
        const count = j?.data?.sources?.length || j?.data?.length || (Array.isArray(j?.data) ? j.data.length : 0);
        return { ms, status: r.status, count };
    } catch (e) {
        const t1 = process.hrtime.bigint();
        return { ms: Number(t1 - t0) / 1e6, status: 0, count: 0, error: e.message };
    }
}

async function timeBatchSearch(baseUrl, body) {
    const rpcBody = {
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'batch_search', arguments: body },
    };
    const t0 = process.hrtime.bigint();
    try {
        const r = await fetch(baseUrl + '/api/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'opencode-bench/0.1' },
            body: JSON.stringify(rpcBody),
        });
        const t1 = process.hrtime.bigint();
        const ms = Number(t1 - t0) / 1e6;
        const j = await r.json().catch(() => null);
        let count = 0;
        // extract from MCP response (isContent array → text)
        if (j?.result?.content?.[0]?.text) {
            try {
                const txt = j.result.content[0].text;
                const parsed = JSON.parse(txt);
                count = parsed?.data?.total || parsed?.total || 0;
            } catch { count = 0; }
        }
        return { ms, status: r.status, count };
    } catch (e) {
        const t1 = process.hrtime.bigint();
        return { ms: Number(t1 - t0) / 1e6, status: 0, count: 0, error: e.message };
    }
}

async function warmup(baseUrl, n=2) {
    for (let i = 0; i < n; i++) {
        await timeSearch(baseUrl, { query: 'sicariato Peru', sources: ['crossref'], maxResults: 5, fastMode: true });
    }
}

async function runBenchmark() {
    console.log('\n=== V11 vs V10 Benchmark — ' + new Date().toISOString() + ' ===');
    console.log(`V10: ${V10}\nV11: ${V11}\nRounds: ${ROUNDS}\n`);

    // Probe health
    for (const [name, url] of [['V10', V10], ['V11', V11]]) {
        try {
            const r = await fetch(url + '/health');
            const v = (await r.json()).version;
            console.log(`[setup] ${name} health: ${r.status} version=${v}`);
        } catch (e) {
            console.log(`[setup] ${name} not reachable: ${e.message}`);
            process.exit(1);
        }
    }

    console.log('\n--- Warmup (2 calls each) ---');
    await warmup(V10);
    await warmup(V11);
    console.log('Warmup done\n');

    const scenarios = [
        {
            name: 'S1: search 1q × crossref, fastMode=true',
            run: (base) => timeSearch(base, { query: 'sicariato Peru 2024', sources: ['crossref'], maxResults: 10, fastMode: true }),
        },
        {
            name: 'S2: search 1q × crossref+openalex, fastMode=true',
            run: (base) => timeSearch(base, { query: 'homicidio doloso', sources: ['crossref', 'openalex'], maxResults: 15, fastMode: true }),
        },
        {
            name: 'S3: batch_search 2q × [latam,global], fastMode',
            run: (base) => timeBatchSearch(base, { queries: ['sicariato', 'extorsion'], sources: ['latam', 'global'], maxResults: 20, fastMode: true }),
        },
    ];

    const results = [];
    for (const s of scenarios) {
        console.log(`\n>>> ${s.name}`);
        const v10times = [];
        const v11times = [];
        for (let i = 0; i < ROUNDS; i++) {
            // Alternate order to smooth out upstream warmup effects
            const r10 = await s.run(V10);
            const r11 = await s.run(V11);
            v10times.push(r10.ms);
            v11times.push(r11.ms);
            console.log(`  round ${i + 1}: V10=${r10.ms.toFixed(0)}ms (n=${r10.count}) | V11=${r11.ms.toFixed(0)}ms (n=${r11.count})`);
            await new Promise((r) => setTimeout(r, 1500)); // small cooldown
        }
        const v10p50 = percentile(v10times, 50);
        const v10p95 = percentile(v10times, 95);
        const v11p50 = percentile(v11times, 50);
        const v11p95 = percentile(v11times, 95);
        const deltaP50 = ((v11p50 - v10p50) / v10p50 * 100).toFixed(1);
        const deltaP95 = ((v11p95 - v10p95) / v10p95 * 100).toFixed(1);
        console.log(`    V10 p50=${v10p50.toFixed(0)}ms p95=${v10p95.toFixed(0)}ms`);
        console.log(`    V11 p50=${v11p50.toFixed(0)}ms p95=${v11p95.toFixed(0)}ms`);
        console.log(`    Δp50=${deltaP50}%  Δp95=${deltaP95}%`);
        results.push({ s: s.name, v10p50, v10p95, v11p50, v11p95, deltaP50, deltaP95 });
    }

    console.log('\n=== Final summary ===');
    console.log('Scenario                                    | V10 p50  | V10 p95  | V11 p50  | V11 p95  | Δp50   | Δp95');
    console.log('--------------------------------------------|----------|----------|----------|----------|--------|------');
    for (const r of results) {
        const line = r.s.padEnd(44) + '|' +
            r.v10p50.toFixed(0).padStart(9) + 'ms|' +
            r.v10p95.toFixed(0).padStart(9) + 'ms|' +
            r.v11p50.toFixed(0).padStart(9) + 'ms|' +
            r.v11p95.toFixed(0).padStart(9) + 'ms|' +
            (r.deltaP50 + '%').padStart(7) + '|' +
            (r.deltaP95 + '%').padStart(6);
        console.log(line);
    }
}

runBenchmark().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
