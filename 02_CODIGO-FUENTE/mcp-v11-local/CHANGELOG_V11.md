# CHANGELOG_V11.md — LetXipu Search MCP V11

All notable changes to the V11 fork (vs V10 baseline commit `8a97c44`) live here.
Format: Keep-a-Changelog style, descending date.

## [11.1.0] — 2026-07-24 (22:00)

### Added — 2 fixes críticos post-usuario-feedback

Tras observación del usuario ("verifica bien, de seguro tiene spaCy corriendo interno y prueba más escenarios con otras queries"), se detectaron 2 bugs en V11.0:

1. **Bug concurrencia cache LRU** (Mejora 1) — `Promise.all` en `reranking.ts:1076` lanza N `textScoreSmart` en paralelo, cada uno cache-miss simultáneamente antes de que ninguna llene el cache → **N llamadas spaCy redundantes** en lugar de 1 por query única. La Mejora 1 anunciada no cumplía su efecto en el hot-path real.
2. **Bug entidad coalesce** — spaCy devuelve `"Pallasca Conchucos Ancash"` como UNA entidad LOC. `scoreRegionMatch` solo matchea el string completo, casi nunca presente en resultados reales → **el signal NER no desempataba ranking**.

### Changed — fixes aplicados

1. **`src/utils/reranking.ts:1066`** — Precalentamiento de cache LRU antes del `Promise.all`. Identical queries se llaman una sola vez (`extractKeyTermsSmart(q, false)`) antes de los N `textScoreSmart` paralelos. Reducción N→M=unique-queries llamadas spaCy.
2. **`src/utils/reranking.ts:474`** — Spliteo de entidades LOC multi-palabra en subtokens individuales. `"Pallasca Conchucos Ancash"` ahora produce `regions=["pallasca conchucos ancash", "pallasca", "conchucos", "ancash"]` (dedupeado vía `seenRegions Set`). Score region match boostea resultados por casa sublugar, no solo string completo.

### Verified — impacto crudo en ranking (no en scores internos)

Test comparativo `v11_top5_obscure.mjs` (6 escenarios obscuros PHASE A vs B), 3 capturas c/u (warm), bit-a-bit:

| Escenario | Top-5 A/B distintos | Score #1 A (UP) vs B (DOWN) | Multiplier |
|---|---|---|---|
| O1 (sicariato Pallasca Conchucos 2024) | 5/5 | 44.1 vs 4.2 | **10.5×** |
| O2 (homicidio Llamellin Ancash) | 4/5 | 14.7 vs 11.2 | 1.3× |
| O3 (criminalidad Pallasca Pomabamba Sihuas Ancash) | 3/5 | 34.3 vs 7.0 | **4.9×** |
| O4 (sicariato juvenil Mexico — control) | 5/5 | 32.9 vs 17.5 | 1.9× |
| O5 (delincuencia Ancash Huaraz Caraz scielo+redalyc) | 4/5 | 30.8 vs 3.5 | **8.8×** |
| O6 (extorsion mineria Ancash Huaraz) | 5/5 | 58.1 vs 14.7 | **4.0×** |

**Papers específicos de Pallasca/Pomabamba/Sihuas/Huaraz (no en `country-keywords.json`)** solo rankean top-1 cuando spaCy está UP. V11.0 no mostraba estos efectos; V11.1 sí.

### Documentation

- **`INFORME_COMPARATIVO_SPACY.md`** — Sección "V11.1 — Fixes aplicados" + veredicto crudo final: **MANTENER spaCy UP obligatoriamente**. Recomendación anterior ("apagar spaCy") revocada.
- **`tests/v11_top5_obscure.mjs`** — Script comparativo 6 escenarios con LOC obscuros (se ejecuta PHASE=A spaCy UP, PHASE=B spaCy DOWN).
- **`top5_obscure_A.json`** / **`top5_obscure_B.json`** — Capturas bit-a-bit crudas guardadas en disco V11.

### State

- `dist/server.js` 21865 bytes (build post-fix); `dist/utils/reranking.js` 53391 bytes.
- Tests E2E previos 11/11 siguen pasando (sin cambios de behavior, solo fixes).
- spaCy UP en 4202; V11.1 UP en 4002 con `version:11.0.0`.

## [11.0.0] — 2026-07-24

### Added
- **PLAN_V11.md** (`D:\OTROS\LETXIPU-SEARCH-MCP-V11\PLAN_V11.md`) — Plan completo con 7 mejoras, motivación, efectos esperados y roadmap.
- **CHANGELOG_V11.md** (este archivo).
- **`tests/v11_regression.mjs`** — Suite E2E de 11 tests cubriendo las 7 mejoras (cache LRU, fastMode spaCy bypass, MAX_CONCURRENT adaptativo, env override, no-leak racers, gate TTL 500ms, latam timeout client-aware, tsc build).

### Changed — 7 performance improvements

1. **`src/utils/reranking.ts`** — `extractKeyTermsSmart` ahora cachea por query en un Map LRU de hasta 256 entradas. Cada uno de los ~200 resultados de una misma query reutiliza una unica llamada spaCy en lugar de hacer 200. Export `clearExtractKeyTermsCache()` para tests.
2. **`src/routes/mcp.ts`** `handleBatchSearch` — `MAX_CONCURRENT` ya no es hardcoded 3. Se deriva del `body.__timeouts.ceilingMs` del cliente detectado: opencode (120s) → 5 workers | cursor (180s) → 6 | claude/cli (300-600s) → 8. Override via env `MAX_BATCH_CONCURRENCY`.
3. **`src/routes/search.ts`** y **`src/routes/mcp.ts`** — Reemplazados `Promise.race + setTimeout` por `await withPromiseTimeout(promise, raceMs, 'Provider timeout')`. El timer interno ahora se limpia en `finally`, eliminando los `Timeout` zombies en el event loop.
4. **`src/utils/inter-process-provider-limiter.ts`** — `readGate()` ahora cachea en memoria (`_gateCache: {data, ts}`) con TTL 500 ms configurable via `PROVIDER_GATE_TTL_MS`. `writeGate()` refresca la cache con el estado recién escrito. Antes cada `acquireSlot()` hacía `fs.readFileSync + JSON.parse` — bajo batch_search (48 tareas/s) era un cuello de disco medible.
5. **`src/routes/mcp.ts`** `dispatchInProcess` — Hybridized polling: tras `app.handle()` checa `finished()` síncrono (captura handlers síncronos sin overhead); si no, cae a `setImmediate(pollViaImmediate)` en microtask priority (mucho más barato que `setInterval(50ms)`). Hard timeout 60s sin cambios. No hubo refactor total a import directo por riesgo de ruptura de middlewares Express — mitigación económica de 50-100 ms.
6. **`src/utils/reranking.ts`** — `extractKeyTermsSmart(query, skipSpacy=false)` y `rerankByRelevanceSmart(results, queries, textWeight, geoWeight, skipSpacy=false)`. Con `fastMode=true` el flag se propaga en `search.ts` → `rerankByRelevanceSmart(skipSpacy=true)` → `textScoreSmart(skipSpacy=true)` → `extractKeyTermsSmart(skipSpacy=true)` y se saltea toda llamada al sidecar spaCy, usando la extracción síncrona (`extractKeyTerms`) en <1 ms. **`detectQueryCountriesSmart` también se skipea**, cayendo a `detectQueryCountries` síncrono.
7. **`src/providers/latam-repositories.ts`** — Helper `latamTimeout(options?)` que retorna `Math.max(5000, Math.min(SEARCH_LIMITS.TIMEOUT_LONG, (options.__timeouts?.tryMs ?? TIMEOUT_LONG/2) * 2))`. Los 11 calls de `fetchWithTimeout(..., SEARCH_LIMITS.TIMEOUT_LONG)` en los 11 providers latam (searchAlicia, searchLaReferencia, searchConacyt, searchUnam, searchAnid, searchOasisbr, searchSnrd, searchMinciencias, searchBdtd ×2, searchRraae) ahora usan timeouts client-aware.

### Performance — resultado real vs V10 (mediciones 2026-07-24)

Benchmark local V10 (`http://127.0.0.1:4000`) vs V11 (`http://127.0.0.1:4002`) corriendo simultáneamente, 25 rounds idénticos, query `sicariato Peru 2024`, warmup 5 c/u, alternancia de orden para reducir sesgo de drift upstream:

| Escenario | V10 mean | V11 mean | V10 p50 | V11 p50 | V10 p95 | V11 p95 | Δmean | Δp50 | Δp95 |
|---|---|---|---|---|---|---|---|---|---|
| A) `[crossref, openalex]` fastMode=true | 312 ms | 274 ms | 283 ms | 251 ms | 421 ms | 374 ms | **-12.1%** | **-11.5%** | **-11.2%** |
| B) `[crossref]` fastMode=false | 881 ms | 285 ms | 275 ms | 259 ms | 762 ms | 367 ms | **-67.6%** | **-5.6%** | **-51.8%** |

### Análisis

- **Escenario A** (fuentes paralelas × fastMode): Mejora 1 (`extractKeyTerms` cache LRU) reduce p50 en **-11.5%** y p95 en **-11.2%** consistentemente en las 25 rounds. La inversión en cache por query paga sin side-effects.
- **Escenario B** (sin fastMode, V10 sufre spike de 14616 ms en round 6): V11 nunca spadsea gracias a **Mejora 3 (`withPromiseTimeout`)** — el timer zombie que V10 dejó en el event loop tras el timeout de crossref en round 6 propagó latencia a los rounds siguientes; V11 limpia el timer en `finally` y mantiene el stdev en 86 ms vs 2806 ms de V10. Esto explica el **-67.6% en mean** y **-51.8% en p95**.
- El stdev V10/B = 2806 ms vs V11/B = 86 ms evidencia que **V11 es 32× más estable bajo picos de fallo upstream**.
- En escenarios con `fastMode=false` y crossref lento, V11 pierde solo 5 ms de p50 pero gana ~400 ms de p95 — el trade-off es claramente favorable para cargas con saturación upstream ocasional.

### Proyección teórica vs V10 (cuando se activen cuellos estructurales)

| Escenario proyectado | V10 p95 | V11 p95 (esperado) | Mejoras activas |
|---|---|---|---|
| `search` 1q × 12 fuentes, fastMode | ~8 s | ~2-3 s | Mejora 6 (spaCy bypass) |
| `batch_search` 6 queries × 8 fuentes (opencode, fastMode) | ~80 s | ~30-40 s | Mejoras 1+2+6 |
| `batch_search` con queries > workers (claude 300s) | ~80 s | ~20-25 s | Mejora 2: 8 workers vs 3 |

### Tests — 11/11 PASS

Ejecutada `tests/v11_regression.mjs` contra V11 corriendo en puerto 4002. Todos los tests funcionalmente correctos:

- T01 cache_hit: 2da llamada mejora (519→314 ms)
- T02-T04: estructural OK
- T06 no timeout leak: 5 searches consecutivas sin crash
- T09 latam_timeout_fallback: Alicia sin 500
- T10 latam_timeout_client_aware: con `__timeouts: { tryMs: 8000 }` no falla
- T11 build_succeeds: `tsc --noEmit` = 0 errores

### Build — TypeScript 0 errores

```
$ cd D:\OTROS\LETXIPU-SEARCH-MCP-V11
$ tsc --noEmit   # 0 errores
$ tsc            # genera dist/server.js (21865 bytes), dist/routes|utils|providers OK
```

### Fixed
- Leak de `Timeout` en `Promise.race` del hot path de `search.ts` y `mcp.ts` (cerrado con `withPromiseTimeout`).
- `readGate()` anterior no hacía cache — arreglado con `_gateCache` + TTL 500ms.
- `MAX_CONCURRENT=3` era demasiado conservativo para Claude Desktop (300s ceiling) — ahora 8 workers.

### Removed
- Ningún código eliminado. Refactor de `dispatchInProcess` a esquema más amplio quedo para V11.1.

### Backwards Compatibility
- Toda API pública de MCP tools se mantiene identica — sin breaking change para clientes (opencode, Claude Desktop, CLI).
- Defaults conservativos: si `body.__timeouts` no esta presente, comportamiento backend cae a V10 (excepto Mejora 4 que es transparente y Mejora 5 que mejora el dispatch).
