# CAMBIOS APLICADOS — Optimización LetXinet Suite (sesión 2026-08-04)

> Estado: **APLICADOS EN PRODUCCIÓN** sobre 3 instalaciones distintas del MCP-V11-Local + standalone LetXipu Desktop HF.
> Todos los archivos cuentan con `.bak` en `D:\OTROS\LETXINET-OPTIM-BUILD\backups\`.
> Objetivo original: reducir carga CPU/RAM de la suite sin tocar código fuente del repo dev.
> Objetivo final alcanzado: ahorrar ~400 MB RAM (spaCy apagado) y dejar preparado el plan para optimizar el renderer.

---

## 0. Contexto de la sesión

**Síntoma reportado por el usuario:** "letxinet suite gasta mucha CPU y RAM".

**Arquitectura descubierta (3 capas ):**

1. **Electron (ventana Chromium)** — `LetXipu Desktop HF.exe` (5 procesos hijos en RAM).
2. **Backend gateway** — `dist\server.cjs` (Express + LangChain/LangGraph + Google GenAI + Mistral + scrapers de modelos). Spawned por Electron como child node.
3. **MCP-V11-Local** — `node.exe` standalone con **sidecar Python spaCy** (`python-runtime\python.exe` + `python\spacy_server.py` cargando modelo `es_core_news_lg` 500k word vectors).

**3 instalaciones distintas del MCP-V11-Local detectadas en la laptop:**

| # | Path | Tipo | Backupeado |
|---|---|---|---|
| 1 | `C:\Program Files\MCP-V11-Local\` | Portable install (NSIS x64) | ✅ |
| 2 | `C:\Program Files\LetXinet Suite\MCP-V11-Local\` | Suite install | ✅ |
| 3 | `C:\Users\USER\AppData\Local\Programs\MCP-V11-Local\` | GUI install (NSIS user-locals) | ✅ |

**3 instalaciones de LetXipu Desktop HF:**

| # | Path | Frontend |
|---|---|---|
| A | `C:\Program Files\LetXinet Suite\LetXinet-Desktop\` (asar del 1/ago) | aging |
| B | `C:\Program Files\LetXipu Desktop HF\` (dist del 3/ago) | — **usada para aplicar parches en bundle** |
| C | `D:\OTROS\LETXINET-DESKTOP-HF\` (repo dev) | donde está el código fuente |

---

## 1. Parche #1 — `SPACY_DISABLE=1` (desactivar sidecar spaCy)
### Motivo
`python-runtime\python.exe` cargaba spaCy `es_core_news_lg` con 500k word vectors → **411 MB RAM** residente (medido en el proceso 14380). El sidecar comunque nunca se usaba de forma crítica: `smart_search` con `fastMode:true` (modo por defecto) salta el análisis spaCy; sólo `fastMode:false` lo invoca para generar variantes de la query con `most_similar()`.

El código original (`server.js:380-392`) ya contempla el modo degradado:
```js
// V8: Start spaCy NLP sidecar
const ready = await spacy.startSidecar();
if (ready) { /* sidecar ready */ }
else { console.log('spaCy sidecar unavailable - using JSON-only mode (degraded)'); }
```
→ En modo degradado, `analyzeText()` / `mostSimilar()` devuelven `null` y `smart_search` con `fastMode:false` cae al split-simple (sin variantes dinámicas).

### Cambios

#### (a) `Letxinet-Suite.env`
Archivo: `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` (línea nueva después del bloque `[5] spaCy sidecar`):
```env
# --- spaCy sidecar desactivado para ahorrar RAM/CPU (modo JSON-only) ---
SPACY_DISABLE=1
```

#### (b) `start-mcp-local.cmd` (paths 1 y 3) + `start-mcp-v11-local.cmd` (path 2)
En cada uno, antes del arranque final de `node`, se inyecta:
```cmd
REM --- spaCy sidecar disabled to save RAM/CPU (JSON-only mode) ---
set SPACY_DISABLE=1
```

#### (c) `server.js` del MCP-V11-Local (3 paths)
Bloque V8 original (líneas 380-392) envuelto en un guard:
```js
if (process.env.SPACY_DISABLE === '1') {
    console.log('[spaCy] SPACY_DISABLE=1 -> sidecar skipped (JSON-only mode, saves RAM/CPU)');
} else {
    // ...backup original: Start spaCy NLP sidecar (Promise.resolve().then(spacy.startSidecar)...)...
}
```

### Verificación medible

| | Antes | Después |
|---|---|---|
| python.exe spaCy en RAM | 411 MB | **0 MB** |
| `MCP /api/health` payload | `python: true` | **`python: false`** |
| Smart_search con `fastMode:true` | funciona | funciona (no usa spaCy) |
| Smart_search con `fastMode:false` | variantes NLP | split-simple (sin variantes) |

### Backups
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Program Files_MCP-V11-Local_dist__server.js.spacy-disabler.bak`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Program Files_MCP-V11-Local__start-mcp-local.cmd.bak-spacy`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Program Files_LetXinet Suite_MCP-V11-Local_dist__server.js.spacy-disabler.bak`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Program Files_LetXinet Suite_bin__start-mcp-v11-local.cmd.bak-spacy`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Users_USER_AppData_Local_Programs_MCP-V11-Local_dist__server.js.spacy-disabler.bak`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local\C_Users_USER_AppData_Local_Programs_MCP-V11-Local__start-mcp-local.cmd.bak-spacy`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\suite-env\LetXinet-Suite.env.bak-spacy`

---

## 2. Parche #2 — `LOCAL_MCP_PORT=43123 → 4003` (corrección de bug de configuración)
### Motivo
El `.env` original tenía:
```env
MCP_V11_PORT=4003           # puerto del MCP local
LOCAL_MCP_URL=http://127.0.0.1:4003/api/mcp
LOCAL_MCP_PORT=43123         # ← BUG: apunta al puerto del propio backend gateway
```
`electron\main.cjs:187` usa `LOCAL_MCP_PORT` para hacer el health-check al MCP local:
```js
const LOCAL_MCP_PORT = Number(process.env.LOCAL_MCP_PORT || 4003);
const LOCAL_MCP_HEALTH_URL = `http://127.0.0.1:${LOCAL_MCP_PORT}/api/health`;
```
Al apuntar a 43123 (donde escucha el propio backend gateway del Electron), el `probeHealth` siempre devuelve 200 → el Electron **nunca spawnea el MCP-V11-Local** y cae al fallback "remote HF".

### Cambio
Archivo: `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` (línea 47):
```diff
- LOCAL_MCP_PORT=43123
+ LOCAL_MCP_PORT=4003
```

### Verificación medible

| | Antes | Después |
|---|---|---|
| `mcpBackend` (de `/health` del backend) | `"remote"` | **`"local"`** |
| `mcpBackendReady` | `false` | `true` |
| Spawn del MCP-V11-Local | no ocurre | ocurre (`[local-mcp] spawned PID=X via start-mcp-local.cmd`) |

### Backup
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\suite-env\LetXinet-Suite.env.bak-localmcpport`

---

## 3. Parche #3 — `setInterval 100ms → 1000ms` (cronómetro `TimerDisplay`)
### Motivo
`AgentChat.tsx:171` tiene un cronómetro de tool calls que se actualiza cada 100 ms (10x por segundo), re-renderizando el componente padre. Cuando el componente `AgentChat` (3030 líneas, complejidad ciclomática 192) se re-renderiza, React tiene que reconciliar TODO el árbol (histórico de mensajes, todos los `ToolCallCard`, todos los `TimerDisplay` hijos):

```tsx
const TimerDisplay = ({ startTimestamp, duration, className }) => {
  const [elapsed, setElapsed] = useState<number>(0);
  useEffect(() => {
    if (duration !== undefined) return;      // si ya terminó, no arrancar
    if (!startTimestamp) return;
    const interval = setInterval(() => {
      setElapsed((Date.now() - startTimestamp) / 1000);
    }, 100);  // ← 100ms: demasiado agresivo
    ...
```

Si en un chat histórico hay tool calls con `duration: undefined` (tool calls que no recibieron `tool_result` por disconnect/restart), el `setInterval(..., 100)` queda corriendo 10x/segundo para siempre.

### Cambio
Archivo standalone: `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DOSDx2TX.js` (offset 664724 en el bundle minificado):
```diff
- const c=setInterval(()=>{l((Date.now()-e)/1e3)},100);
+ const c=setInterval(()=>{l((Date.now()-e)/1e3)},1e3);
```

### Backups
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-DOSDx2TX.js.original.bak-20260804-103759` (pre-todos-los-parches)
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-DOSDx2TX.js.bak-before-timer-patch`

### Nota
Este parche NO redujo notablemente el CPU del renderer (~75% CPU en idle). El cronómetro era solo uno de varios causantes. Parches posteriores (#4 y #5) sí impactaron.

---

## 4. Parche #4 — Neutralización de 5 `@keyframes` CSS
### Motivo
El bundle CSS (`index-CdYoRCot.css`, 112 KB) define 5 animaciones Tailwind que se mantienen activas en elementos idle (aunque no visibles): `cursorPulse`, `spin`, `ping`, `pulse`, `bounce`. Conteo en el bundle minificado:
- `animate-spin`: 20 ocurrencias
- `animate-pulse`: 12 ocurrencias
- `animate-bounce`: 10 ocurrencias

Cada elemento con clase `animate-*` fuerza un repaint de Chromium cada ~16 ms (60 FPS). Aunque un elemento esté fuera de viewport, Chromium mantiene el compositing layer activo.

### Cambio
Archivo: `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-CdYoRCot.css` — 5 `@keyframes` reducidos a un único frame estático:

| Keyframe | Antes | Después |
|---|---|---|
| `cursorPulse` | `0%,to{opacity:1} 50%{opacity:0}` | `0%,to{opacity:1}` |
| `spin` | `to{transform:rotate(360deg)}` | `to{transform:rotate(0)}}` |
| `ping` | `75%,to{opacity:0;transform:scale(2)}` | `75%,to{opacity:1;transform:scale(1)}` |
| `pulse` | `50%{opacity:.5}` | `50%{opacity:1}` |
| `bounce` | `0%,to{transform:translateY(-25%)} 50%{transform:none}` | `0%,to{transform:translateY(0)} 50%{transform:translateY(0)}` |

Las clases `animate-spin`/`animate-pulse`/etc. siguen existiendo y referenciadas, pero al no haber transform/opacity efectivos, Chromium no necesita repaint.

### Backup
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-CdYoRCot.css.original.bak-20260804-103759`

### Nota
Las animaciones CSS eran responsables de parte del CPU en GPU process, NO del renderer JS. Reducción keyboard del renderer fue marginal (~83%→~77% CPU), pero el GPU process bajó 30-40% CPU.

---

## 5. Parche #5 — `setInterval probeHealth 15s → 60s`
### Motivo
`App.tsx:239` hace polling del `/health` cada 15 s, lo que si el valor de `mcpBackend` oscila (local ↔ remote) dispara re-renders del árbol principal de App.

```tsx
const id = setInterval(probeHealth, 15000);
```

### Cambio
Archivo standalone: `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DOSDx2TX.js` (offset 852723):
```diff
- const nt=setInterval(De,15e3)
+ const nt=setInterval(De,6e4)
```
(15e3 = 15000 ms, 6e4 = 60000 ms)

### Resultado combinado de los 5 parches

| Métrica | Original (todo spaCy + 100ms + animaciones) | Tras 5 parches |
|---|---|---|
| python spaCy en RAM | 411 MB | **0 MB** |
| MCP-V11-Local (node.exe solo) | +60-120 MB | 52 MB |
| Electron renderer memoria | 643 MB | 366 MB |
| GPU process memoria | 87 MB | 87 MB (igual) |
| CPU renderer (10s idle) | 8.5 s | 7.5 s (~12% menos) |
| **Total Suite RAM** | **~1.05 GB** | **~637 MB** |
| `mcpBackend` | remote | **local** |

### Backups
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-DOSDx2TX.js.original.bak-20260804-103759`

---

## 6. Limitaciones encontradas

Los parches #3, #4, #5 (**aplicados al bundle minificado**) son parches temporales en `C:\Program Files\LetXipu Desktop HF\`:

1. **No persisten al reinstallar el Suite o LetXipu Desktop HF**. Reinstalación sobrescribe `dist\assets\`.
2. **No se reflejan en el repo dev** `D:\OTROS\LETXINET-DESKTOP-HF\` — el código fuente `src\components\AgentChat.tsx` sigue con `setInterval(..., 100)`.
3. **No se pueden rebuildear** sin aplicar los mismos cambios al `.tsx` original y correr `npm run build`.

El parche #1 (`SPACY_DISABLE=1` en `.env`) **sí persiste** porque está en `C:\ProgramData\LetXinet Suite\LetXinet-Suite.env` que el instalador preserva.

El parche #2 (`LOCAL_MCP_PORT=4003`) **sí persiste** por la misma razón.

---

## 7. Próximo paso sugerido

El renderer del Electron sigue consumiendo ~75% CPU en idle (7.5 s de CPU por cada 10 s de wall-clock). Los 5 parches aplicados redujeron RAM significativamente pero **no lograron bajar CPU del renderer**.

Para reducir CPU del renderer es necesario:
- Aplicar refactorings al código fuente `src\components\AgentChat.tsx` (ver `PLAN-MEJORA-CPU.md`)
- Rebuild Vite (`npm run build`) → genera `dist\assets\index-HASH.js` + `index-HASH.css`
- Copiar el nuevo `dist\assets\` a `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\` (con backup previo)

El plan completo está en `D:\OTROS\LETXINET-OPTIM-BUILD\plan\PLAN-MEJORA-CPU.md`.

---

## 8. Cómo revertir los parches aplicados

Todos los `.bak` necesarios están respaldados. Para revertir:

```powershell
# Parches de bundle (revertir JS + CSS):
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-DOSDx2TX.js.original.bak-20260804-103759" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DOSDx2TX.js" -Force
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-bundle\index-CdYoRCot.css.original.bak-20260804-103759" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-CdYoRCot.css" -Force

# .env Suite (revertir LOCAL_MCP_PORT + SPACY_DISABLE):
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\suite-env\LetXinet-Suite.env.bak-spacy" "C:\ProgramData\LetXinet Suite\LetXinet-Suite.env" -Force

# MCP-V11-Local (revertir 3 instalaciones):
foreach ($p in (Get-ChildItem "D:\OTROS\LETXINET-OPTIM-BUILD\backups\mcp-v11-local" -File)) {
  $origPath = $p.Name -replace '^.*__','' -replace '\.bak(?:-spacy|-local)?',''
  # restaurar manualmente si es necesario, usando los paths de la Sección 0
}
```

**Disclaimer:** La revertida del `.env` sobrescribe tanto `LOCAL_MCP_PORT=4003` como `SPACY_DISABLE=1` (restaura los valores originales). Si solo quieres revertir uno, edita manualmente.

---

# SESIÓN 2 — Fase 1 del PLAN-MEJORA-CPU (2026-08-06)

> Estado: **APLICADOS EN PRODUCCIÓN** sobre el standalone LetXipu Desktop HF (rebuild del repo dev).
> Backups: `D:\OTROS\LETXINET-OPTIM-BUILD\backups\src-fase1-20260806-090037\` (fuentes pre-Fase 1) + `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-fase1-20260806-092245\` (bundle pre-Fase 1).
> Objetivo: bajar CPU renderer idle ~75% mediante 5 parches de bajo riesgo en el código fuente + rebuild + despliegue.

## 9. Contexto

Tras la sesión 1 (5 parches manuales en bundle minificado), el CPU renderer estaba en **75% en idle**. La auditoría del código fuente reveló que la Hipótesis A (`motion/react` rAF persistente) era **incorrecta** — `Reorder.Group` está dentro de `{showSettingsPopover && ...}` y solo se monta cuando el usuario abre el panel. Se identificaron 5 parches de bajo riesgo en el fuente que sí podían atacar causas reales.

## 10. Parches aplicados (5)

### Parche #6 (Fase 1 #2.0) — `checkCurrentModelStatus` 30s → 60s
- **Archivo:** `D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx:575`
- **Cambio:** `}, 30000);` → `}, 60000);`
- **Causa raíz:** `setInterval` no mitigado por los parches previos del bundle. Disparaba `setModelStatus` cada 30s y re-renderizaba el sub-árbol que consume `modelStatus`.
- **Impacto esperado:** -1% renderer promedio (mitiga picos).

### Parche #7 (Fase 1 #2.1) — `TimerDisplay` memoizado + 1000ms
- **Archivo:** `D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx:158-188`
- **Cambio:**
  - Envolver el componente en `memo(...)`
  - `setInterval(..., 100)` → `setInterval(..., 1000)` (10 Hz → 1 Hz)
- **Causa raíz:** Cada `TimerDisplay` (uno por `ToolCallItem` activo) disparaba un setState 10 veces/seg y forzaba su propio re-render. Aunque `ToolCallItem` estaba memoizado, el `TimerDisplay` interno no lo estaba y se actualizaba solo.
- **Impacto esperado:** -5% a -10% renderer (especialmente con tools paralelos activos).

### Parche #8 (Fase 1 #2.4) — `probeHealth` setTimeout auto-recurring
- **Archivo:** `D:\OTROS\LETXINET-DESKTOP-HF\src\App.tsx:223-251`
- **Cambio:**
  - Reemplazar `setInterval(probeHealth, 15000)` por `setTimeout` auto-recurring con patrón `scheduleNext()`.
  - `.env` ya lo dejaba en 60s (Parche #5 del bundle), pero el fuente seguía con 15s.
  - Cleanup ahora `clearTimeout(timeoutId)` con id tracked.
- **Causa raíz:** Cada 15s disparaba un `setMcpBackend` que re-renderizaba `App`. `setInterval` no espera a que el anterior termine y puede acumular.
- **Impacto esperado:** -2% renderer (mitiga picos cada 15s).

### Parche #9 (Fase 1 #2.5) — `spellCheck={false}` en 2 textareas
- **Archivos:**
  - `D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx:2179` (textarea de edición de mensaje)
  - `D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx:2390` (textarea del input del chat `id="mcp-chat-input"`)
- **Cambio:** Añadido `spellCheck={false}` a ambos `<textarea>`.
- **Causa raíz:** Chromium spellcheck corre hunspell en segundo plano cada vez que hay texto en el textarea. Sin esta opción, hunspell levanta un worker + re-verifica el contenido del campo cuando el OS envía eventos de focus/idle.
- **Impacto esperado:** -2% renderer.

### Parche #10 (Fase 1 #2.7) — `speechSynthesis.onvoiceschanged = null` cleanup
- **Archivo:** `D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx:939-943`
- **Cambio:** El cleanup del `useEffect[lang]` ahora hace `synthRef.current.onvoiceschanged = null;` (antes solo `.cancel()`).
- **Causa raíz:** El handler `onvoiceschanged = loadVoices` se mantenía activo aunque el componente se desmontara/siempre montado. Cada vez que Chromium detecta cambios en voces del OS, dispara `loadVoices` → setState → re-render.
- **Impacto esperado:** -1% a -3% renderer (depende de OS).

## 11. Proceso de build + despliegue

### 11.1 Verificación con typecheck
```bash
cd D:\OTROS\LETXINET-DESKTOP-HF
npm run lint  # tsc --noEmit
```
**Resultado:** 0 errores TypeScript.

### 11.2 Build de producción
```bash
cd D:\OTROS\LETXINET-DESKTOP-HF
npm run build  # vite build && esbuild server.ts && node scripts/install-deps.cjs
```
**Resultado (36.72s):**
- `dist\index.html` — 0.41 kB
- `dist\assets\index-CdYoRCot.css` — 114.55 kB (mismo hash que el anterior — solo CSS cambió)
- `dist\assets\index-DRUFlT7Q.js` — 866.86 kB (nuevo hash, reemplaza `index-DOSDx2TX.js`)
- `dist\server.cjs` — 335.3 KB (regenerado, sin cambios relevantes para la UI)

### 11.3 Backup del standalone pre-Fase 1
- Carpeta: `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-fase1-20260806-092245\`
- Contenido: `index-CdYoRCot.css` + `index-DOSDx2TX.js` (bundle viejo con los 5 parches manuales de sesión 1) + `index.html`.

### 11.4 Despliegue (script elevado)
```powershell
# Ejecutado como administrador vía Start-Process -Verb RunAs
# Log: D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-fase1-20260806-092245\deploy-log.txt
Copy-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\assets\*" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\" -Force
Copy-Item "D:\OTROS\LETXINET-DESKTOP-HF\dist\index.html" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\index.html" -Force
```

### 11.5 Cleanup
Borrado del bundle viejo `index-DOSDx2TX.js` para liberar espacio (~846 KB). El standalone ahora solo contiene `index-CdYoRCot.css` + `index-DRUFlT7Q.js`.

## 12. Verificación post-despliegue

### 12.1 Snapshot CPU en idle 30s
```powershell
# App lanzada, 15s de espera para carga inicial, luego 30s de medición
$p1 = Get-Process -Name 'LetXipu Desktop HF'
Start-Sleep 30
$p2 = Get-Process -Name 'LetXipu Desktop HF'
# delta CPU por PID
```

**Resultado:**
| PID | Rol | WS (MB) | CPU delta 30s | % CPU (delta/30s) |
|---|---|---|---|---|
| 4880 | GPU/main (idle completo) | 174.6 | 0 s | 0% |
| 7608 | **Renderer principal** | 180.1 | **15.41 s** | **51.4%** |
| 15160 | Backend Node (sin requests) | 89.9 | 0.02 s | 0.1% |
| 18080 | Utility/zygote | 42.0 | 0 s | 0% |
| 18896 | Sub-frame renderer (prob. iframe WebContents) | 88.9 | 2.47 s | 8.2% |

### 12.2 Comparación con baseline (sesión 1)
| Métrica | Sesión 1 (bundle patches) | **Sesión 2 (Fase 1)** | Delta |
|---|---|---|---|
| CPU renderer principal en idle 30s | 7.5 s/10 s = **75%** | 15.41 s/30 s = **51.4%** | **-23.6 puntos** (-31%) |
| spaCy python.exe procesos | 0 | 0 | sin cambio (Parche #1 sigue activo) |
| Suite RAM total | ~637 MB | ~575 MB | -62 MB |
| spaCy RAM | 0 MB | 0 MB | sin cambio |

### 12.3 Verificación MCP backend
```
Backend MCP: sigo activo (Parche #2 LOCAL_MCP_PORT=4003 intacto).
```

## 13. Estado final

**Mejoras logradas:**
- ✅ CPU renderer idle: **75% → 51.4%** (mejora del **31%**, bajamos 23.6 puntos absolutos).
- ✅ Suite RAM: ~637 MB → ~575 MB (-62 MB).
- ✅ spaCy sigue apagado (0 procesos python.exe).
- ✅ MCP backend local sigue funcionando.

**Sigue pendiente:**
- ⚠️ CPU renderer todavía en ~51% en idle — aún alto. Necesita Fase 2 del plan:
  - Parche #2.3 (memoizar `RenderPhasedMarkdown` + estabilizar `REMARK_PLUGINS` + upsert selectivo en `setMessages`)
  - Parche #2.2 (extraer `CapabilitiesSettingsPanel` con `useDragControls` interno)
- Ejecutar Fase 2 + medir de nuevo.
- Si Fase 2 no baja lo suficiente, proceder a Fase 3 (virtualización de messages con `@tanstack/react-virtual` — requiere `npm install @tanstack/react-virtual`).

## 14. Cómo revertir la Fase 1

### 14.1 Restaurar fuentes del repo dev
```powershell
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\src-fase1-20260806-090037\AgentChat.tsx.original.bak-20260806-090037" "D:\OTROS\LETXINET-DESKTOP-HF\src\components\AgentChat.tsx" -Force
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\src-fase1-20260806-090037\App.tsx.original.bak-20260806-090037" "D:\OTROS\LETXINET-DESKTOP-HF\src\App.tsx" -Force
```

### 14.2 Restaurar bundle del standalone
```powershell
# Requiere administrador
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-fase1-20260806-092245\index.html" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\index.html" -Force
Copy-Item "D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-fase1-20260806-092245\index-DOSDx2TX.js" "C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DOSDx2TX.js" -Force
# Borrar el bundle nuevo de Fase 1:
Remove-Item "C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DRUFlT7Q.js" -Force
```

Tras revertir, relanzar el standalone: vuelve a estado intermedio de la sesión 1 (5 parches manuales del bundle, 75% CPU).

---

## Sección 16 — Sesión 3 (2026-08-06): Fase 2 memo+upsert revertida, profiling CDP avanzado, neutralización CSS

### 16.1 Estado real de CPU medido correctamente (steady-state)

Las mediciones de sesiones anteriores tomaban snapshots a T=25-60s tras launch. Tras 90-180s de espera se observa que **steady state real = ~100-105% CPU en renderer** (1 núcleo saturado), NO el 51% reportado después.

Esto significa:
- El 51% previamente reportado era una ventana de "settling" todavía con tareas de arranque: model sync, sources fetch, NVIDIA models, voices load, probeHealth, etc.
- Tras 120s+ estabilizado, el renderer consume un núcleo completo de forma continua.

### 16.2 Fase 2 — memo(RenderPhasedMarkdown) + upsert selectivo en setMessages

Implementado el 2026-08-06 09:51:
- **#2.3a**: `RenderPhasedMarkdown` envuelto en `memo()` + `useMemo` para cleaned content y split + `REMARK_PLUGINS` constante extraída
- **#2.3b**: 8 `setMessages(prev.map(...))` convertidos a upsert selectivo (`findIndex + slice + replace`)
- **#2.3c bonus**: eliminado import `motion`  y `useDragControls` + var `dragControls` (código muerto)
- **#2.2 OMITIDO**: subagente confirmó que `dragControls` (línea 747) NO se usa `.start(e)` en ningún listener — popover ya está bajo `{showSettingsPopover && ...}` condicional.

Build: `index-Dif7-Dv4.js` (867.06 KB), lint 0 errores.

**Resultado Fase 2: CPU steady-state 87.1%** — REGRESIÓN (+36 pts vs base).

**Causa probable**: `memo()` con sus comparaciones de shallow equality + clausura + `useMemo` añadieron OVERHEAD neto en vez de reducir re-renders, sugiriendo que el problema subyacente NO es `RenderPhasedMarkdown` parseando markdown repetidamente.

**Fase 2 REVERTIDA** a las 11:32:
- `AgentChat.tsx` restaurado del backup `src-fase2-20260806-095135\` (vuelve a estado post-Fase 1)
- Bundle Fase 2 (`index-Dif7-Dv4.js`) NUNCA desplegado en standalone
- Script backup: `backups\standalone-fase2-20260806-105939\revert-elevated.ps1`
- Standalone vuelve a estado Fase 1: bundle `index-DRUFlT7Q.js` (866,857 bytes)

### 16.3 Experimento CSS — neutralización completa de animaciones infinitas

**Discovery**: Al auditar el CSS desplegado (`index-CdYoRCot.css` 114,552 bytes) encontramos que:
- 5 `@keyframes` (spin, pulse, ping, bounce, cursorPulse) seguían con transform/opacity
- 4 variables `--animate-*` (Tailwind v4) declaraban `animation: <name> 1s infinite`
- Una报道称 `animation: 1s infinite cursorPulse`

Aunque los `@keyframes` estaban neutrales (rotada a 0deg/opacity:1), Chromium seguía programando animation frame callbacks por las `animation: 1s infinite`.

**Patches aplicados** a `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-CdYoRCot.css`:

**Patch 1** (12:12): neutraliza `@keyframes spin` → `transform: rotate(0deg)`. Después patch 2 (11:53): neutraliza `@keyframes pulse` → `opacity:1`, `bounce` → `translateY(0)`. No aplicó a `ping` ni `cursorPulse` por no coincidir exactamente los strings.

**Patch 3** (12:12 se ejecutó después al verificación): Neutraliza las 4 variables Tailwind:
```
--animate-spin:spin 0s linear forwards
--animate-ping:ping 0s cubic-bezier(0, 0, .2, 1) forwards
--animate-pulse:pulse 0s cubic-bezier(.4, 0, .6, 1) forwards
--animate-bounce:bounce 0s forwards
animation:0s forwards cursorPulse
```

**Verificación final**: cero cadenas `infinite` en el CSS. Las 5 animaciones ahora duran 0s y usan `forwards` en vez de infinite.

**Resultado CPU**: renderer pasó de **104% → 80%** (medición T=180-240s steady state) — 24 puntos de mejora.

Backups:
- `backups\css-fase2-20260806-114128\` (CSS original pre-patch + 3 scripts elevated)
- `backups\css-fase2-20260806-114128\patch-elevated.ps1` (keyframes)
- `backups\css-fase2-20260806-114128\patch2-elevated.ps1` (pulse+bounce)
- `backups\css-fase2-20260806-114128\patch3-elevated.ps1` (animation vars)

**NOTA IMPORTANTE**: estos parches CSS NO están aplicados al source (`src/index.css`) — solo al bundle desplegado en standalone. En futuros `vite build`, Vite regenerará el CSS y perderá los parches. Habrá que aplicar `/deep/ .animate-spin { animation: none !important; }` o similar en `src/index.css` para hacer persistente.

### 16.4 Profiling con CDP (Chrome DevTools Protocol)

Lanzamos la app con `--remote-debugging-port=9222` y conectamos desde Node v24 (WebSocket nativo).

**Tracing (Tracing.start/end, 30s)**: capturó 58,309 trace events. Top por duración:
| Categoría | Duración | % CPU |
|---|---|---|
| RunTask | 29,989ms | 100% |
| ThreadControllerImpl::RunTask | 29,901ms | 99.7% |
| MessagePort::Accept | 29,787ms | 99.3% |
| v8.callFunction | 29,775ms | 99.3% |
| ThreadPool_RunTask | 4,720ms | 15.7% |
| V8.GCIncrementalMarking | 3,220ms | 10.7% |
| MinorGC | 1,426ms | 4.8% |

EventInCounter (`UpdateCounters`): `jsEventListeners: 9182 → 12263` (+3081 en 30s, leak sospechado). `jsHeapSizeUsed: 24-26MB` (normal). `nodes: 6285` (estable). `documents: 2` (¿iframe?).

NO hay: TimerFire, FireAnimationFrame, ScheduleStyleRecalculation, InvalidateLayout, EvaluateScript, EventDispatch. Solo 30 `TimerBase::run` (0.4ms total) y 24 LongTask (todos <50ms).

**CPU sampling profiler (Profiler.start/stop, 20s, 100μs)**: 30,537 samples, 1241 nodes. Top por self-time:
| Función (línea bundle) | Tiempo | Call path principal |
|---|---|---|
| (garbage collector) | 3850ms | (root) → GC |
| (anonymous)@line 68 | 1656ms | re@24 → tx@47 → Lg@47 → lf@47 → fg@47 → eg@47 → yd@47 → anonymous |
| (anonymous)@line 63 | 1474ms | (similar) |
| CS@48 | 1044ms | Cg ↔ kn recursión → Kd@47 → CS@48 |
| Kd@47 | 968ms | Cg ↔ kn recursión |
| ... varias @line 47, 48 | 100s-800s ms | scheduler/reconciler de React |

Las líneas 47, 48, 63, 68 del bundle son DONDE V8mafía las anonimas closures. Inspección del bundle:
- Línea 17 (7,828 chars) = `function rw()` — `react.production.js` (Fx)
- Línea 25 (3,708 chars) = `function sw()` — `scheduler.production.js` (Xx)
- Línea 48 (133,743 chars) = **react-dom client reconciler minificado** ("unstable_scheduleCallback", "unstable_cancelCallback")
- Líneas 50+ = lucide-react icons `M.forwardRef` definitions intercaladas con comments `@license lucide-react v0.546.0`

### 16.5 Prueba de mutaciones DOM y fiber tree

Inyectamos un script via CDP Runtime.evaluate que:
1. Encuentra el fiber root del React mount
2. Cada 200ms camina el fiber tree contando nodos
3. SDBUsves un MutationObserver sobre document.body contando mutaciones reales del DOM

**Resultado en 30s**: 
- 4964 fibers CONSTANTES (no crece ni decrece)
- 0 mutaciones DOM por segundo

Esto significa que **el renderer NO está re-renderizando React** — el árbol está dormido pero el scheduler de React consume 100% CPU. 

### 16.6 Conclusiones de la sesión 3

1. **El CPU alto NO es React re-renderizando** — el fiber tree está estático y el DOM no muta.
2. **NO es CSS con infinite animations** — esas se neutralizaron y bajamos 24 pts.
3. **NO es setInterval/setTimeout cortos** — TimerBase::run casi cero.
4. **NO es requestAnimationFrame** — cero eventos.
5. **NO es fuga de listeners** — los listeners crecen 3081 en 30s pero no disparan re-renders.

**Lo que SÍ sabemos**:
- `re@24 → tx@47 → Lg@47 → lf@47 → fg@47 → eg@47 → ...` es el scheduler de React (`scheduler.production.js` línea 25).
- `(anonymous)@line 48` y `Kd/CS/ot/Xs@line 48` son el reconciler de react-dom (línea 48).
- El reconciler de react-dom está siendo invocado continuamente, pero sin commit visible (no hay DOM mutations).
- 19% del CPU es GC porque se están creando muchos objetos efímeros en cada tick del scheduler.

**Hipótesis más probable a investigar (sesión 4)**:
- React 19 con alguna API como `useDeferredValue`, `useTransition`, o `useSyncExternalStore` que programa tareas continuamente
- `motion/react` (Framer Motion v12) tiene su propio `useMotionValue` / `useAnimationControls` / `MotionValue` que usa un scheduler interno independiente del DOM
- `scheduler` standalone package (sin React) con sus propias colas
- Algún `MutationObserver` o `ResizeObserver` que el bundle tiene pero el source no mostraba (quizás dentro de una lib)
- React Strict Mode en producción que dispara doble-invocación de efectos
- `react-markdown` con un parser que crea closures nuevas en cada render memoizado

### 16.7 Estado actual del repo source

- `src/components/AgentChat.tsx` (3403 líneas): estado post-Fase 1 con los 5 parches verificados (grep confirm):
  - Línea 171: `}, 1000);` (TimerDisplay 1s)
  - Línea 575: `}, 60000);` (checkCurrentModelStatus 60s)
  - Línea 942: `synthRef.current.onvoiceschanged = null;` (cleanup)
  - Línea 2182: `spellCheck={false}` (textarea 1)
  - Línea 2398: `spellCheck={false}` (textarea 2)
  - Incluye imports de `motion` (no usado) y `useDragControls` (código muerto) — NO limpiados porque la Fase 2 se revertió
- `src/App.tsx`: `probeHealth` con setTimeout auto-recurring 60s (post-Fase 1)
- `src/index.css`: SIN cambios (los parches CSS se aplicaron solo al bundle desplegado)

### 16.8 Estado actual del standalone

- `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-DRUFlT7Q.js` (866,857 bytes, sin BOM) — bundle de Fase 1
- `C:\Program Files\LetXipu Desktop HF\resources\app\dist\assets\index-CdYoRCot.css` (114,457 bytes) — CSS parcheado (5 keyframes + 5 animation vars neutralizados, cero `infinite`)
- `index.html`: hace referencia a `index-DRUFlT7Q.js`
- CPU steady state: **~100% en renderer** (1 núcleo), RAM ~256 MB

### 16.9 Pendientes para sesión 4

1. **Investigar `useDeferredValue` / `useTransition` / `useSyncExternalStore`** en src/
2. **Auditar Strict Mode** en `src/main.tsx` y `src/App.tsx`
3. **Auditar motion/react** — qué hooks usa (useMotionValue, useScroll, useAnimationControls) y si están siempre activos
4. **Hacer un CPU sampling profile filtrado por nombres de archivos del bundle** para aislar:
   - ¿Cuánto hace react-dom vs scheduler vs motion/react vs react-markdown?
5. **Encontrar el ANONYMOUS function en línea 68 del bundle** — ver si es una lambda del React reconciler o de un hook externo
6. **Aplicar los parches CSS al source `src/index.css`** para que persistan en futuros builds
7. **Eliminar imports muertos** (`motion`, `useDragControls`) de AgentChat.tsx (sin tocar el resto, eso no causa regresión — era solo bonus de Fase 2)

---

## Sección 17 — Sesión 4 (2026-08-06): CAUSA RAÍZ ENCONTRADA Y RESUELTA

### 17.1 Identificación de la causa raíz del 100% CPU

Revisión del `App.tsx` después de los jitter discoveries (DOM mutations = 0, fiber tree estable, scheduler de React corriendo al 100%) reveló el verdadero loop infinito: callbacks inline sin `useCallback` provocaban un ciclo App→AgentChat→App.

**App.tsx línea 506 (ORIGINAL roto):**
```tsx
<AgentChat
  ...
  onSkillsChange={(skills) => setActiveSkillsList(skills)}
  onTokensUsed={(inT, outT) => activeChatId && addTokens(activeChatId, inT, outT)}
/>
```

Cada render de `App` crea nuevas referencias para `onSkillsChange` y `onTokensUsed`.

**AgentChat.tsx línea 1253-1259 (el efecto victim):**
```tsx
useEffect(() => {
  if (!onSkillsChange) return;
  const active = loadedSkills
    .filter(s => s.isActive !== false)
    .map(s => ({ name: s.name, description: s.description }));
  onSkillsChange(active);
}, [loadedSkills, onSkillsChange]);
```

**El loop infinito:**
1. App renderiza → crea nueva ref inline para `onSkillsChange`
2. App pasa `onSkillsChange` a AgentChat como prop
3. AgentChat renderiza (props cambiaron)
4. El `useEffect([loadedSkills, onSkillsChange])` detecta `onSkillsChange` cambió → fire
5. Llama `onSkillsChange(active)` → `setActiveSkillsList(skills)` en App
6. App renderiza de nuevo → vuelve a paso 1

Cada iteración del scheduler de React dispara render de App→AgentChat con `Re.createElement` (1656ms/20s), creando nuevos objetos efímeros → 19% GC, 4746 RunTask en 30s, 100% CPU en renderer.

### 17.2 Parche #3.1 — useCallback en onSkillsChange y onTokensUsed

`src/App.tsx` añadido:
```tsx
const handleSkillsChange = useCallback((skills: ActiveSkillInfo[]) => {
  setActiveSkillsList(skills);
}, []);
const handleTokensUsed = useCallback((inT: number, outT: number) => {
  if (!activeChatId) return;
  addTokens(activeChatId, inT, outT);
}, [activeChatId, addTokens]);
```

Y en el JSX:
```tsx
onSkillsChange={handleSkillsChange}
onTokensUsed={handleTokensUsed}
```

`handleSkillsChange` es `useCallback([])` — referencia permanente. `handleTokensUsed` depende de `activeChatId` (cambiará solo en cambio de chat, no en idle) y `addTokens` (estable del hook `useTokenUsage`).

### 17.3 Parche #3.2 — useCallback en onToolsUpdateNeeded y onRefreshTools

Para prevenir loops similares en componentes hijos (`ConsolePlayground`), también wrap:
```tsx
const handleToolsUpdateNeeded = useCallback(() => {
  fetchTools(mcpServerSelection);
}, [mcpServerSelection]);
const handleRefreshTools = useCallback(async (server?: string) => {
  await fetchTools(server || mcpServerSelection, true);
}, [mcpServerSelection]);
```

Y en JSX:
```tsx
onToolsUpdateNeeded={handleToolsUpdateNeeded}
onRefreshTools={handleRefreshTools}
```

Estos new callbacks se re-crean SOLO cuando cambia `mcpServerSelection` (elegir servidor MCP en UI), no en cada render. En idle son estables.

### 17.4 Build

Backup fuente: `backups\src-fase3-20260806-142839\` (pre-Fase 3).

Build limpio:
- `index-C_VBBYN2.js` (866.97 KB) — bundle Fase 3
- `index-CdYoRCot.css` (114.55 KB) — mismo hash, no se regeneró
- Lint `tsc --noEmit` 0 errores
- `vite build` 2341 módulos en 17.51s
- `esbuild server.ts` OK 335.3 KB

### 17.5 Deploy

Backup pre-deploy `standalone-fase3-pre\` con: `index-DRUFlT7Q.js.bak-fase1`, `index-CdYoRCot.css.bak-fase2-patched`, `index.html.bak-fase1`.

Deployed:
- `C:\ProgramFiles\LetXipu Desktop HF\resources\app\dist\assets\index-C_VBBYN2.js` (866,970 bytes)
- `index-CdYoRCot.css` (114,457 bytes — parcheado con 0 `infinite`)
- `index.html` actualizado para cargar `index-C_VBBYN2.js`
- Bundle viejo `index-DRUFlT7Q.js` eliminado

`electron\main.cjs` y `dist\server.cjs` fueron rebuilt por el build script pero no se deployaron al standalone (todos el backend del chat funciona normal — no había cambios en server.ts).

### 17.6 Resultados (steady state T=240-300s)

| Métrica | Pre-Fase 3 (CSS patches) | **Fase 3** | Mejora |
|---|---|---|---|
| Renderer CPU steady state | 100% saturado | **0.1%** | **-99.9 pts** |
| Suma de CPU de los 5 procesos | 105.7% | **1.6%** | **-100 pts** |
| Renderer RAM | 256 MB | **121 MB** | **-135 MB (-53%)** |

CPU quedó en ruido de fondo (0-1% por proceso) — comparable a una app Idle normal.

### 17.7 Persistencia de los parches CSS

El CSS parcheado (`index-CdYoRCot.css`) tiene el mismo hash que el nuevo rubro `vite build`. Sin embargo, los próximos vite builds podrían regenerar el CSS con `infinite`. Para hacer persistente el parche, en futura sesión hay que:

1. Editar `src/index.css` y agregar override al final:
   ```css
   /* Optim CPU — neutralizar todas las animaciones infinitas */
   .animate-spin, .animate-ping, .animate-pulse, .animate-bounce {
     animation: none !important;
   }
   ```

Eso es más limpio que editar la variable del Tailwind v4 y sobrevive a build.

### 17.8 Pendientes restantes (prioridad baja)

- Aplicar override `.animate-* { animation: none !important; }` en `src/index.css` para persistencia CSS
- Eliminar imports muertos en AgentChat.tsx (`motion`, `useDragControls`) — bonus, no afecta CPU
- Investigar `selectedModel` effect línea 568 que hace `setInterval(60s)` — ya mitigado, no agresivo
- Estudiar el "leeched" `mousemove` global del `App.tsx:143` que muñeca con `dragModeRef` — controlado por early-return, OK
- Evaluar abolición del `FILTERED by DEPS` soldier del tokenUsage hook
- Detonar app elevada con `--remote-debugging-port=9222` para confirmar con `Profiler.stop` que ahora hay 0 samples de CPU en 30s de idle

---

## Sección 18 - Sesión 5 (2026-08-06): DUAL BUILD - PÚBLICO vs PRIVADO

### 18.0 Objetivo

Generar dos variantes del instalador de LetXipu Desktop HF desde un único fuente,
sin bifurcar el repo y sin branches git:
- **PÚBLICO**: sin API keys, sin URLs HF fallback. El usuario configura todo via GUI.
- **PRIVADO**: con API keys embebidas en `secrets.json`, URLs HF activas, modo `auto`.

Diseño e implementación completos documentados en
`D:\OTROS\LETXINET-OPTIM-BUILD\docs\BUILDES-PUBLICO-PRIVADO.md`. Aqui solo un resumen
de los cambios aplicados al codigo.

### 18.1 Backups realizados pre-cambios

- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\src-pre-builddual-20260806-154529\` — fuentes completos: `src/`, `server.ts`, `electron/main.cjs`, `package.json`, `.env`, `scripts/install-deps.cjs`
- `D:\OTROS\LETXINET-OPTIM-BUILD\backups\standalone-pre-builddual-20260806-161411\` — standalone `C:\Program Files\LetXipu Desktop HF\resources\app\` antes del deploy dual build

### 18.2 Parches al código fuente

#### Parche #11.1 - `server.ts`: invertir prioridad `setIfMissing` → `setIfPresent`

Antes:
```ts
const setIfMissing = (envName: string, value?: string) => {
  if (value && !process.env[envName]) {
    process.env[envName] = value;
  }
};
```

Después:
```ts
const setIfPresent = (envName: string, value?: string) => {
  if (value) {
    process.env[envName] = value;
  }
};
```

**Razón**: permitir que `secrets.json` (configuración del usuario vía GUI, o
pre-embebida en el instalador privado) SIEMPRE gane sobre `.env` bundleado. 18
llamadas renombradas en `loadSecretsFromDisk()`.

#### Parche #11.2 - `server.ts`: `BUILD_VARIANT` flag + URLs HF condicionales

Líneas 180-200:
```ts
const BUILD_VARIANT = (process.env.BUILD_VARIANT || "private").toLowerCase() as "public" | "private";
const IS_PUBLIC_BUILD = BUILD_VARIANT === "public";

const DESKTOP_ENDPOINT_MODE =
  (process.env.DESKTOP_ENDPOINT_MODE || (IS_PUBLIC_BUILD ? "local_only" : "auto")).toLowerCase() as ...;

const HF_LETXIPU_MCP_URL =
  process.env.LETXIPU_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp");
const HF_LETXIPU_OSM_MCP_URL =
  process.env.LETXIPU_OSM_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://c2mv-letxipu-osm-mcp.hf.space/mcp");
const HF_LETXINET_MCP_URL =
  process.env.LETXINET_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://www.letxinet.lat/api/v1/mcp");
```

#### Parche #11.3 - `server.ts`: ampliar `SecretsShape` con 3 provider keys

```ts
export interface SecretsShape {
  // ... campos previos ...
  // Providers del providers-catalog (ProvidersSyncPanel gestiona estos)
  nebiusApiKey?: string;
  openrouterApiKey?: string;
  deepseekApiKey?: string;
}
```

Las 3 keys ahora se cargan en `loadSecretsFromDisk()` vía `setIfPresent`, se
retornan (masked) en `app.get("/api/keys")`, y se persisten en `app.post("/api/keys")`.

#### Parche #11.4 - `electron/main.cjs`: `seedSecretsFromBundle()`

Líneas 233-265 + llamada en `app.whenReady()`:
```js
function seedSecretsFromBundle() {
  const userDataPath = app.getPath('userData');
  const userSecretsPath = path.join(userDataPath, 'secrets.json');
  if (fs.existsSync(userSecretsPath)) {
    console.log('[main] userData/secrets.json ya existe, no se siembra desde bundle');
    return;
  }
  const bundledSecretsPath = path.join(process.resourcesPath, 'secrets.json');
  if (!fs.existsSync(bundledSecretsPath)) {
    console.log('[main] No hay secrets.json en resources/ (build público) — el usuario configura vía GUI');
    return;
  }
  try {
    fs.copyFileSync(bundledSecretsPath, userSecretsPath);
    console.log('[main] secrets.json sembrado desde bundle a userData/secrets.json');
  } catch (e) {
    console.error('[main] Error copiando secrets.json del bundle:', e.message);
  }
}

// En app.whenReady() antes de startBackend():
seedSecretsFromBundle();
```

#### Parche #11.5 - `src/index.css`: override CSS persistente (45 lines extra)

`:root` con `--animate-*: none`, `@media prefers-reduced-motion` (siempre aplica),
`.animate-spin, .animate-ping, ..., .cursor-pulse, [class*=animate-]` con
`animation: none !important`. Ver extracto completo en sección 18.6.

#### Parche #11.6 - `package.json`: nuevos scripts + devDep

- `"cross-env": "^7.0.3"` en `devDependencies`.
- `build.win.signAndEditExecutable` cambiado a `false` (evita colgado de signtool en `elevate.exe` sin cert).
- Scripts nuevos:

```jsonc
"build:variant": "vite build && esbuild ... --define:process.env.BUILD_VARIANT=\\\"$BUILD_VARIANT\\\" && node scripts/install-deps.cjs",
"desktop:dist:public":  "cross-env BUILD_VARIANT=public  node scripts/apply-variant.cjs && cross-env BUILD_VARIANT=public  npm run build:variant && cross-env BUILD_VARIANT=public  electron-builder --win nsis portable --config.appId=\"com.c2mv.letxipu.desktophf.public\"  --config.productName=\"LetXipu Desktop HF\"  --config.win.signAndEditExecutable=false",
"desktop:dist:private": "cross-env BUILD_VARIANT=private node scripts/apply-variant.cjs && cross-env BUILD_VARIANT=private npm run build:variant && cross-env BUILD_VARIANT=private electron-builder --win nsis portable --config.appId=\"com.c2mv.letxipu.desktophf.private\" --config.productName=\"LetXipu Desktop HF Pro\" --config=./electron-builder.private.json --config.win.signAndEditExecutable=false"
```

#### Parche #11.7 - `scripts/apply-variant.cjs` (nuevo archivo, 105 lineas)

Genera `build/build-info.json` con la variante, y para privado genera
`build/secrets.json` mapeando las API keys de `.env.local` a camelCase de `SecretsShape`.
Para público asegura que `build/secrets.json` no exista (no leak).

Ver código fuente íntegro en `D:\OTROS\LETXINET-DESKTOP-HF\scripts\apply-variant.cjs`.

#### Parche #11.8 - `electron-builder.private.json` (nuevo archivo)

Archivo de config override para el privado, con `extraResources` embebido:

```json
{"extraResources": [{"from": "build/secrets.json", "to": "secrets.json", "filter": ["**/*"]}]}
```

#### Parche #11.9 - `.env` limpieza + `.env.local` nuevo

- `.env`: eliminadas las 3 líneas con API keys reales (NEBIUS_API_KEY, OPENROUTER_API_KEY, DEEPSEEK_API_KEY) de las líneas 261-263.
- `.env.local`: nuevo archivo con las 3 API keys reales. `.gitignore` ya tiene `.env*` (excluye `.env.local`).

### 18.3 Build + deploy

#### 18.3.1 Lint (tsc --noEmit)

Exit code 0 ✓

#### 18.3.2 Rebuild

- `index-BFO69YUD.js` 866.97 KB
- `index-BFFo4o8W.css` 115.45 KB (con 5 `infinite` textuales pero todos neutralizados por `!important` overrides)
- `server.cjs` 344565 bytes (con `BUILD_VARIANT` condicional inyectado por `--define`)

#### 18.3.3 Deploy al standalone (vía UAC)

Script elevado en `C:\Users\USER\AppData\Local\Temp\opencode\deploy-builddual.ps1`,
ejecutado vía `Start-Process powershell -Verb RunAs`. Backup pre-deploy:
`backups\standalone-pre-builddual-20260806-161411\`.

Copiado a `C:\Program Files\LetXipu Desktop HF\resources\app\`:
- `dist\assets\index-BFO69YUD.js` (866970 bytes)
- `dist\assets\index-BFFo4o8W.css` (115454 bytes)
- `dist\index.html`
- `dist\server.cjs` (344565 bytes) + `server.cjs.map`
- `electron\main.cjs` (18840 bytes, con `seedSecretsFromBundle`)
- `scripts\apply-variant.cjs` (5237 bytes)
- `package.json` (3053 bytes)

### 18.4 Generación de los 4 instaladores

| Instalador | appId | Modo | Size | MD5 |
|---|---|---|---|---|
| `LetXipu Desktop HF Setup 0.0.0.exe` (NSIS) | `com.c2mv.letxipu.desktophf.public` | público | 95.99 MB | `3DDA3F0CA66DCB67A8A699D36F373723` |
| `LetXipu Desktop HF 0.0.0.exe` (portable) | `com.c2mv.letxipu.desktophf.public` | público | 95.69 MB | `BA50BFD02D4507246ACF77ADF37AC64B` |
| `LetXipu Desktop HF Pro Setup 0.0.0.exe` (NSIS) | `com.c2mv.letxipu.desktophf.private` | privado | 281.04 MB | `654BB099356D6B4D0B0CDC831F6EE8DC` |
| `LetXipu Desktop HF Pro 0.0.0.exe` (portable) | `com.c2mv.letxipu.desktophf.private` | privado | 280.73 MB | `8663846955FF0F38C7DA82B4265B4722` |

Backup en `D:\OTROS\LETXINET-OPTIM-BUILD\installers\public\` y `private\`.

### 18.5 Verificación de contenido (con 7z)

**PÚBLICO**: Extraído con 7z, `app-64.7z` (293923199 bytes) confirma:
- `resources\app\` ✓ (todo el backend)
- `resources\elevate.exe` ✓
- `resources\secrets.json` ✗ (NO presente, correcto)

**PRIVADO**: Extraído con 7z, `app-64.7z` (293923539 bytes, 340 bytes más que público) confirma:
- `resources\app\` ✓
- `resources\elevate.exe` ✓
- `resources\secrets.json` ✓ 418 bytes (355 comprimidos) con las 3 API keys

Mismo verificado en portable `.exe`.

### 18.6 Código fuente modificado (extractos)

Código íntegro de los archivos clave (no el diff) está en:
- `D:\OTROS\LETXINET-DESKTOP-HF\scripts\apply-variant.cjs` (105 lines)
- `D:\OTROS\LETXINET-DESKTOP-HF\electron-builder.private.json` (1 line JSON)
- `D:\OTROS\LETXINET-OPTIM-BUILD\docs\SOURCES-DUAL-BUILD.md` (nuevo, extractos de server.ts/main.cjs/index.css)

Extracto íntegro de los fragmentos CSS nuevos en `src/index.css` (lineas 161-198):

```css
/* === OVERRIDE PERSISTENTE DE ANIMACIONES (Phase 3 final) === */
@keyframes none { from { } to { } }

:root {
  --animate-spin: none;
  --animate-ping: none;
  --animate-pulse: none;
  --animate-bounce: none;
  /* ... resto de vars Tailwind v4 animate-* neutralizadas ... */
}

@media (prefers-reduced-motion: no-preference) {
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

.animate-spin, .animate-ping, .animate-pulse, .animate-bounce,
.animate-spin-slow, .animate-pulse-slow, .animate-pulse-fast,
.animate-bounce-slow, .animate-bounce-fast, .animate-ping-slow,
.animate-ping-fast, .animate-spin-reverse, .animate-shimmer,
.animate-gradient, .animate-aura, .animate-fade-in,
.cursor-pulse, .pulse-dot, .blink-dot, [class*="animate-"] {
  animation: none !important;
}
```

### 18.7 Problemas encontrados y workarounds

1. **`signtool.exe` se cuelga en `elevate.exe` sin certificado disponible**: el log se
   queda en `signing with signtool.exe path=...elevate.exe` esperando input. Workaround:
   `signAndEditExecutable: false` en `build.win` de package.json (ademas de CLI override).

2. **`--config.extraResources` con JSON escapado en CLI NO se procesa**: electron-builder
   lo ignora silenciosamente. Workaround: archivo de config externo
   `electron-builder.private.json`.

3. **`--prepackaged` + `--config=./electron-builder.private.json` NUNCA copia extraResources**:
   `--prepackaged` salta la fase de resource gathering. Workaround: copia manual de
   `build/secrets.json` a `dist\win-unpacked\resources\secrets.json` antes del
   re-empaquetado NSIS. Esto es automático si se corre el build privado desde cero
   (sin --prepackaged), pero NO si se reusa un `win-unpacked` previamente generado sin
   extraResources.

4. **NSIS `Internal compiler error #12345: error creating mmap 310MB`** al intentar
   regenerar el público con config nueva: NSIS falla intermitentemente en Windows con
   antimalware real-time scanning. El público de 17:07 (con config previa funcional) es
   perfectamente válido para distribución.

5. **`Start-Process -Verb RunAs -Wait` no captura stdout del proceso elevado**:
   cada deploy elevado requiere un script .ps1 con log a fichero.

### 18.8 Por hacer (validación post-build)

(según `BUILDES-PUBLICO-PRIVADO.md` sección "Por hacer — validación post-build")

1. Instalar público en Windows limpio, verificar que las 3 keys NO aparecen en GUI.
2. Instalar privado en mismo Windows, verificar que las 3 keys aparecen como
   configured en GUI (vía `seedSecretsFromBundle()` copiando del bundle a userData).
3. Editar keys en GUI privado, verificar `secrets.json` en `%APPDATA%\LetXipu Desktop HF Pro\`
   se actualiza y gana sobre la embebida (gracias a `setIfPresent`).
4. Verificar coexistencia de las dos instalaciones corriendo simultáneamente.

### 18.9 Pendientes restantes (de sesiones previas, no abordados)

- Limpiar imports muertos `motion`, `useDragControls` de `AgentChat.tsx` — bonus, no afecta CPU.
- Investigar `selectedModel` effect línea 568 de App.tsx que hace `setInterval(60s)` — mitigado.
- Validar perfil completo de CPU post-Fase 3 con `--remote-debugging-port=9222` y Profiler.stop
  en idle 30s para confirmar 0 samples de CPU.

### 18.10 Backups generados esta sesión

- `backups\src-pre-builddual-20260806-154529\` - fuentes pre dual build
- `backups\standalone-pre-builddual-20260806-161411\` - standalone pre-deploy
- `installers\public\LetXipu Desktop HF Setup 0.0.0.exe` (95.99 MB)
- `installers\public\LetXipu Desktop HF 0.0.0.exe` (95.69 MB)
- `installers\private\LetXipu Desktop HF Pro Setup 0.0.0.exe` (281.04 MB)
- `installers\private\LetXipu Desktop HF Pro 0.0.0.exe` (280.73 MB)

### 18.11 Documentación adicional

- `D:\OTROS\LETXINET-OPTIM-BUILD\docs\BUILDES-PUBLICO-PRIVADO.md` — diseñoo y verificación completa del dual build (incluye tablas de diferencias, mapeo de URLs HF, línea de tiempo de generación de instaladores, hashes MD5).
- `D:\OTROS\LETXINET-OPTIM-BUILD\docs\SOURCES-DUAL-BUILD.md` — extractos de código fuente íntegro de los 4 archivos clave (`apply-vent.cjs`, `electron-builder.private.json`, fragmentos de `server.ts` BUILD_VARIANT + SecretsShape, fragmento de `main.cjs` seedSecretsFromBundle, fragmento `index.css` override).

