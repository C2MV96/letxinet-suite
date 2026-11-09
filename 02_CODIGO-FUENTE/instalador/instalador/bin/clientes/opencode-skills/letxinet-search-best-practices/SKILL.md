---
name: letxinet-search-best-practices
description: >
  Use when invoking any letxinet-gateway academic search tool (search, batch_search,
  smart_search, recover_metadata) from opencode via the bridge MCP. Encodes which
  LatAm/global sources are OPERATIVE vs TIMEOUT-DEAD after the 2026-08-07 full-pool
  re-test (39 sources tested, 9 revividas, 1 dead=alicia). Tells the model to call
  individual sources, never groups, always with fastMode:true. Trigger keywords:
  search, batch_search, smart_search, recover_metadata, tesis, alicia, renati,
  lareferencia, sources, latam, iberoamerica, searchAuto, searchTools,
  letxinet-gateway, mcp-bridge.
---

# LetXinet Gateway Search — Best Practices (opencode)

## TL;DR

When the user asks for academic search via the `letxinet-gateway` MCP server, ALWAYS:

1. Call `search` with `sources: ["<individual_source>"]` — NEVER use group sources like `latam`, `tesis`, `iberoamerica`, `all`, `peru` (except `peru` as a quick fallback for Peruvian theses).
2. Set `fastMode: true` always.
3. Set `maxSources: 5` (low — keeps individual queries fast).
4. Run source calls in PARALLEL (batch 5-8 sources in one message) when the user wants broad coverage.
5. Skip the dead sources below — they cost 90s Provider timeout each and return 0 results.

## Operative sources (call these)

### LatAm — return real results (re-tested 2026-08-07 on query "bacterial cellulose mango Komagataeibacter")

| source | country | typical results | latency | notes |
|--------|---------|-----------------|---------|-------|
| `renati` | Peru (SUNEDU) | 1-8 | 30s | Best for Peruvian theses. PUCP, UNSA, UNALM, MINEDU. Niche queries return few hits; broad queries return 8 |
| `scielo` | Brazil/LatAm | 8 | 1.3-6.6s | Journal articles. DOI 10.1590. Quality 60-82 |
| `bdtd` | Brazil | 21-49 | 1.6-33s | Brazilian theses. UNICAMP, UNB, UFRRJ, UFTM. Slow on niche queries but real matches |
| `oasisbr` | Brazil (Ibict) | 22-27 | 30s (RE-ESTABILIZED 2026-08-07) | UNICAMP, Fiocruz, UNB, UFBA, UFRJ. Routes via La Referencia (OpenAlex). Functional 30s latency (was 100s timeout). Real BC + food packaging results |
| `rraae` | Ecuador | 8-49 | 0.8-5.2s (RE-ESTABILIZED 2026-08-07) | OpenAlex-tagged. **Top for biotech**: canonical 2019 García-Sánchez BC+mango paper, 2025 Navarro-Zabarburú apatite. QualityScore 90, relevanceScore 44 |
| `minciencias` | Colombia | 0-22 | 0.5-2.3s | Colciencias research reports. Returns 0 on CB/biotech queries (solemn on social science). |
| `redalyc` | LatAm | 0 | 0.15-0.7s | Works but rarely matches niche biotech queries. Empty is OK |
| `lareferencia` | LatAm central node | 49 | 4.4-5.4s | ✅ REVIVED 2026-08-06. Covers Argentina/Chile/Colombia/Peru nodes aggregated |
| `laref_ecuador` | Ecuador node | 30 | 3.0-4.8s | ✅ REVIVED 2026-08-06. Ecuador-specific node |
| `unam` | Mexico (UNAM) | 1-8 | 1.9s (REVIVED 2026-08-07) | ✅ Was DEAD in 2026-08-06 — OPERATIVE now |
| `anid` | Chile (ANID) | 13 | 2.2s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `snrd` | Dominican Republic | 12 | 8.5s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `espana` | Spain (Dialnet) | 30 | 2.4s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `costarica` | Costa Rica (KIMUK) | 30 | 3.6s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `uruguay` | Uruguay (Timbo) | 30 | 5.7s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `elsalvador` | El Salvador | 30 | 2.2s (REVIVED 2026-08-07) | ✅ Was DEAD — OPERATIVE now |
| `laref_peru` | Peru node (aggregated) | 30 | 1.2s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `laref_brasil` | Brazil node | 30 | 3.4s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `laref_mexico` | Mexico node | 30 | 2.5s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `laref_argentina` | Argentina node | 30 | 3.4s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `laref_colombia` | Colombia node | 30 | 5.6s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `laref_chile` | Chile node | 30 | 12.8s (REVIVED 2026-08-07) | ✅ Via OpenAlex aggregated |
| `conacyt` | Mexico/Paraguay | 0 | 0.45s | EMPTY on biotech (source functional). Re-test 2026-08-07 confirms source works |

### Global — return real results (re-tested 2026-08-07)

| source | scope | results | latency | notes |
|--------|-------|---------|---------|-------|
| `pubmed` | Health | 5-40 | ~1.5-2.3s | PubMed + PMC. Top performance. Works on bacterial cellulose, Komagataeibacter, mango byproducts. Returns PMC full-text papers |
| `crossref` | DOI | 5-8 | ~0.9-1.4s | DOIs across publishers. FASTER than previously documented |
| `doaj` | Open access | 1-8 | 0.7-25s | DOAJ journals. Variable latency but reliable |
| `zenodo` | CERN | 8 | 1.9-2.7s | Datasets, PUCP, ecOceánica, UNAP Peru. FASTER than previously documented (was 27s) |
| `openaire` | EU | 7 | 2.4-3.3s | EU open access. FASTER than previously documented (was 34s) |
| `arxiv` | Preprints | 8 | 1.6-1.8s | CS/Physics preprints. Real matches on AI/ML queries |
| `openalex` | OpenAlex direct API | 49 | 2.4-2.9s (REVIVED 2026-08-07) | ✅ Was DEAD in 2026-08-06 — OPERATIVE now. Fast, broad coverage. Same dataset as `laref_*` nodes |
| `semantic` | Semantic Scholar | 48 | 3.3s (REVIVED 2026-08-07) | ✅ Returns real results now. Similar coverage to openalex |
| `core` | CORE API | 3 | 2.6s (REVIVED 2026-08-07) | ✅ Was empty/dead in 2026-08-06 — OPERATIVE now. Returns matches on biotech queries |
| `scopus` | Elsevier Scopus | 8 | 1.5s (REVIVED 2026-08-07) | ✅ Now returns 8 results on biotech query |
| `serpapi` | Google Scholar via SerpApi | 8 | 1.18s (HIGHLIGHT 2026-08-07) | ⭐ **HIDDEN TREASURE**. Wraps Google Scholar — finds papers NOT in openalex/pubmed/scielo (2018 K.medellinensis, 2026 Polysaccharides). Include in biotech/agrarian queries |

### Generic CS/AI tools — return 0 on non-CS queries but work technically

Only useful when the user's query is CS/AI-domain (vision transformers, LLMs, NeurIPS, ICML, etc.):

- `dblp` (CS bibliography, 253ms — real matches on transformer queries)
- `paperswithcode` (papers with code, 1.6-4s)
- `huggingface` (trending papers, 1.6-7s — bug `Invalid sort parameter: trending` returns 0; works for diffusion/AI queries)
- `openreview` (ICLR/NeurIPS, 1.165s — confirmed functional 2026-08-07, returns 0 on biotech)
- `semanticscholar` (alias of `semantic`)

### NOT IMPLEMENTED in Suite (return empty stats, source IDs reserved but no mapping)

DO NOT call these — they silently return 0 with empty `stats:{}`:

- `dialnet`, `springer`, `ieee`, `tandfonline`, `wiley`, `sage`, `jstor`, `sciencedirect`, `nature`, `elsevier`, `peru_web_fallback`

## Other tools — known issues

- **`recover_metadata` is BROKEN**: hits its internal 240s deadline on every DOI tried (SciELO 10.1590/..., Zenodo 10.5281/zenodo.3237883, arXiv 10.48550/...). The OpenAlex→Crossref→Semantic Scholar→DSpace7→HTML→ALICIA chain exhausts the budget. DO NOT call this tool from opencode. Use `enrich_metadata` (if available) or work from DOI/title directly via `search`.
- **`pdf_metadata` works on public DOI/arxiv URLs (<2s)** but throws `Cannot read properties of null (reading 'message')` on `hdl.handle.net` URLs (institutional repositories). Prefer arXiv or DOI URLs.
- **`pdf_metadata` returns the PDF filename as title when publisher doesn't embed real title metadata** (e.g. SciELO returns "v52 sulp1.indb" instead of the actual paper title).

## DEAD sources — DO NOT CALL individually

These consistently return `success:true` with `error:"Provider timeout"` at ~90000ms. Calling them individually wastes 90s; calling them inside a group eventually hangs the bridge socket. NEVER include them in `sources: [...]`:

### LatAm dead (confirmed dead 2026-08-07 full pool)

- `alicia` — Peru (ALICIA) — HTTP timeout 90s CONFIRMED 2026-08-07 (batch 4). Only source still DEAD after re-test. Minedu infra down.

### REVIVED since 2026-08-06 — DO CALL (see Operative tables above)

The following sources were WRONGLY marked DEAD in the previous skill version (2026-08-06) but re-test 2026-08-07 confirms OPERATIVE. See tables above:

- `core`, `openalex`, `unam`, `anid`, `snrd`, `espana`, `costarica`, `uruguay`, `elsalvador`
- `semanticscholar`, `semantic` (now real results)
- `scopus` (now real results)
- `oasisbr`, `rraae` (RE-ESTABILIZED — was UNRELIABLE, now OPERATIVE 30s / 5s)
- `laref_peru`, `laref_brasil`, `laref_mexico`, `laref_argentina`, `laref_colombia`, `laref_chile` (revived, OpenAlex-aggregated)
- `conacyt` (source functional, returns 0 on biotech — EMPTY not DEAD)

## Group sources — AVOID

Group sources cascade multiple dead sources in parallel and eventually overwhelm the bridge v1.2.0 keepalive at ~10 min. Use only as last resort:

- `latam` — 18+ sources, mix of operative/dead. Socket hang up risk.
- `tesis` — 10 sources, mix. Works, but takes 9-10 min.
- `iberoamerica` — latam + espana. 3 min, works but wastes time.
- `all` — every source. Do NOT use.
- `peru` — renati + laref_peru. ACCEPTABLE fallback for Peruvian theses (120s).
- `peru_fast` — alicia + laref_peru.Both dead. Skip.
- `global` — semantic + openalex + pubmed + crossref + doaj + zenodo + openaire + core. WORKS in 105s, returns ~38 results. ACCEPTABLE for broad global coverage.

## Recommended call patterns

### For Peruvian theses (preferred)

```
letxinet-gateway_search(
  query="...",
  sources=["renati"],
  maxSources=5,
  fastMode=true
)
```

Latency: ~30s. Quality: very high for Peru topics.

### For LatAm-wide coverage (preferred — parallel batch — UPDATED 2026-08-07)

Call these 9 in parallel in one message (operative + revived + re-stabilized):

- `renati` (Peru theses — 30s)
- `scielo` (LatAm journals — 1.4s)
- `bdtd` (Brazil theses — 6s)
- `lareferencia` (LatAm central node — 5.4s, 49 results)
- `laref_ecuador` (Ecuador-specific node — 4.8s)
- `oasisbr` (Brazil re-stabilized — 30s, 22 results)
- `rraae` (Ecuador re-stabilized — 5.2s, **49 results, top relevance for biotech**)
- `minciencias` (Colombia — works but 0 on biotech)
- `unam` (Mexico UNAM — revived 2026-08-07, 1.9s)

Total wallclock ~30s (parallel), ~200+ results. NO timeouts.
For broader coverage add a second parallel batch:

- `anid` (Chile — 2.2s), `snrd` (Rep. Dominicana — 8.5s), `espana` (Dialnet — 2.4s), `costarica` (KIMUK — 3.6s), `uruguay` (Timbo — 5.7s), `elsalvador` (2.2s), `laref_peru` (1.2s), `laref_brasil` (3.4s), `laref_mexico` (2.5s), `laref_argentina` (3.4s)

### For PubMed-grade health/social research

```
sources=["pubmed"], fastMode=true
```

### For peer-reviewed global coverage (UPDATED 2026-08-07)

```
sources=["pubmed","crossref","doaj","zenodo","openaire","openalex","serpapi"]
```

- `openalex` revived 2026-08-07 (was DEAD, now 49 results in 2.4s)
- `serpapi` is a HIDDEN TREASURE — wraps Google Scholar, finds papers NOT in openalex/pubmed/scielo. Include in biotech/agrarian queries
- Or use group `global` (works, 105s, 38 results — but slower than individual calls)

### For broad "I don't know where to look" queries (UPDATED 2026-08-07)

Run in this order, in parallel batches of 5-8:

1. `renati`, `scielo`, `pubmed`, `crossref`, `doaj`, `zenodo`, `serpapi`, `openalex`
2. If still empty or for more LatAm: `bdtd`, `lareferencia`, `laref_ecuador`, `oasisbr`, `rraae`, `openaire`, `redalyc`, `minciencias`
3. If query is CS/AI: add `dblp`, `paperswithcode`, `huggingface`, `openreview`, `arxiv`
4. For specific country targeting: `unam` (MX), `anid` (CL), `espana` (ES), `costarica` (CR), `uruguay` (UY), `elsalvador` (SV), `snrd` (DO), `laref_peru` (PE), `laref_brasil` (BR), `laref_mexico` (MX), `laref_argentina` (AR), `laref_colombia` (CO), `laref_chile` (CL)

## REST fallback when MCP bridge is "Not connected" (2026-08-06)

If `letxinet-gateway_*` tools return `Not connected` from opencode (bridge subprocess died), the Suite backend at `http://127.0.0.1:43123` is **still working** and reachable via direct REST. Use this PowerShell pattern:

```powershell
$body = @{ tool = "search"; arguments = @{ query = "bacterial cellulose mango"; sources = @("pubmed"); maxSources = 5; fastMode = $true } } | ConvertTo-Json -Depth 5 -Compress
$r = Invoke-WebRequest -Uri "http://127.0.0.1:43123/api/mcp/call" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180 -UseBasicParsing
$obj = $r.Content | ConvertFrom-Json
# Access: $obj.response.results (array), $obj.response.totalUniqueResults, $obj.response.sourcesQueried, $obj.response.stats
```

**KEY**: the REST endpoint expects `{ tool, arguments: {...} }` (NOT `args`). The MCP bridge uses `arguments` internally — match it.
**Result structure**: `$obj.response.{status, strategy, toolUsed, query, sourcesQueried, totalUniqueResults, resultsBySource, results}`
**Status values**: `atomic_multisource_success` (each source queried individually), `group_search` (aggregate).

### Quick REST probe battery (2026-08-06 tested, takes ~3 min)

To re-test all 48 sources in parallel from PowerShell:

```powershell
# See: <extract_dir>/probe_sources.ps1
# Returns a sortable table: source / status / results / elapsed / error
# Re-confirms which are DEAD (100s HTTP timeout), EMPTY (fast, 0 results), or OK
```

## Bridge & opencode.json notes

- Bridge file: `D:\OTROS\LETXINET-DESKTOP-HF\mcp-bridge\mcp-bridge.cjs` (v1.2.0 with keepalive pinger)
- Suite backend: `http://127.0.0.1:43123` (LETXINET-DESKTOP-HF v1.5.8+)
- opencode.json `timeout: 3600000` (60 min) applies only to `tools/list` handshake, NOT `tools/call`. opencode waits indefinitely on `tools/call`.
- The bridge spawns a 30s keepalive ping to the Suite while `tools/call` is pending. This protects against Windows TCP killing the socket. Confirmed working on 2026-08-03.
- `searchAuto=true` in opencode is fine — the model will read this skill and choose operative sources.

## Why individual sources, not groups?

When you call `sources:["latam"]`, the Suite queries 18+ sources in parallel. 7 of them are dead (90s timeout each). The Suite holds the HTTP request open for all of them. After ~10 minutes, Windows TCP kills the keepalive on the bridge socket even with v1.2.0 pinger (because the pinger is also subject to TCP stack limits eventually). Result: `socket hang up` MCP error -32603.

When you call individual sources, each completes in 30s max (operative or timeout). The bridge pinger keeps the socket alive comfortably.

## Tool selection by query length (benchmarked 2026-08-03, 9 tests)

All tests used `sources:["renati"]` (corta), `sources:["renati","scielo"]` (media), `sources:["renati","scielo","pubmed","crossref"]` (larga) with `fastMode:true`.

| Query | `search` | `batch_search` | `smart_search` |
|-------|----------|----------------|----------------|
| Short (1-3 tok) | ~38s, 8 res | ~55s, 10 res | ~131s, 8 res |
| Medium (5-8 tok) | ~33s, 16 res | ~163s, 30 res | ~148s, 28 res |
| Long (10+ tok) | ~149s, 16 res | ~207s, 60 res | ~169s, 24 res |

**Conclusions:**
- **`search` is 4× faster than `smart_search`/`batch_search` for simple queries**. Use it by default.
- **`batch_search` returns 2× more results** because it doubles `maxResults` per source. Use it when you need recall > latency.
- **`smart_search` adds query-expansion overhead** (sinónimos ES/EN/PT) and produces similar results to `search`. Avoid unless user explicitly asks for "expanded search".
- **Long queries are 4-6× slower** than short ones on `search`. Suite backend processes all tokens. Trim if possible.
- **`pubmed` returns 0** on social queries regardless of tool. Use it only with biomedical keywords.
- **`crossref` returns results in `search` too** (test 2026-08-06, query "bacterial cellulose mango", 5 results in 1.4s). The 2026-08-03 note about `crossref` only working in `batch_search` is no longer accurate.

## Re-test 2026-08-06 — Full pool probe (48 sources via REST, query "bacterial cellulose mango Komagataeibacter")

> **⚠️ SUPERSEDED by 2026-08-07 pool below.** Most "DEAD" entries in this table have been revived.

| Status | Sources | Count |
|--------|---------|-------|
| ✅ OK (returning results) | `lareferencia` (49, 4.4s), `bdtd` (49, 33s), `laref_ecuador` (30, 3s), `scielo` (8, 6.6s), `arxiv` (8, 1.6s), `zenodo` (8, 2.7s), `openaire` (7, 3.3s), `pubmed` (5, 1.9s), `crossref` (5, 1.4s), `renati` (1, 30s), `doaj` (1, 1.2s) | 11 sources OK |
| ⚠️ EMPTY (fast, 0 results — source works but query doesn't match niche biotech) | `core`, `serpapi`, `scopus`, `dblp`, `sciencedirect`, `jstor`, `ieee`, `springer`, `dialnet`, `sage`, `wiley`, `tandfonline`, `peru_web_fallback`, `minciencias`, `redalyc`, `nature`, `elsevier`, `paperswithcode`, `huggingface`, `semantic` | 20 sources empty |
| 🔴 DEAD (HTTP timeout 100s — DO NOT CALL) | `alicia`, `laref_peru`, `unam`, `espana`, `laref_brasil`, `laref_argentina`, `costarica`, `oasisbr`, `rraae`, `openalex`, `semanticscholar`, `snrd`, `anid`, `elsalvador`, `uruguay`, `laref_mexico`, `laref_chile`, `laref_colombia`, `conacyt` | 19 sources dead |

**Key changes vs 2026-08-03 skill version:**
- ✅ **REVIVED**: `lareferencia` (central node) — was DEAD, now returns 49 results in 4.4s
- ✅ **REVIVED**: `laref_ecuador` — was DEAD, now returns 30 results in 3s
- 🔴 **BECAME UNRELIABLE**: `oasisbr` (was OK 1.4s, now 100s timeout) and `rraae` (was OK 0.8s, now 100s timeout). Re-check before use.
- ⚡ **FASTER**: `crossref` (1.4s vs 1-28s), `doaj` (1.2s vs 25s), `zenodo` (2.7s vs 27s), `openaire` (3.3s vs 34s) — Suite backend upgraded

## 🆕 Re-test 2026-08-07 — Full source pool (39 sources, query "bacterial cellulose mango Komagataeibacter")

This re-test was conducted directly via opencode MCP tools (`letxinet-gateway_search`) across 8 batches with the Suite backend running all 4 post-1.1.0 fixes. **This SUPERSEDES the 2026-08-06 pool above.**

| Status | Sources | Count |
|--------|---------|-------|
| ✅ OPERATIVAS (returning real results) | `semantic` (48, 3.3s), `openalex` (49, 2.4s REVIVED), `pubmed` (5, 2.3s), `arxiv` (8, 1.8s), `scopus` (8, 1.5s), `crossref` (5, 0.9s), `doaj` (1, 0.7s), `zenodo` (8, 1.9s), `openaire` (7, 2.4s), `core` (3, 2.6s REVIVED), `scielo` (8, 1.4s), `lareferencia` (49, 5.4s), `laref_ecuador` (30, 4.8s), `renati` (1, 30s), `bdtd` (49, 6s), `unam` (1, 1.9s REVIVED), `anid` (13, 2.2s REVIVED), `snrd` (12, 8.5s REVIVED), `espana` (30, 2.4s REVIVED), `costarica` (30, 3.6s REVIVED), `uruguay` (30, 5.7s REVIVED), `elsalvador` (30, 2.2s REVIVED), `laref_peru` (30, 1.2s REVIVED), `laref_brasil` (30, 3.4s REVIVED), `laref_mexico` (30, 2.5s REVIVED), `laref_argentina` (30, 3.4s REVIVED), `laref_colombia` (30, 5.6s REVIVED), `laref_chile` (30, 12.8s REVIVED), **`oasisbr` (22, 30.78s RE-ESTABILIZED)**, **`rraae` (49, 5.228s RE-ESTABILIZED — TOP relevance)**, **`serpapi` (8, 1.18s HIDDEN TREASURE)** | 30 sources OPERATIVAS |
| ⚠️ EMPTY (fast, 0 results — source functional, query niche no match) | `redalyc` (0, 144ms), `minciencias` (0, 135ms), `conacyt` (0, 453ms), `dblp` (0, 838ms), `paperswithcode` (0, 1.6s), `openreview` (0, 1.165s), `huggingface` (0, 1.6s — `Invalid sort parameter: trending` bug) | 8 sources EMPTY |
| 🔴 DEAD (HTTP timeout 90s) | `alicia` (0, 90s) | **1 source DEAD (only this one)** |
| **TOTAL** | | **39 sources** |

**Key changes vs 2026-08-06 skill version:**

- ✅ **9 REVIVED** (were DEAD, now OPERATIVAS): `core`, `openalex`, `unam`, `anid`, `snrd`, `espana`, `costarica`, `uruguay`, `elsalvador`
- ✅ **2 RE-ESTABILIZED** (was UNRELIABLE 100s timeout, now functional): `oasisbr` (30s), `rraae` (5s)
- ✅ **6 `laref_*` subsystem REVIVED** (was DEAD, now OpenAlex-aggregated): `laref_peru`, `laref_brasil`, `laref_mexico`, `laref_argentina`, `laref_colombia`, `laref_chile` — confirmed same OpenAlex dataset, filtered by country tag
- ✅ **Global sources REVIVED**: `semantic` (48 results, was 0), `scopus` (8 results, was 0), `serpapi` (8 results — HIDDEN TREASURE, returns Google Scholar matches NOT in OpenAlex/PubMed/Scielo)
- ⚠️ **`conacyt`** confirmed functional (fast EMPTY — NOT DEAD), returns 0 on biotech
- 🔴 **`alicia`** — only confirmed DEAD source as of 2026-08-07. Minedu (Peru) infrastructure issue.

**Latency benchmarks 2026-08-07** (much faster than prior versions):
- `crossref` 0.9s, `doaj` 0.7s, `serpapi` 1.18s, `arxiv` 1.8s, `zenodo` 1.9s, `scielo` 1.4s, `scopus` 1.5s, `laref_peru` 1.2s, `crossref` 0.9s
- New normal: global/OA sources < 10s, LatAm regional < 30s (instead of 100s timeout)

## Logging

After running tests, save results to:
- `D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\logs\progreso.csv`
- `D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\json\batchN-fuente.json`

Full pool results (44 sources, 6 batches, 2026-08-03):
`D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\Informe-Fuentes-Individuales.md`

Re-test battery 2026-08-06 (48 sources via REST, query "bacterial cellulose mango Komagataeibacter"):
`<extract_dir>/probe_sources.ps1`

**🆕 Full pool report 2026-08-07 (39 sources via MCP tools, 8 batches)**:
`D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\Informe-Fuentes-Individuales-2026-08-07.md`
This is the authoritative source-of-truth. JSONs:
`D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\json\batch7-serpapi-openreview.json`
`D:\OTROS\PRUEBAS-LETXINET\fuentes-individuales\json\batch8-oasisbr-rraae.json`

## Test commands (when verifying sources still work)

To re-test ONE source from opencode:

```
letxinet-gateway_search(query="pobreza Lima Perú", sources=["<source>"], maxSources=5, fastMode=true)
```

If response has `data.stats.<source>.error === "Provider timeout"` → source is DEAD.
If response has `totalUniqueResults > 0` → source is OPERATIVE.
If response has `totalUniqueResults === 0` and no error → source works but query doesn't match.

Use the canonical test query `"pobreza Lima Perú"` for cross-source comparison.
