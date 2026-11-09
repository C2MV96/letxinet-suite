/**
 * Client-aware adaptive timeout tests
 * Run: npx ts-node tests/client-detection.test.ts
 *
 * Phase 6 coverage:
 *   1. detectMcpClient identifies opencode from UA
 *   2. detectMcpClient identifies claude / claude-code variants
 *   3. detectMcpClient identifies cursor
 *   4. detectMcpClient identifies CLI tools (curl, python-requests, axios, node-fetch)
 *   5. detectMcpClient returns 'unknown' for empty/null/unknown UA
 *   6. CLIENT_CEILINGS_MS has all 6 entries
 *   7. deriveTimeouts produces 4 nested values with correct ratios (outer<ceiling, inner<outer, race<outer, try<race)
 *   8. deriveTimeouts caps outer at ceiling × 0.95 when base exceeds ceiling (batch_search under opencode)
 *   9. deriveBatchCaps returns shrinking caps for tight clients (opencode 8/3 vs cli 16/6)
 *  10. applyEnvUpperBound honors env when < auto, ignores when > auto or unset
 */
import { detectMcpClient, CLIENT_CEILINGS_MS, deriveTimeouts, deriveBatchCaps, applyEnvUpperBound, McpClient } from '../src/utils/client-detection';
import { TOOL_TIMEOUTS } from '../src/utils/tool-timeouts';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, extra = '') {
    if (cond) {
        passed++;
    } else {
        failed++;
        const msg = `✗ ${name}${extra ? ' :: ' + extra : ''}`;
        failures.push(msg);
        console.log(`  ${msg}`);
    }
}

async function runTests(): Promise<void> {
    console.log('==== client-detection.test.ts ====');

    // --- Test 1: opencode detection ---
    console.log('-- test 1: opencode detection --');
    ok('detects "opencode/0.5.0"', detectMcpClient('opencode/0.5.0 (Node.js)') === 'opencode');
    ok('detects "opencode/1.x"', detectMcpClient('opencode/1.2.3') === 'opencode');
    ok('detects "Opencode" (case insens.)', detectMcpClient('Opencode/0.9') === 'opencode');

    // --- Test 2: claude detection ---
    console.log('-- test 2: claude detection --');
    ok('detects "claude/1.0.0"', detectMcpClient('claude/1.0.0') === 'claude');
    ok('detects "claude-desktop/0.7"', detectMcpClient('claude-desktop/0.7') === 'claude');
    ok('detects "Anthropic-API/1.0"', detectMcpClient('Anthropic-API/1.0') === 'claude');
    ok('detects "claude-code/1.0.0"', detectMcpClient('claude-code/1.0.0') === 'claude-code');
    ok('detects "anthropic-cli/0.5"', detectMcpClient('anthropic-cli/0.5') === 'claude-code');
    // Precedence: claude-code BEFORE claude
    ok('claude-code wins over claude', detectMcpClient('claude-code-and-claude') === 'claude-code');

    // --- Test 3: cursor detection ---
    console.log('-- test 3: cursor detection --');
    ok('detects "cursor/0.42.0"', detectMcpClient('cursor/0.42.0') === 'cursor');
    ok('detects "Cursor IDE"', detectMcpClient('Cursor IDE 0.40') === 'cursor');

    // --- Test 4: CLI detection ---
    console.log('-- test 4: CLI detection --');
    ok('detects "curl/8.4.0"', detectMcpClient('curl/8.4.0') === 'cli');
    ok('detects "python-requests/2.31"', detectMcpClient('python-requests/2.31.0') === 'cli');
    ok('detects "node-fetch/3.3.2"', detectMcpClient('node-fetch/3.3.2') === 'cli');
    ok('detects "axios/1.6.2"', detectMcpClient('axios/1.6.2') === 'cli');
    ok('detects "got/14.0.0"', detectMcpClient('got/14.0.0') === 'cli');
    ok('detects "okhttp/4.12"', detectMcpClient('okhttp/4.12.0') === 'cli');
    ok('detects "Java/17.0.1"', detectMcpClient('Java/17.0.1') === 'cli');

    // --- Test 5: unknown detection ---
    console.log('-- test 5: unknown detection --');
    ok('returns unknown for undefined', detectMcpClient(undefined) === 'unknown');
    ok('returns unknown for null', detectMcpClient(null) === 'unknown');
    ok('returns unknown for empty', detectMcpClient('') === 'unknown');
    ok('returns unknown for unknown UA', detectMcpClient('Mozilla/5.0 (X11; Linux x86_64)') === 'unknown');

    // --- Test 6: CLIENT_CEILINGS_MS has all 6 entries ---
    console.log('-- test 6: CLIENT_CEILINGS_MS entries --');
    const expectedClients: McpClient[] = ['opencode', 'claude', 'claude-code', 'cursor', 'cli', 'unknown'];
    for (const c of expectedClients) {
        ok(`CLI_${c}_in_map`, c in CLIENT_CEILINGS_MS, `missing ${c}`);
    }
    ok('opencode ceiling = 120s', CLIENT_CEILINGS_MS.opencode === 120_000);
    ok('claude ceiling = 300s', CLIENT_CEILINGS_MS.claude === 300_000);
    ok('claude-code ceiling = 300s', CLIENT_CEILINGS_MS['claude-code'] === 300_000);
    ok('cursor ceiling = 180s', CLIENT_CEILINGS_MS.cursor === 180_000);
    ok('cli ceiling = 600s', CLIENT_CEILINGS_MS.cli === 600_000);
    ok('unknown ceiling = 240s', CLIENT_CEILINGS_MS.unknown === 240_000);

    // --- Test 7: deriveTimeouts produces nested values with correct ratios ---
    console.log('-- test 7: deriveTimeouts ratios --');
    const d = deriveTimeouts('opencode', TOOL_TIMEOUTS.search);
    ok('outer <= ceiling × 0.95', d.outerMs <= Math.floor(120_000 * 0.95), `outer=${d.outerMs}`);
    ok('inner < outer', d.innerMs < d.outerMs, `outer=${d.outerMs} inner=${d.innerMs}`);
    ok('race = outer × 0.50 (±1ms floor)', d.raceMs === Math.floor(d.outerMs * 0.50), `race=${d.raceMs} expected ${Math.floor(d.outerMs * 0.50)}`);
    ok('try = race × 0.67 (±1ms floor)', d.tryMs === Math.floor(d.raceMs * 0.67), `try=${d.tryMs} expected ${Math.floor(d.raceMs * 0.67)}`);
    ok('search under opencode: outer = 114s (capped at client ceiling)', d.outerMs === 114_000, `outer=${d.outerMs}`);

    // --- Test 8: deriveTimeouts caps outer at ceiling × 0.95 when base > ceiling ---
    console.log('-- test 8: deriveTimeouts caps outer when base > ceiling --');
    const batchUnderOpencode = deriveTimeouts('opencode', TOOL_TIMEOUTS.batch_search); // batch=240s, opencode ceiling=120s
    const expectedOuter = Math.floor(120_000 * 0.95);
    ok('batch_search outer capped at 114s under opencode', batchUnderOpencode.outerMs === expectedOuter, `outer=${batchUnderOpencode.outerMs} expected ${expectedOuter}`);
    const batchUnderClaude = deriveTimeouts('claude', TOOL_TIMEOUTS.batch_search); // 240s < 300s, no cap
    ok('batch_search under claude: outer = 240s (base < ceiling)', batchUnderClaude.outerMs === 240_000, `outer=${batchUnderClaude.outerMs}`);

    // --- Test 9: deriveBatchCaps shrinks for tight clients ---
    console.log('-- test 9: deriveBatchCaps per client --');
    const oc = deriveBatchCaps('opencode');
    const cl = deriveBatchCaps('cli');
    const cd = deriveBatchCaps('claude');
    const un = deriveBatchCaps('unknown');
    ok('opencode: 12 sources × 3 queries', oc.sourcesPerQuery === 12 && oc.maxQueries === 3, `src=${oc.sourcesPerQuery} q=${oc.maxQueries}`);
    ok('cli: 16 sources × 6 queries (full)', cl.sourcesPerQuery === 16 && cl.maxQueries === 6, `src=${cl.sourcesPerQuery} q=${cl.maxQueries}`);
    ok('claude: 16 sources × 6 queries (full)', cd.sourcesPerQuery === 16 && cd.maxQueries === 6, `src=${cd.sourcesPerQuery} q=${cd.maxQueries}`);
    ok('unknown defaults to 12/3', un.sourcesPerQuery === 12 && un.maxQueries === 3, `src=${un.sourcesPerQuery} q=${un.maxQueries}`);
    ok('opencode cap < cli cap', oc.sourcesPerQuery * oc.maxQueries < cl.sourcesPerQuery * cl.maxQueries);

    // --- Test 10: applyEnvUpperBound honors env when < auto, ignores otherwise ---
    console.log('-- test 10: applyEnvUpperBound --');
    process.env.TEST_TIMEOUT_OVERRIDE = '5000';
    ok('env < auto → returns env (5000)', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 5000);
    delete process.env.TEST_TIMEOUT_OVERRIDE;
    ok('env unset → returns auto (30000)', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 30000);
    process.env.TEST_TIMEOUT_OVERRIDE = '999999';
    ok('env > auto → returns auto (30000)', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 30000);
    delete process.env.TEST_TIMEOUT_OVERRIDE;
    process.env.TEST_TIMEOUT_OVERRIDE = 'invalid';
    ok('env invalid → returns auto', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 30000);
    delete process.env.TEST_TIMEOUT_OVERRIDE;
    process.env.TEST_TIMEOUT_OVERRIDE = '0';
    ok('env = 0 → returns auto (not 0)', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 30000);
    delete process.env.TEST_TIMEOUT_OVERRIDE;
    process.env.TEST_TIMEOUT_OVERRIDE = '-5';
    ok('env negative → returns auto', applyEnvUpperBound(30000, 'TEST_TIMEOUT_OVERRIDE') === 30000);
    delete process.env.TEST_TIMEOUT_OVERRIDE;

    // --- Summary ---
    console.log(`\n==== Results: ${passed} passed, ${failed} failed ====`);
    if (failed > 0) {
        console.log('Failures:');
        failures.forEach(f => console.log(`  ${f}`));
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner crashed:', err);
    process.exit(1);
});
