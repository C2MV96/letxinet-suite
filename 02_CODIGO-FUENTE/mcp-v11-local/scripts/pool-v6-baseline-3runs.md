# Pool v6 â€” all MCP tools test report

Generated: 2026-07-25 19:48:23
Base URL: http://localhost:4003
Runs: 3
Active tools tested: 23
Deprecated (skipped if -SkipDeprecated): smart_search, pdf_sections, search_dblp, fetch_metadata, recover_metadata

## Summary per tool

| Tool | Runs | PASS | Avg ms | Verdicts |
|------|------|------|--------|----------|
| search | 3 | 3 | 61054 | (PASS=3) | | batch_search | 3 | 3 | 26 | (PASS=3) | | list_sources | 3 | 3 | 31 | (PASS=3) | | health_check | 3 | 3 | 3463 | (PASS=3) | | coverage_report | 3 | 3 | 26 | (PASS=3) | | help | 3 | 3 | 79 | (PASS=3) | | search_paperswithcode | 3 | 3 | 632 | (PASS=3) | | search_conferences | 3 | 3 | 781 | (PASS=3) | | trending_papers | 3 | 3 | 432 | (PASS=3) | | enrich_metadata | 3 | 0 | 108339 | (RPC_ERROR(-32001)=3) | | download_pdf | 3 | 3 | 452 | (PASS=3) | | resolve_pdf | 3 | 3 | 163 | (PASS=3) | | pdf_metadata | 3 | 3 | 724 | (PASS=3) | | pdf_citations | 3 | 3 | 438 | (PASS=3) | | pdf_smart_summary | 3 | 3 | 4235 | (PASS=3) | | read_pdf | 3 | 3 | 1937 | (PASS=3) | | read_pdf_markdown | 3 | 0 | 1597 | (PASS_TEXT_ONLY=3) | | extract_section | 3 | 3 | 313 | (PASS=3) | | extract_tables | 3 | 0 | 650 | (EMPTY=3) | | extract_formulas | 3 | 0 | 20 | (EMPTY=3) | | convert_document | 3 | 0 | 1325 | (PASS_TEXT_ONLY=3) | | batch_convert | 3 | 0 | 608 | (WARN_NO_FIELDS=3) | | analyze_academic | 3 | 3 | 363 | (PASS=3) |

## Aggregated verdicts

| Verdict | Count |
|---------|-------|
| PASS | 51 | | EMPTY | 6 | | PASS_TEXT_ONLY | 6 | | WARN_NO_FIELDS | 3 | | RPC_ERROR(-32001) | 3 |

## Deprecated tools (intentionally skipped)

- smart_search - pdf_sections - search_dblp - fetch_metadata - recover_metadata