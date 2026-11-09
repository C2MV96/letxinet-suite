---
name: letxipu-v11-complete
description: "Operate, configure, test, debug, and deploy LetXipu Search MCP V11: academic and LatAm/Peru search, MCP tools, PDF and metadata pipeline, local V11 at port 4003, OpenCode gateway routing, source health, timeouts, and Hugging Face Docker Spaces. Use whenever the request mentions LetXipu, Letxinet, V11, academic papers or theses, MCP search, PDF extraction, gateway_call, smart_search, batch_search, or the LetXipu Hugging Face Space."
---

# LetXipu Search MCP V11

Use this guide for `D:\OTROS\LETXIPU-SEARCH-MCP-V11`.

## Select the route

| Need | Use | Timeout behavior |
|---|---|---|
| Simple search or a specific V11 tool | `letxipu-v11-local` | Direct HTTP MCP at `http://127.0.0.1:4003/api/mcp` |
| OpenCode gateway search | `letxinet-gateway.gateway_call` with `tool: "search"` | Synchronous, `fastMode: true` by default, 114 s bridge ceiling |
| Broad or expanded search | `letxinet-gateway.gateway_call` with `tool: "smart_search"` or `"batch_search"` | Returns a task id; retrieve it with `gateway_poll` |
| PDF, metadata, conversion | Direct V11 unless the operation is naturally long | Do not promise a short response for remote PDFs |

Never send `smart_search` or `batch_search` through a synchronous OpenCode request. Call `gateway_poll` after 30–60 seconds with its `task_id`.

## Search rules

- Use `search` for a focused question; use `batch_search` for several variants or broad research.
- Put country, university, and region in the query text. `location` and `university` are not strict filters.
- Start with `fastMode: true`, `maxResults: 5–20`, and a targeted source list.
- `sources: ["peru"]` can be slow; use `sources: ["alicia", "renati"]` when applicable.
- Treat an upstream provider timeout as partial source failure, not proof the MCP is down.

## Tool families

| Family | Tools |
|---|---|
| Search/discovery | `search`, `batch_search`, `smart_search`, `trending_papers`, `search_conferences`, `list_sources`, `coverage_report`, `health_check`, `help` |
| Metadata | `enrich_metadata`, `fetch_metadata`, `recover_metadata` |
| PDF/content | `resolve_pdf`, `download_pdf`, `read_pdf`, `read_pdf_markdown`, `pdf_smart_summary`, `pdf_metadata`, `pdf_citations`, `extract_section`, `extract_tables`, `extract_formulas`, `analyze_academic` |
| Conversion | `convert_document`, `batch_convert` |

## Local service and OpenCode

- V11: `PORT=4003`; spaCy: `SPACY_PORT=4203`.
- Start with `start_v11.bat`. In batch files use `set "PORT=4003"`; trailing whitespace breaks internal URLs.
- OpenCode config: `C:\Users\USER\AppData\Roaming\opencode\opencode.json`.
- Gateway bridge: `D:\OTROS\LETXINET-MCP-AGENT-GUI\LETXINET-MCP-AGENT-GUI-V2-main\gateway-mcp-bridge.cjs`; set `LETXIPU_LOCAL_URL=http://127.0.0.1:4003`.
- Restart OpenCode after changing its MCP config or bridge code.

## Verify before changes

1. Run `npm.cmd run build`.
2. Check `GET http://127.0.0.1:4003/health` returns `200`.
3. Send MCP `initialize`, then `tools/list`; expect 28 tools.
4. Test one focused `search` through the actual intended client route.
5. For gateway long tools, confirm `gateway_poll` returns `STATUS=DONE` and non-empty JSON.

## Hugging Face Docker Space

1. Do not publish `.env`, caches, model folders, test reports, backups, or `openalex-state.json`.
2. Update README front matter and wording from V9/Vercel to V11/Hugging Face; Docker listens on `7860`.
3. Confirm an explicit spaCy model strategy: bake models into the image, mount a verified persistent cache, or document degraded `fastMode` operation.
4. Build and test locally, then set provider credentials only in Space Settings → Secrets.
5. After the build, test `/health`, MCP `initialize`, `tools/list` (28 tools), and a small `search`.
6. Keep a known-good commit for rollback. Never include access tokens or API keys in source, logs, or chat.
