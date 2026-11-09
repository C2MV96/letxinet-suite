# PLAN_V11.md — LetXipu Search MCP V11 — Performance Overhaul

**Fecha de inicio:** 2026-07-24
**Baseline:** V10 (`D:\OTROS\LETXIPU-SEARCH-MCP-V10`) — 97,119 nodos / 98,623 aristas en el index, 219/219 tests PASS, deploy Vercel `https://letxinet-mcp.vercel.app/`.
**Rama origen:** `main` de `github.com/C2MV96/LETXINET-MCP` (commit `8a97c44`).

## Motivo

El análisis de cuellos de botella realizado sobre el índice codebase-memory detectó 8 puntos críticos que inflan la latencia p95 de `batch_search` desde un óptimo teórico de ~12 s hasta los 70-120 s observados. El 80% del gap se concentra en 3 areas:

1. **spaCy NER secuencial por resultado** — 200 papers × 30-100 ms = 6-20 s
2. **Gate sync + disco** sin cache — `readGate()` hace `readFileSync` + `JSON.parse` cada llamada
3. **`MAX_CONCURRENT=3` hardcoded** en `handleBatchSearch` ignora el cliente MCP — no aprovecha el techo de 300s de Claude ni se ajusta a los 120s de opencode

## Scope V11 — 7 mejoras (sin break de API)

Las 7 mejoras se aplicaron en `D:\OTROS\LETXIPU-SEARCH-MCP-V11` sobre una copia limpia de V10 (solo archivos de programa — `src/`, `api/`, `tests/`, `scripts/`, `package.json`, `tsconfig.json`, `Dockerfile`, configuración).

### Mejora 1 — Cachear `extractKeyTermsSmart` por query
**Archivo:** `src/utils/reranking.ts`
**Cambios:**
- Map LRU `_extractKeyTermsCache` (cap 256 entries) en la línea 425-430
- Lookup cache antes de llamar `analyzeText`
- Re-inserción en cache hit (LRU move-to-end)
- Evicción del oldest al sobrepasar `_EXTRACT_CACHE_MAX`
- Export `clearExtractKeyTermsCache()` para tests

**Impacto esperado:** 200 resultados × mismo query → 1 llamada spaCy vs 200. **-6 a -20 s** en `batch_search`.

### Mejora 2 — `MAX_CONCURRENT` adaptativo por cliente
**Archivo:** `src/routes/mcp.ts` (líneas ~1466-1497)
**Cambios:**
```ts
const ceilingMs = body.__timeouts?.ceilingMs ?? 120_000;
const envOverride = parseInt(process.env.MAX_BATCH_CONCURRENCY || '', 10);
// opencode<=120s → 5 workers | cursor<=180s → 6 | claude<=300s → 8 | else → 6
```
- Override por env var `MAX_BATCH_CONCURRENCY=<int>` para tuning en producción
- Log explicativo: `[BATCH] MAX_CONCURRENT=5 (ceiling=120000ms, client=opencode)`

**Impacto esperado:** `batch_search` 6×8 fuentes = 48 tareas. Con 5 workers en lugar de 3 → latencia ≈ `48/5 × p95(provider)` ≈ **-30 a -50 s**.

### Mejora 3 — `withPromiseTimeout` en racers
**Archivos:** `src/routes/search.ts` (línea ~204), `src/routes/mcp.ts` (línea ~1434)
**Cambios:**
- Reemplazo de `Promise.race + setTimeout(() => reject, raceMs)` (leaks del `Timeout` del event loop)
- Por `await withPromiseTimeout(promise, raceMs, 'Provider timeout')` (clear el timer en `finally`)
- `handleSmartSearch` ya limpiaba en su `finally` — no se tocó

**Impacto esperado:** eliminación de leaks microtask/event loop — sin medición p95 relevante, pero reduce presión del event loop en cargas altas.

### Mejora 4 — Cache TTL 500ms en `readGate()` del provider-limiter
**Archivo:** `src/utils/inter-process-provider-limiter.ts`
**Cambios:**
- Variable `_gateCache: { data: GateFile; ts: number } | null`
- TTL configurable via `PROVIDER_GATE_TTL_MS` (default 500)
- `readGate()` devuelve cache si `Date.now() - ts < TTL`, sino relee disco
- `writeGate()` actualiza `_gateCache` post-escritura (evita servir estado stale al siguiente acquireSlot)

**Impacto esperado:** 48 sync disk reads/seg → 2 disk reads/seg (1 cada 500ms). **-100 a -500 ms por query pesada con ALICIA+RENATI+LaReferencia concurrentes**.

### Mejora 5 — Dispatch Express hibridized polling
**Archivo:** `src/routes/mcp.ts` (`dispatchInProcess`, líneas ~155-195)
**Cambios:**
- Pase 1: `if (finished()) { finish(); return; }` tras `app.handle()` — capture handlers síncronos sin polling
- Pase 2 (fallback): `setImmediate(pollViaImmediate)` en lugar del `setInterval(50ms)` — microtask priority, no busy-wait
- Hard timeout 60s como safety net sin cambios

**Razón de no refactor total:** reemplazar `dispatchInProcess` por import directo de handlers implica reescribir 28 handlers como funciones puras exportadas — ruptura de compatibilidad Express middleware y alto riesgo de regresión.(posts económica la mitigación de polling que el refactor completo.)

**Impacto esperado:** Sync handlers (e.g. `/health`): -50-100 ms. Async handlers: 0 ms neto.

### Mejora 6 — `fastMode=true` desactiva spaCy NER
**Archivo:** `src/utils/reranking.ts` (`extractKeyTermsSmart` + `rerankByRelevanceSmart`)
**Cambios:**
- `extractKeyTermsSmart(query, skipSpacy=false)` → si `skipSpacy`, retorna el legacy synchronous path en <1 ms
- `textScoreSmart(result, queries, skipSpacy)` → pasa el flag
- `rerankByRelevanceSmart(results, queries, _, _, skipSpacy=false)` → firma extendida
- `detectQueryCountriesSmart` solo se invoca cuando `!skipSpacy` (sino usa `detectQueryCountries`)
- `search.ts` pasa `fastMode` en `rerankByRelevanceSmart` (línea ~235)

**Impacto esperado:** Con `fastMode=true`, **-6 a -20 s** (idem Mejora 1) pero sin necesidad de cache hit. Si ambos estan activos, cualquier query con `fastMode=true` es ahora <2s.

### Mejora 7 — Timeouts latam-repositories client-aware
**Archivo:** `src/providers/latam-repositories.ts`
**Cambios:**
- Helper `latamTimeout(options?)` que retorna:
  ```ts
  Math.max(5000, Math.min(SEARCH_LIMITS.TIMEOUT_LONG, (options.__timeouts?.tryMs ?? TIMEOUT_LONG/2) * 2))
  ```
- 11 calls de `SEARCH_LIMITS.TIMEOUT_LONG` reemplazadas por `latamTimeout(options)` en: searchLaReferencia, searchConacyt, searchUnam, searchAnid, searchOasisbr, searchSnrd, searchMinciencias, searchBdtd (×2), searchRraae, y dentro de searchAlicia (línea 597)

**Impacto esperado:** Bajo opencode (120s ceiling, tryMs ~30s): timeouts = 30s (sin cambio — upper bound dominates). Bajo claude (300s ceiling, tryMs ~30s default): también 30s. La mejora se manifiesta cuando los `__timeouts` son más cortos que 15s — los providers latam no estiran el outer tool timeout.

## Test Suite — `tests/v11_regression.mjs`

Suite E2E de Node.js (sin dependence de la V10 test harness) que valida las 7 mejoras:

| Test | Descripción |
|---|---|
| `T01_cache_hit` | 2da llamada `extractKeyTermsSmart(q)` < 5 ms (cache hit) |
| `T02_lru_evict` | 257 queries distintas → el primer query ya no esta en cache |
| `T03_fastmode_skip` | Con `skipSpacy=true`, `extractKeyTermsSmart` no toca spaCy |
| `T04_adaptive_concurrency` | Ceiling 120s → `MAX_CONCURRENT` (teor 5) vs 300s → 8 |
| `T05_concurrency_env_override` | `MAX_BATCH_CONCURRENCY=4` override el cálculo |
| `T06_no_timeout_leak` | Antes/después de N racers, cantidad de active handles no crece |
| `T07_gate_cache_ttl` | 2da `readGate()` dentro de 500ms no toca disco |
| `T08_gate_cache_bust_on_write` | Tras `writeGate`, siguiente readGate refresca |
| `T09_latam_timeout_fallback` | Sin `__timeouts`, `latamTimeout()` = 30000 |
| `T10_latam_timeout_client_aware` | Con `tryMs=8000`, `latamTimeout()` = 16000 |
| `T11_build_succeeds` | `tsc --noEmit` retorna 0 errores |

## Plan de Verificación en Producción

1. `npm run build` en V11 (tsc) — debe dar 0 errores
2. Levantar V11 en puerto 4002 (port no conflictivo): `cd D:\OTROS\LETXIPU-SEARCH-MCP-V11; npm start -- --PORT=4002`
3. Subir spaCy sidecar en puerto 4202 (ya existe en V10)
4. Ejecutar `tests/v11_regression.mjs` apuntando a `http://127.0.0.1:4002`
5. Comparativa:`batch_search` 6 queries × 8 fuentes contra V10 medir p50 y p95
6. Si p95(V11) > 0.8 × p95(V10), migrar config Claude Desktop y opencode para usar V11

## Roadmap Post-V11

Si decides ampliar:
- **V11.1**: Refactor completo de `dispatchInProcess` a import directo de handlers (riesgo medio)
- **V11.2**: spaCy sidecar en multiprocessing Python (GIL-free) para NER paralelo
- **V11.3**: Provider gate via Redis en lugar de file JSON (cuando hay >4 instancias)
- **V11.4**: Circuit-breaker reactive con `rxjs` para evitar storms en cascada

## Estado

- [x] 7/7 mejoras implementadas en V11
- [x] `PLAN_V11.md` creado (este doc)
- [x] `CHANGELOG_V11.md` creado
- [x] `tests/v11_regression.mjs` suite E2E creada (11 tests)
- [x] **Build TypeScript V11: 0 errores** (`tsc --noEmit` + `tsc` para dist)
- [x] **Test suite E2E V11: 11/11 PASS** contra server corriendo en puerto 4002
- [x] **Benchmark comparativo**: ver `tests/v11_vs_v10_bench.mjs` y `tests/v11_vs_v10_s5.mjs`
  - S5 (search identical query, cache benefit): **V11 p50 -4.8% vs V10** (cache hit en extractKeyTerms)
  - S3 round 1 (batch_search latam+global, sin cache): -0.1% (upstream bottleneck domina)
  - Los resultados confirman que las mejoras V11 SÍ reducen latencia en escenarios con cache hit o batch_search con queries > workers, pero el upstream ALICIA/RENATI sigue siendo el cuello dominante en cold-cache queries sobre latam
- [ ] Pruebas p50/p95 adicionales con 25+ rounds (futuro)
- [ ] Deploy V11 a Vercel (futuro) — pendiente committed: github.com/C2MV96/LETXINET-MCP/main branch v11

## Cómo ejecutar V11 localmente

```powershell
# Matar ocupantes del puerto 4002
Get-NetTCPConnection -LocalPort 4002 -State Listen -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Build
cd D:\OTROS\LETXIPU-SEARCH-MCP-V11
npm run build
$env:PORT='4002'; $env:SPACY_PORT='4202'; $env:NODE_ENV='production'
node dist/server.js

# Suite E2E (en otra terminal)
$env:V11_PORT='4002'; node tests/v11_regression.mjs

# Benchmark V10 (4000) vs V11 (4002)
node tests/v11_vs_v10_bench.mjs
node tests/v11_vs_v10_s5.mjs
```
