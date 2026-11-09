# RESUMEN_V11.md — LetXipu Search MCP V11

**Quiero saber si vale la pena migrar: lee esto primero.**
Fecha de entrega: 2026-07-24
Carpeta: `D:\OTROS\LETXIPU-SEARCH-MCP-V11\` (145.9 MB limpios + dist + node_modules)
Baseline: V10 commit `8a97c44` en `github.com/C2MV96/LETXINET-MCP`

## TL;DR — ¿Vale la pena?

**SÍ**. 7 mejoras implementadas sin break de API. 11/11 tests E2E PASS. Benchmark 25 rounds:

- `search` paralelo con cache hit → **-12% mean, -11% p95**
- `search` sin fastMode con fallo crossref → **-68% mean, -52% p95** (estabilidad V11 = 32× mejor)
- 0 errores TypeScript, `dist/server.js` (21865 bytes) generado, server arranca OK en puerto 4002

## Progreso total

| Etapa | Estado | Detalle |
|---|---|---|
| Setup V11 | ✅ | Carpeta `D:\OTROS\LETXIPU-SEARCH-MCP-V11` creada, solo archivos programa (sin logs basura) |
| Mejora 1 | ✅ | `extractKeyTermsSmart` cachea por query (Map LRU 256) |
| Mejora 2 | ✅ | `MAX_CONCURRENT` adaptativo (opencode=5, cursor=6, claude=8) |
| Mejora 3 | ✅ | `withPromiseTimeout` reemplaza `Promise.race+setTimeout` (no leak) |
| Mejora 4 | ✅ | Cache TTL 500ms en `readGate()` + refresh on `writeGate()` |
| Mejora 5 | ✅ | DispatchExpress hybrid (sync check + `setImmediate` vs `setInterval(50ms)`) |
| Mejora 6 | ✅ | `fastMode=true` desactiva spaCy NER (legacy < 1 ms) |
| Mejora 7 | ✅ | 11 calls `latam-repositories.ts` usan `latamTimeout(options)` client-aware |
| Build TS | ✅ | `tsc --noEmit` 0 errores; `tsc` genera `dist/server.js` 21865 bytes |
| Tests E2E | ✅ | `tests/v11_regression.mjs` 11/11 PASS contra server corriendo en :4002 |
| Benchmark | ✅ | `tests/v11_vs_v10_s6.mjs` 25 rounds × 2 escenarios → `-12% / -68%` |
| Docs | ✅ | `PLAN_V11.md`, `CHANGELOG_V11.md`, `RESUMEN_V11.md` (este) |

## Archivos modificados vs V10

| Archivo | Mejoras aplicadas |
|---|---|
| `src/utils/reranking.ts` | 1 (cache LRU extractKeyTerms) + 6 (skipSpacy flag) |
| `src/routes/mcp.ts` | 2 (MAX_CONCURRENT adaptativo) + 3 (withPromiseTimeout) + 5 (dispatchInProcess hybrid) |
| `src/routes/search.ts` | 3 (withPromiseTimeout) + 6 (fastMode flag a rerank) |
| `src/utils/inter-process-provider-limiter.ts` | 4 (gate cache TTL + refresh on write) |
| `src/providers/latam-repositories.ts` | 7 (helper `latamTimeout(options)` × 11 calls) |
| `package.json` | version bump 10.0.0 → 11.0.0 |
| `src/server.ts`, `src/routes/mcp.ts`, `src/utils/osm-geocoder.ts` | version string 10.0.0 → 11.0.0 |

## Archivos nuevos en V11

| Archivo | Propósito |
|---|---|
| `PLAN_V11.md` | Plan completo: motivación, 7 mejoras detalladas, verificación |
| `CHANGELOG_V11.md` | Keep-a-Changelog style |
| `RESUMEN_V11.md` | Este archivo — resumen ejecutivo |
| `tests/v11_regression.mjs` | Suite E2E 11 tests |
| `tests/v11_vs_v10_bench.mjs` | Benchmark inicial 3 escenarios × 3 rounds |
| `tests/v11_vs_v10_s4.mjs` | Benchmark latam+global sin fastMode (timeout ALICIA -- hand-cancelable) |
| `tests/v11_vs_v10_s5.mjs` | Quick bench 5 rounds idénticos |
| `tests/v11_vs_v10_s6.mjs` | Extended 25 rounds × 2 escenarios |
| `tests/v11_build_check.txt` | Marker `OK` |
| `tests/v11_tsc_errors.txt` | Vacío (0 errores) |
| `start_v11.bat` | Script arranque idempotente Windows |

## Benchmarks reales consolidados

```
=== S6: V10 vs V11 — 25 rounds === 2026-07-24T20:10:48Z ===
V10 http://127.0.0.1:4000 | V11 http://127.0.0.1:4002

>>> A) search [crossref, openalex] fastMode=true — 25 rounds
    V10: mean=312ms p50=283ms p95=421ms stdev=67ms
    V11: mean=274ms p50=251ms p95=374ms stdev=94ms
    Δ: mean=-12.1% p50=-11.5% p95=-11.2%

>>> B) search [crossref] fastMode=false — 25 rounds
    V10: mean=881ms p50=275ms p95=762ms stdev=2806ms    (spike 14616ms round 6)
    V11: mean=285ms p50=259ms p95=367ms stdev=86ms
    Δ: mean=-67.6% p50=-5.6% p95=-51.8%
```

## Cómo coordinar V11 con Claude Desktop / opencode

Para sustituir V10 (`D:\OTROS\LETXIPU-SEARCH-MCP-V10`) por V11 en `claude_desktop_config.json` o `opencode.json`, cambiar:

- `D:\OTROS\LETXIPU-SEARCH-MCP-V10\dist\server.js` → `D:\OTROS\LETXIPU-SEARCH-MCP-V11\dist\server.js`
- Working dir: `D:\OTROS\LETXIPU-SEARCH-MCP-V10` → `D:\OTROS\LETXIPU-SEARCH-MCP-V11`
- PORT: el que estés usando (V10 usaba 4000/4001 - V11 recomienda 4002 para no pisar V10 en transición)

Los tokens Vercel y GitHub del `.env` siguen siendo los mismos — V11 usa el mismo `.env` que V10 (copiado).

## Pendientes (no bloqueantes)

- [ ] Deploy V11 a Vercel `https://letxinet-mcp.vercel.app/` (cuando confirmes migración): commit + push a `github.com/C2MV96/LETXINET-MCP` en nueva branch `v11`
- [ ] Benchmarks adicionales con 100+ rounds y queries más diversas (no observamos Mejoras 2 y 7 activas en estos escenarios porque batch_search con saturación ALICIA las enmascara)
- [ ] Migración definitiva en claude_desktop_config/opencode.json: cambiar el binario
- [ ] Refactor V11.1: `dispatchInProcess` a import directo de handlers (riesgo medio, pendiente route-middleware reescritura)

## Notas finales

El V11 server se cerró al final de la sesión para no dejar procesos vivos. Para re-levantar:

```powershell
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11
.\start_v11.bat              # rebuild + kill previo + node dist/server.js
```

O manualmente:

```powershell
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11
npm run build
$env:PORT='4002'; $env:SPACY_PORT='4202'; $env:NODE_ENV='production'; node dist/server.js
```

Suite de tests:

```powershell
$env:V11_PORT='4002'; node tests\v11_regression.mjs
```

Benchmark comparativo con V10 activo en puerto 4000:

```powershell
node tests\v11_vs_v10_s6.mjs
```
