/**
 * Validation smoke tests — 30+ real input/output cases
 * Run: npx ts-node tests/validators.test.ts
 */
import { validateToolInput } from '../src/utils/validators';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(toolName: string, input: any, expectedOk: boolean, expectedMsg?: string) {
  const result = validateToolInput(toolName, input);
  const ok = result.ok === expectedOk;
  if (ok && !expectedMsg) {
    passed++;
    return;
  }
  if (ok && expectedMsg) {
    const errStr = 'error' in result ? result.error : '';
    if (errStr.includes(expectedMsg)) { passed++; return; }
  }
  failed++;
  const actual = result.ok ? 'OK' : `FAIL: ${'error' in result ? result.error : ''}`;
  const msg = `[${toolName}] input=${JSON.stringify(input).substring(0, 80)} → expected ${expectedOk ? 'OK' : 'FAIL'}${expectedMsg ? ` (${expectedMsg})` : ''} got ${actual}`;
  failures.push(msg);
  console.log(`  ❌ ${msg}`);
}

console.log('═══ batch_search ═══');

assert('batch_search', { queries: ["acido indolacetico bacterias"], maxResults: 30 }, true);
assert('batch_search', { query: "acido indolacetico bacterias" }, true);
assert('batch_search', { queries: ["a","b","c","d","e","f"], sources: ["latam"] }, true);
assert('batch_search', {}, false, 'Provide at least one');
assert('batch_search', { queries: [] }, false, 'cannot be empty');
assert('batch_search', { queries: ["a","b","c","d","e","f","g","h","i","j","k"] }, false, 'Max 10');
assert('batch_search', { queries: ["x"], maxResults: -5 }, false, 'must be >= 1');
assert('batch_search', { queries: ["x"], maxResults: 999999 }, false, 'cannot exceed 120');
assert('batch_search', { queries: ["x"], sources: "latam" }, true); // coerce
assert('batch_search', { queries: ["x"], yearStart: "abc" }, false, '4-digit year');
assert('batch_search', { queries: ["x"], yearStart: "2030", yearEnd: "2020" }, false, 'yearStart must be <= yearEnd');
assert('batch_search', { queries: ["x"], yearStart: "2020", yearEnd: "2024" }, true);

console.log('═══ search ═══');

assert('search', { query: "acido indolacetico bacterias", sources: ["latam"] }, true);
assert('search', { query: "tesis" }, true);
assert('search', { query: "" }, false, 'Query cannot be empty');
assert('search', { query: "   " }, false, 'Query cannot be empty');
assert('search', { query: "tesis", maxSources: 1000 }, false, 'cannot exceed 100');
assert('search', { query: "tesis", maxSources: 50 }, true);
assert('search', { query: 12345 }, false, 'expected string');
assert('search', { query: "tesis lima", location: "Lima" }, true); // valid, warning logged

console.log('═══ smart_search ═══');

assert('smart_search', { query: "acido indolacetico bacterias" }, true);
assert('smart_search', { query: "" }, false, 'Query cannot be empty');

console.log('═══ PDF tools ═══');

assert('read_pdf', { source: "https://arxiv.org/pdf/2301.00001.pdf" }, true);
assert('read_pdf', { source: "" }, false, 'source is required');
assert('read_pdf', { source: "tesis bacteria" }, false, 'source must be a URL');
assert('read_pdf', { source: "" }, false, 'source is required');
assert('read_pdf', { source: "https://x.pdf", maxChars: -1 }, true); // -1 = no limit
assert('read_pdf', { source: "https://x.pdf", format: "xml" }, false);
assert('read_pdf', { source: "https://x.pdf", format: "markdown" }, true);
assert('read_pdf', { source: "https://x.pdf", format: "text" }, true);
assert('read_pdf', {}, false, 'source is required');
assert('pdf_metadata', { source: "https://x.pdf" }, true);
assert('pdf_sections', { source: "https://x.pdf" }, true);
assert('pdf_citations', { source: "https://x.pdf" }, true);
assert('analyze_academic', { source: "https://x.pdf" }, true);
assert('extract_section', { source: "https://x.pdf", section: "metodología" }, true);
assert('extract_section', { source: "https://x.pdf" }, false, 'section');
assert('read_pdf_markdown', { source: "https://x.pdf" }, true);
assert('pdf_smart_summary', { source: "https://x.pdf", maxTotalChars: 8000 }, true);
assert('convert_document', { source: "https://x.pdf" }, true);
assert('extract_tables', { source: "https://x.pdf", format: "html" }, true);
assert('extract_tables', { source: "https://x.pdf", format: "markdown" }, true);
assert('extract_formulas', { source: "https://x.pdf" }, true);

console.log('═══ batch_convert ═══');

assert('batch_convert', { sources: ["https://arxiv.org/pdf/2301.00001.pdf"] }, true);
assert('batch_convert', { sources: Array(10).fill("https://x.pdf") }, true);
assert('batch_convert', { sources: Array(11).fill("https://x.pdf") }, false, 'Max 10');
assert('batch_convert', { sources: [] }, false, 'At least 1');
assert('batch_convert', { sources: "not_an_array" }, false);

console.log('═══ metadata tools ═══');

assert('enrich_metadata', { papers: [{ title: "x", doi: "10.xxx/y" }] }, true);
assert('enrich_metadata', { papers: [] }, false, 'At least 1');
assert('enrich_metadata', { papers: "not_array" }, false);
assert('fetch_metadata', { doi: "10.1038/s41586-020-2649-2" }, true);
assert('fetch_metadata', { title: "paper title" }, true);
assert('fetch_metadata', { url: "https://..." }, true);
assert('fetch_metadata', {}, false, 'Provide at least one');
assert('fetch_metadata', { doi: "not-a-doi" }, false, 'Invalid DOI');
assert('recover_metadata', { doi: "10.1038/s41586-020-2649-2" }, true);
assert('recover_metadata', {}, false, 'Provide at least one');

console.log('═══ resolve_pdf / download_pdf ═══');

assert('resolve_pdf', { identifier: "10.1038/s41586-020-2649-2" }, true);
assert('resolve_pdf', { identifier: "https://hdl.handle.net/1234/5678" }, true);
assert('resolve_pdf', { identifier: "" }, false, 'identifier');
assert('resolve_pdf', {}, false, 'identifier');
assert('download_pdf', { doi: "10.1038/s41586-020-2649-2" }, true);
assert('download_pdf', { url: "https://..." }, true);
assert('download_pdf', {}, false, 'Provide at least one');

console.log('═══ specialized search ═══');

assert('search_dblp', { query: "machine learning" }, true);
assert('search_dblp', { query: "" }, false, 'Query cannot be empty');
assert('search_paperswithcode', { query: "transformer attention" }, true);
assert('search_conferences', { query: "neurips 2024" }, true);
assert('trending_papers', { query: "diffusion" }, true);
assert('trending_papers', {}, true); // query optional

console.log('═══ smart_search includeThesisVariants ═══');

// Test 1: Default behavior (includeThesisVariants undefined → true)
assert('smart_search', { query: 'biotecnología ica' }, true);

// Test 2: Explicit true
assert('smart_search', { query: 'biotecnología ica', includeThesisVariants: true }, true);

// Test 3: Explicit false
assert('smart_search', { query: 'biotecnología ica', includeThesisVariants: false }, true);

// Test 4: Invalid type (should fail validation)
assert('smart_search', { query: 'test', includeThesisVariants: 'invalid' }, false);

// Test 5: With other parameters
assert('smart_search', { query: 'bacterias lima', includeThesisVariants: true, sources: ['latam'] }, true);

console.log('═══ empty-arg tools ═══');

assert('health_check', {}, true);
assert('list_sources', {}, true);
assert('help', {}, true);
assert('help', { topic: "search" }, true);
assert('coverage_report', { use_cache: true }, true);

console.log('═════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ❌ ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
}
