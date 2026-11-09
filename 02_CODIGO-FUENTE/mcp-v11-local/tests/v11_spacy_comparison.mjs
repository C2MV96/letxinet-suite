/**
 * V11 spaCy vs no-spaCy comparative
 *
 * Run modes:
 *   PHASE=A  → run with spaCy sidecar (assumed UP, you guarantee it)
 *   PHASE=B  → run without spaCy (you must stop the sidecar first)
 *
 * 4 scenarios × 25 rounds. Captures: ms (mean/p50/p95/stdev), count, top-5 avg relevance.
 * Outputs JSON to D:/OTROS/LETXIPU-SEARCH-MCP-V11/results_spacy_<PHASE>.json
 * Also prints summary table to stdout.
 *
 * Usage:
 *   PHASE=A node tests/v11_spacy_comparison.mjs
 *   PHASE=B node tests/v11_spacy_comparison.mjs
 */

const phase = process.env.PHASE || 'A';
const BASE = process.env.V11_BASE || 'http://127.0.0.1:4002';
const ROUNDS = parseInt(process.env.ROUNDS || '25', 10);

async function post(path, body) {
    const t0 = process.hrtime.bigint();
    try {
        const r = await fetch(BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'opencode-bench/0.1' },
            body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => null);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        let count = 0;
        let top5ScoreSum = 0;
        let top5Count = 0;
        const sources = j?.data?.sources || (Array.isArray(j?.data) ? j.data : []);
        count = sources.length;
        for (let i = 0; i < Math.min(5, sources.length); i++) {
            const sc = sources[i]?.relevanceScore ?? sources[i]?._relevance ?? null;
            if (typeof sc === 'number') { top5ScoreSum += sc; top5Count++; }
        }
        const top5Avg = top5Count > 0 ? top5ScoreSum / top5Count : null;
        return { ms, status: r.status, count, top5Avg };
    } catch (e) {
        return { ms: Number(process.hrtime.bigint() - t0) / 1e6, status: 0, count: 0, top5Avg: null, error: e.message };
    }
}

async function mcpBatch(body) {
    const rpcBody = {
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'batch_search', arguments: body },
    };
    const t0 = process.hrtime.bigint();
    try {
        const r = await fetch(BASE + '/api/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'opencode-bench/0.1' },
            body: JSON.stringify(rpcBody),
        });
        const j = await r.json().catch(() => null);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        let count = 0;
        let top5Sum = 0, top5n = 0;
        if (j?.result?.content?.[0]?.text) {
            try {
                const txt = j.result.content[0].text;
                const parsed = JSON.parse(txt);
                const arr = parsed?.data?.sources || parsed?.sources || [];
                count = arr.length;
                for (let i = 0; i < Math.min(5, arr.length); i++) {
                    const sc = arr[i]?.relevanceScore ?? arr[i]?._relevance ?? null;
                    if (typeof sc === 'number') { top5Sum += sc; top5n++; }
                }
            } catch {}
        }
        return { ms, status: r.status, count, top5Avg: top5n > 0 ? top5Sum / top5n : null };
    } catch (e) {
        return { ms: Number(process.hrtime.bigint() - t0) / 1e6, status: 0, count: 0, top5Avg: null, error: e.message };
    }
}

function p(arr, pct) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * pct / 100) - 1)];
}

function stdev(arr) {
    if (arr.length === 0) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

const scenarios = [
    {
        id: 'S1', name: 'search 1q crossref, fastMode=true',
        run: () => post('/api/search', { query: 'sicariato Peru 2024', sources: ['crossref'], maxResults: 20, fastMode: true }),
    },
    {
        id: 'S2', name: 'search 2 fuentes sin fastMode (fuerza spaCy)',
        run: () => post('/api/search', { query: 'homicidio doloso Ancash', sources: ['crossref', 'openalex'], maxResults: 20, fastMode: false }),
    },
    {
        id: 'S3', name: 'search LatAm (scielo+redalyc) sin fastMode',
        run: () => post('/api/search', { query: 'agricultura tradicional', sources: ['scielo', 'redalyc'], maxResults: 20, fastMode: false }),
    },
    {
        id: 'S4', name: 'batch_search 2q latam+global, fastMode',
        run: () => mcpBatch({ queries: ['sicariato', 'extorsion'], sources: ['latam', 'global'], maxResults: 20, fastMode: true }),
    },
];

async function warmupAll() {
    console.log('>>> warmup 3 c/scenario (fill caches)');
    for (const s of scenarios) {
        for (let i = 0; i < 3; i++) await s.run();
    }
}

async function runScenario(s) {
    console.log(`\n>>> ${s.id} ${s.name} — ${ROUNDS} rounds`);
    const msArr = [], countArr = [], top5Arr = [];
    for (let i = 0; i < ROUNDS; i++) {
        const r = await s.run();
        msArr.push(r.ms);
        if (r.count) countArr.push(r.count);
        if (r.top5Avg !== null) top5Arr.push(r.top5Avg);
        if (i % 5 === 0 || i === ROUNDS - 1) console.log(`  round ${i + 1}/${ROUNDS}: ${r.ms.toFixed(0)}ms count=${r.count} top5=${r.top5Avg !== null ? r.top5Avg.toFixed(2) : 'n/a'}${r.error ? ' ERR=' + r.error : ''}`);
        await new Promise((res) => setTimeout(res, 400));
    }
    const mean = msArr.reduce((a, b) => a + b, 0) / msArr.length;
    const countMean = countArr.length > 0 ? countArr.reduce((a, b) => a + b, 0) / countArr.length : 0;
    const top5Mean = top5Arr.length > 0 ? top5Arr.reduce((a, b) => a + b, 0) / top5Arr.length : null;
    return {
        id: s.id, name: s.name, rounds: ROUNDS,
        msMean: mean, msP50: p(msArr, 50), msP95: p(msArr, 95), msStdev: stdev(msArr),
        countMean, top5Avg: top5Mean, nTop5: top5Arr.length,
    };
}

async function main() {
    console.log(`\n=== V11 spaCy comparison — PHASE=${phase} ${new Date().toISOString()} ===`);
    console.log(`Target: ${BASE} | rounds: ${ROUNDS}\n`);
    // Health probe
    try {
        const r = await fetch(BASE + '/health');
        const v = (await r.json()).version;
        console.log(`[setup] V11 health OK version=${v}`);
    } catch (e) { console.error(`[setup] V11 unreachable: ${e.message}`); process.exit(1); }
    // spaCy probe
    try {
        const r = await fetch('http://127.0.0.1:4202/health');
        const j = await r.json();
        console.log(`[setup] spaCy sidecar: ${j.ready ? 'UP' : 'NOT READY'} (PHASE=${phase} expect: ${phase === 'A' ? 'UP' : 'DOWN'})`);
    } catch (e) {
        console.log(`[setup] spaCy sidecar: DOWN (${e.message})`);
    }

    await warmupAll();
    console.log('\n=== Bench start ===');
    const results = [];
    for (const s of scenarios) {
        const res = await runScenario(s);
        results.push(res);
    }
    console.log('\n=== Summary PHASE=' + phase + ' ===');
    console.log('Scenario                                                | rounds | mean   | p50    | p95    | stdev  | count  | top5   | nTop5');
    console.log('--------------------------------------------------------|--------|--------|--------|--------|--------|--------|--------|-----');
    for (const r of results) {
        console.log(
            r.name.substring(0, 55).padEnd(56) + '|' +
            String(r.rounds).padStart(7) + '|' +
            r.msMean.toFixed(0).padStart(7) + 'ms|' +
            r.msP50.toFixed(0).padStart(7) + 'ms|' +
            r.msP95.toFixed(0).padStart(7) + 'ms|' +
            r.msStdev.toFixed(0).padStart(7) + 'ms|' +
            r.countMean.toFixed(1).padStart(7) + '|' +
            (r.top5Avg !== null ? r.top5Avg.toFixed(2).padStart(7) : 'n/a'.padStart(7)) + '|' +
            String(r.nTop5).padStart(5)
        );
    }

    // Persist
    const fs = await import('fs');
    const outfile = `D:/OTROS/LETXIPU-SEARCH-MCP-V11/results_spacy_${phase}.json`;
    fs.writeFileSync(outfile, JSON.stringify({ phase, rounds: ROUNDS, timestamp: new Date().toISOString(), results }, null, 2));
    console.log(`\nSaved: ${outfile}`);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
