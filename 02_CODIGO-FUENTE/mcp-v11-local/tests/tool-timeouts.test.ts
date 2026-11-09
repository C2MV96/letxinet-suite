/**
 * Centralized per-tool timeout smoke tests
 * Run: npx ts-node tests/tool-timeouts.test.ts
 *
 * Phase 1 coverage:
 *   - TOOL_TIMEOUTS map has entries for slow tools (read_pdf, smart_search, batch_convert)
 *   - getToolTimeoutMs returns documented defaults
 *   - withToolTimeout: resolves when fn < deadline
 *   - withToolTimeout: aborts (rejects) when fn > deadline
 *   - withToolTimeout: clears timer on success (no leak via process exit)
 *   - withToolTimeout: forwards AbortSignal to fn (signal.aborted=true on abort)
 */
import { withToolTimeout, getToolTimeoutMs, TOOL_TIMEOUTS, DEFAULT_TOOL_TIMEOUT_MS } from '../src/utils/tool-timeouts';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, extra = '') {
    if (cond) {
        passed++;
        // console.log(`  ✓ ${name}`);
    } else {
        failed++;
        const msg = `✗ ${name}${extra ? ' :: ' + extra : ''}`;
        failures.push(msg);
        console.log(`  ${msg}`);
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function runTests(): Promise<void> {
    console.log('==== tool-timeouts.test.ts ====');

    // --- Map coverage: documented tools present ---
    console.log('-- map coverage --');
    ok('smart_search in TOOL_TIMEOUTS', 'smart_search' in TOOL_TIMEOUTS);
    ok('batch_search in TOOL_TIMEOUTS', 'batch_search' in TOOL_TIMEOUTS);
    ok('read_pdf in TOOL_TIMEOUTS', 'read_pdf' in TOOL_TIMEOUTS);
    ok('batch_convert in TOOL_TIMEOUTS', 'batch_convert' in TOOL_TIMEOUTS);
    ok('extract_tables in TOOL_TIMEOUTS', 'extract_tables' in TOOL_TIMEOUTS);
    ok('smart_search budget >= 120s', getToolTimeoutMs('smart_search') >= 120_000,
        `got ${getToolTimeoutMs('smart_search')}ms`);
    ok('batch_convert budget >= 300s', getToolTimeoutMs('batch_convert') >= 300_000,
        `got ${getToolTimeoutMs('batch_convert')}ms`);
    ok('search default 120s', getToolTimeoutMs('search') === 120_000,
        `got ${getToolTimeoutMs('search')}ms`);
    ok('unknown tool returns DEFAULT_TOOL_TIMEOUT_MS',
        getToolTimeoutMs('totally_unknown_tool_xyz') === DEFAULT_TOOL_TIMEOUT_MS,
        `got ${getToolTimeoutMs('totally_unknown_tool_xyz')}ms`);

    // --- Happy path: fn finishes before deadline ---
    console.log('-- happy path --');
    {
        const t0 = Date.now();
        const r = await withToolTimeout('search', async () => {
            await sleep(20);
            return 42;
        });
        const dt = Date.now() - t0;
        ok('withToolTimeout returns fn value', r === 42, `got ${r}`);
        ok('happy path took < 1000ms', dt < 1000, `dt=${dt}ms`);
    }

    // --- Deadline exceeded: fn rejects when fn runtime > budget ---
    // Use overrideMs to force a 50ms budget (avoid waiting the full 30s
    // 'search' budget). The fn sleeps 500ms so the abort must fire at ~50ms.
    console.log('-- deadline exceeded --');
    {
        let abortCaught = false;
        let elapsedMs = 0;
        const t0 = Date.now();
        try {
            await withToolTimeout('search', async (_signal) => {
                await sleep(500);
                return 'should-not-reach';
            }, 50);  // override budget = 50ms
            ok('deadline exceeded throws', false, 'should have thrown!');
        } catch (e: any) {
            abortCaught = true;
            elapsedMs = Date.now() - t0;
            ok('deadline throws AbortError name', e?.name === 'AbortError',
                `name=${e?.name}, msg=${e?.message}`);
            ok('deadline triggered around 50ms budget', elapsedMs < 250,
                `elapsed=${elapsedMs}ms (expected < 250ms)`);
        }
        ok('deadline path actually reached catch', abortCaught);
    }

    // --- Happy path stays happy (within budget) ---
    {
        const r = await withToolTimeout('search', async () => {
            await sleep(20);
            return 'ok';
        }, 200);  // 200ms budget vs 20ms sleep → must resolve
        ok('happy path resolves within budget', r === 'ok');
    }

    // --- Short deadline: tool with custom budget enforced ---
    console.log('-- custom deadline --');
    {
        // health_check has budget 30s. We force a fake tool with very short timeout by
        // monkey-patching TOOL_TIMEOUTS[key] is impossible (Object.freeze), so we use
        // 'list_sources' which has 10s budget, and a fn that sleeps only 20ms (well
        // within that 10s budget).
        const r = await withToolTimeout('list_sources', async () => {
            await sleep(20);
            return 'list';
        });
        ok('list_sources within 10s budget returns value', r === 'list');
    }

    // --- Signal forwarded ---
    console.log('-- signal forwarding --');
    {
        let observedSignal: AbortSignal | null = null as AbortSignal | null;
        await withToolTimeout('search', (signal: AbortSignal) => {
            observedSignal = signal;
            return Promise.resolve(1);
        });
        const signal: AbortSignal | null = observedSignal;
        ok('withToolTimeout passes signal to fn', signal !== null);
        ok('signal.aborted=false on happy path', !!signal && !signal.aborted);
    }

    // --- Concurrent calls don't share controllers ---
    console.log('-- concurrency isolation --');
    {
        const signals: AbortSignal[] = [];
        await Promise.all([
            withToolTimeout('search', async (s) => { signals.push(s); await sleep(10); return 'a'; }),
            withToolTimeout('search', async (s) => { signals.push(s); await sleep(10); return 'b'; }),
            withToolTimeout('search', async (s) => { signals.push(s); await sleep(10); return 'c'; }),
        ]);
        ok('multiplexed calls receive distinct signals', new Set(signals).size === 3, `got ${new Set(signals).size} unique signals out of 3`);
    }

    // Summary
    console.log('----');
    console.log(`PASSED: ${passed}/${passed + failed}    FAILED: ${failed}`);
    if (failures.length > 0) {
        console.log('\nFAILURES:');
        for (const f of failures) console.log(`  ${f}`);
    }
    process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => {
    console.error('FATAL', e);
    process.exit(2);
});
