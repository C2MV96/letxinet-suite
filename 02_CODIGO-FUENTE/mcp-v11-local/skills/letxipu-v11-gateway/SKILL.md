---
name: letxipu-v11-gateway
description: "Use LetXipu Search MCP V11 from OpenCode or Claude with the reliable local gateway fallback. Trigger for LetXipu, Letxinet, V11, academic papers or theses, search, smart_search, batch_search, PDFs, MCP timeouts, gateway_call, gateway_poll, Hugging Face Space checks, or configuring OpenCode MCPs."
---

# LetXipu V11: direct MCP and gateway

Use the direct V11 MCP for short deterministic requests. Use the gateway whenever an operation can exceed an OpenCode tool timeout or needs result polling.

## Endpoints and clients

| Route | Configuration | Use it for |
|---|---|---|
| Direct local V11 | `letxipu-v11-local` → `http://127.0.0.1:4003/api/mcp` | Discovery, small `search`, metadata, targeted PDF operations |
| Local gateway | `letxinet-gateway` → `gateway-mcp-bridge.cjs` | OpenCode-safe `search`, `smart_search`, `batch_search`, and polling |
| Public V11 | `https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp` | Health and production verification; do not rely on it for local gateway jobs |

## OpenCode decision rule

1. For a focused search, call `gateway_call` with `tool: "search"`. The bridge routes it to local V11, enables `fastMode` unless explicitly provided, and preserves an OpenCode-safe synchronous ceiling.
2. For `smart_search` or `batch_search`, call `gateway_call` with that tool name. It returns a task id.
3. Call `gateway_poll` after 30–60 seconds and continue polling until `STATUS=DONE`.
4. If a tool returns `isError`, report the provider or MCP error; never convert it into an empty successful result.

Example:

```json
{"tool":"batch_search","arguments":{"queries":["desigualdad Lima","segregación escolar Perú"],"sources":["alicia","renati"],"maxResults":10,"fastMode":true}}
```

## Search practice

- Put country, university, and region in the query itself; those fields are not strict filters.
- Use `fastMode: true` first. Keep `maxResults` at 5–20 for interactive work.
- For Peru, `sources: ["alicia", "renati"]` is usually more predictable than the broad `peru` group.
- Treat one provider timeout as partial upstream failure. Try a smaller source set or gateway job before declaring the service down.

## Verification

Before diagnosing a client issue, verify:

1. `GET http://127.0.0.1:4003/health` returns `200`.
2. MCP `initialize` then `tools/list` returns 28 tools.
3. `gateway_call(search)` returns non-empty content.
4. A `gateway_call(batch_search)` task reaches `STATUS=DONE` through `gateway_poll`.

Restart OpenCode after editing `C:\Users\USER\AppData\Roaming\opencode\opencode.json` or the gateway bridge. Do not put credentials in MCP configuration, scripts, logs, or chat.
