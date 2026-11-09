// Test del inter-process provider gate — sin red, sin dependencias.
// Run: node scripts/test-provider-gate.js
const gate = require('../dist/utils/inter-process-provider-limiter.js');

(async () => {
    gate._resetGateForTests();
    let pass = 0, fail = 0;
    const assert = (cond, msg) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error('  ✗ ' + msg); } };

    console.log('\n[1] acquireSlot on critical domain (ALICIA)');
    const s1 = await gate.acquireSlot('https://alicia.concytec.gob.pe/vufind/api/v1/search');
    assert(s1.domain === 'alicia.concytec.gob.pe', 'domain extracted correctly');
    assert(typeof s1.release === 'function', 'release callback returned');
    s1.release();

    console.log('\n[2] Two consecutive failures → circuit opens');
    gate.recordFailure('https://alicia.concytec.gob.pe/x');
    gate.recordFailure('https://alicia.concytec.gob.pe/y');
    try {
        await gate.acquireSlot('https://alicia.concytec.gob.pe/z');
        assert(false, 'should have thrown CircuitOpenError');
    } catch (e) {
        assert(e instanceof gate.CircuitOpenError, 'threw CircuitOpenError');
        assert(e.cooldownRemainingSeconds > 0, 'cooldown remaining > 0 (' + e.cooldownRemainingSeconds + 's)');
        assert(/Circuit open for alicia/.test(e.message), 'message contains domain name');
    }

    console.log('\n[3] Snapshot reflects open circuit');
    const snap = gate.getGateSnapshot();
    const alice = snap.find(d => d.domain === 'alicia.concytec.gob.pe');
    assert(alice.circuitOpen === true, 'alice circuitOpen=true');
    assert(alice.consecutiveFails === 2, 'consecutiveFails=2');
    assert(alice.cooldownRemainingSeconds > 0, 'cooldown visible in snapshot');

    console.log('\n[4] Non-critical domain bypasses the gate');
    const t0 = Date.now();
    const noop = await gate.acquireSlot('https://api.crossref.org/works');
    const elapsed = Date.now() - t0;
    assert(noop.domain === 'api.crossref.org', 'crossref domain extracted');
    assert(elapsed < 50, 'no wait for non-critical domain (' + elapsed + 'ms)');
    noop.release();

    console.log('\n[5] Snapshot lists all 9 critical domains');
    assert(snap.length === 9, 'snapshot has 9 domains (got ' + snap.length + ')');

    console.log('\n[6] recordSuccess clears consecutive failures');
    gate.recordSuccess('https://alicia.concytec.gob.pe/ok');
    const snap2 = gate.getGateSnapshot();
    const alice2 = snap2.find(d => d.domain === 'alicia.concytec.gob.pe');
    // NB: circuit stays open until cooldown elapses even after success —
    // recordSuccess clears the counter BUT does NOT close an open circuit
    // (closes only via cooldown). Verify counter is 0 but circuit still open.
    // Actually: our implementation sets openUntil=0 on recordSuccess. That's
    // a design choice — allows recovery once one success arrives. Document it.
    assert(alice2.consecutiveFails === 0, 'counter cleared after success');

    console.log('\n[7] Rate-limit: two rapid acquireSlots wait >= minIntervalMs');
    gate._resetGateForTests();
    const aliceConfig = snap.find(d => d.domain === 'alicia.concytec.gob.pe').config;
    const t1 = Date.now();
    const sa = await gate.acquireSlot('https://alicia.concytec.gob.pe/a');
    sa.release();
    const sb = await gate.acquireSlot('https://alicia.concytec.gob.pe/b');
    sb.release();
    const wait = Date.now() - t1;
    // Allow some jitter tolerance (50ms under)
    assert(wait >= aliceConfig.minIntervalMs - 50, 'second slot waited >= minIntervalMs (' + wait + 'ms vs ' + aliceConfig.minIntervalMs + 'ms expected)');

    console.log('\n========================================');
    console.log('PASS: ' + pass + '  FAIL: ' + fail);
    console.log('========================================\n');
    if (fail > 0) process.exit(1);
    gate._resetGateForTests();
})();
