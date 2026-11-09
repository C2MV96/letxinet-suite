# Sources - Dual Build (Publico vs Privado)

**Sesion:** 5 - Jue 06 Ago 2026
**Repositorio dev:** `D:\OTROS\LETXINET-DESKTOP-HF\`
**Documento acompanante:** `BUILDES-PUBLICO-PRIVADO.md` (diseno y verificacion)
**Resumen en:** `CAMBIOS-APLICADOS.md` seccion 18

---

Este archivo agrupa los **extractos integros** del codigo fuente modificado
para el dual build (publico/privado). Cada extracto muestra el codigo tal cual
queda en el repo dev tras la Sesion 5.

## 1. `scripts/apply-variant.cjs` (nuevo archivo, 105 lineas)

```js
/**
 * scripts/apply-variant.cjs
 * =============================================================================
 * Pre-build variant preparator for LetXipu Desktop HF.
 * Reads process.env.BUILD_VARIANT ("public" | "private") and:
 *   1. Writes the variant tag to a build-info.json consumed by vite/esbuild.
 *   2. For private: ensures build/secrets.json exists (will be copied as
 *      extraResources into the installer so the user gets pre-populated keys).
 *   3. For public: ensures build/secrets.json does NOT exist (no extraResources
 *      leak). Public users configure keys via ProvidersSyncPanel GUI.
 *   4. Patches package.json build.appId/productName in-memory for the current
 *      electron-builder invocation (does NOT modify the source package.json).
 *
 * Usage:
 *   cross-env BUILD_VARIANT=public node scripts/apply-variant.cjs
 *   cross-env BUILD_VARIANT=private node scripts/apply-variant.cjs
 *
 * Default variant: private (back-compat with existing builds).
 * =============================================================================
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const VARIANT = (process.env.BUILD_VARIANT || 'private').toLowerCase();
const IS_PUBLIC = VARIANT === 'public';

if (!['public', 'private'].includes(VARIANT)) {
  console.error('[apply-variant] Invalid BUILD_VARIANT="' + VARIANT + '". Must be public|private.');
  process.exit(1);
}

console.log(`[apply-variant] Variant: ${VARIANT.toUpperCase()}`);

// --- 1. Write build-info.json (consumed by vite via import.meta.env) -------
const buildInfo = {
  variant: VARIANT,
  isPublic: IS_PUBLIC,
  builtAt: new Date().toISOString(),
};
const buildInfoPath = path.join(root, 'build', 'build-info.json');
fs.mkdirSync(path.dirname(buildInfoPath), { recursive: true });
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
console.log(`[apply-variant] Wrote ${buildInfoPath}`);

// --- 2. Handle secrets.json for private build -------------------------------
const buildSecretsPath = path.join(root, 'build', 'secrets.json');
const sourceEnvLocal = path.join(root, '.env.local');

if (IS_PUBLIC) {
  // PUBLIC: ensure no secrets.json in build/ (no leak)
  if (fs.existsSync(buildSecretsPath)) {
    fs.unlinkSync(buildSecretsPath);
    console.log('[apply-variant] Removed build/secrets.json (public build - no keys embedded)');
  } else {
    console.log('[apply-variant] No build/secrets.json present (public build - confirmed)');
  }
} else {
  // PRIVATE: generate build/secrets.json from .env.local IF present.
  // The .env.local values are written to secrets.json so the installer can
  // ship pre-populated keys (via electron-builder extraResources).
  // secrets.json keys use the SecretsShape field names (camelCase), not
  // the env var names (UPPER_SNAKE). Mapping below.
  if (fs.existsSync(sourceEnvLocal)) {
    const envContent = fs.readFileSync(sourceEnvLocal, 'utf8');
    const envVars = {};
    envContent.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !line.trim().startsWith('#')) envVars[m[1]] = m[2];
    });

    // Map .env.local env var names -> SecretsShape fields (see server.ts SecretsShape).
    // Only the 3 provider keys that .env.local currently holds. Other keys
    // (GEMINI, ANTHROPIC, OPENAI, GROQ, MISTRAL, NVIDIA, OPENCODE, plus all
    // academic sources keys) are left undefined here - the operator can
    // pre-fill them manually in build/secrets.json if desired.
    const secrets = {};
    if (envVars.NEBIUS_API_KEY)       secrets.nebiusApiKey       = envVars.NEBIUS_API_KEY;
    if (envVars.OPENROUTER_API_KEY)   secrets.openrouterApiKey   = envVars.OPENROUTER_API_KEY;
    if (envVars.DEEPSEEK_API_KEY)     secrets.deepseekApiKey     = envVars.DEEPSEEK_API_KEY;

    fs.writeFileSync(buildSecretsPath, JSON.stringify(secrets, null, 2));
    const filled = Object.keys(secrets).length;
    console.log(`[apply-variant] Wrote ${buildSecretsPath} (private build - ${filled} provider key(s) embedded)`);
    if (filled === 0) {
      console.log('[apply-variant] NOTE: No provider keys found in .env.local - secrets.json will be empty.');
    }
  } else {
    console.log('[apply-variant] No .env.local found (private build - secrets.json will not be pre-populated)');
    if (!fs.existsSync(buildSecretsPath)) {
      fs.writeFileSync(buildSecretsPath, JSON.stringify({}, null, 2));
    }
  }
}

// --- 3. Patch package.json build.appId/productName in-memory ---------------
// We do NOT modify the source package.json - electron-builder reads
// package.json at runtime. Instead, we override via CLI flags passed
// to electron-builder in the npm script:
//   --config.appId=... --config.productName=...
// So this script does NOT touch package.json. We just log the recommended flag.
const appId = IS_PUBLIC ? 'com.c2mv.letxipu.desktophf.public' : 'com.c2mv.letxipu.desktophf.private';
const productName = IS_PUBLIC ? 'LetXipu Desktop HF' : 'LetXipu Desktop HF Pro';
console.log(`[apply-variant] electron-builder will use appId="${appId}" productName="${productName}"`);
console.log('[apply-variant] Done.');
```

## 2. `electron-builder.private.json` (nuevo archivo, 1 linea)

```json
{"extraResources": [{"from": "build/secrets.json", "to": "secrets.json", "filter": ["**/*"]}]}
```

## 3. `package.json` (scripts y build section)

Solo se listar las partes modificadas en la Sesion 5:

### 3.1 Scripts (lineas 7-17)

```jsonc
"scripts": {
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs --define:process.env.NODE_ENV='\"production\"' && node scripts/install-deps.cjs",
  "build:variant": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs --define:process.env.NODE_ENV='\"production\"' --define:process.env.BUILD_VARIANT=\\\"$BUILD_VARIANT\\\" && node scripts/install-deps.cjs",
  "start": "node dist/server.cjs",
  "lint": "tsc --noEmit",
  "desktop:start": "npm run build && electron .",
  "desktop:dist": "npm run build && electron-builder --win nsis portable --config.win.signAndEditExecutable=false",
  "desktop:dist:public": "cross-env BUILD_VARIANT=public node scripts/apply-variant.cjs && cross-env BUILD_VARIANT=public npm run build:variant && cross-env BUILD_VARIANT=public electron-builder --win nsis portable --config.appId=\"com.c2mv.letxipu.desktophf.public\" --config.productName=\"LetXipu Desktop HF\" --config.win.signAndEditExecutable=false",
  "desktop:dist:private": "cross-env BUILD_VARIANT=private node scripts/apply-variant.cjs && cross-env BUILD_VARIANT=private npm run build:variant && cross-env BUILD_VARIANT=private electron-builder --win nsis portable --config.appId=\"com.c2mv.letxipu.desktophf.private\" --config.productName=\"LetXipu Desktop HF Pro\" --config=./electron-builder.private.json --config.win.signAndEditExecutable=false"
}
```

### 3.2 devDependencies (cross-env anadido)

```jsonc
"devDependencies": {
  "@types/express": "^4.17.21",
  "@types/node": "^22.14.0",
  "@types/pdf-parse": "^1.1.5",
  "autoprefixer": "^10.4.21",
  "cross-env": "^7.0.3",          // ← nuevo
  "electron": "^37.2.5",
  "electron-builder": "^26.0.12",
  "esbuild": "^0.25.0",
  "tailwindcss": "^4.1.14",
  "tsx": "^4.21.0",
  "typescript": "~5.8.2",
  "vite": "^6.2.3"
}
```

### 3.3 build section (signAndEditExecutable cambiado a false)

```jsonc
"build": {
  "appId": "com.c2mv.letxipu.desktophf",
  "productName": "LetXipu Desktop HF",
  "asar": false,
  "files": [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "build/icon.ico",
    "signAndEditExecutable": false,      // ← cambiado de true a false
    "signExecutable": false,
    "forceCodeSigning": false
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

## 4. `server.ts` (extractos modificado)

### 4.1 `setIfPresent` + loadSecretsFromDisk inicio (lineas 73-122)

```ts
function loadSecretsFromDisk(): void {
  try {
    const secretsPath = getSecretsFilePath();
    if (fs.existsSync(secretsPath)) {
      const raw = fs.readFileSync(secretsPath, "utf8");
      const data = JSON.parse(raw || "{}");
      if (data && typeof data === "object") {
        // setIfPresent: secrets.json (GUI-configured) ALWAYS wins over .env bundled
        // defaults. This lets the user override pre-embedded private keys via
        // ProvidersSyncPanel without editing files. Previous setIfMissing caused
        // .env bundled keys to be immutable from the UI.
        const setIfPresent = (envName: string, value?: string) => {
          if (value) {
            process.env[envName] = value;
          }
        };
        // IA + MCP classicas (already handled)
        setIfPresent("MCP_API_KEY", data.mcpApiKey);
        setIfPresent("GEMINI_API_KEY", data.geminiApiKey);
        setIfPresent("MISTRAL_API_KEY", data.mistralApiKey);
        setIfPresent("NVIDIA_API_KEY", data.nvidiaApiKey);
        setIfPresent("OPENCODE_API_KEY", data.opencodeApiKey);
        // IA adicionales (anthropic, openai, groq)
        setIfPresent("ANTHROPIC_API_KEY", data.anthropicApiKey);
        setIfPresent("ANTHROPIC_TOKEN", data.anthropicApiKey); // alias
        setIfPresent("OPENAI_API_KEY", data.openaiApiKey);
        setIfPresent("OPENAI_TOKEN", data.openaiApiKey); // alias
        setIfPresent("GROQ_API_KEY", data.groqApiKey);
        setIfPresent("GROQ_TOKEN", data.groqApiKey); // alias
        // Providers del providers-catalog (Nebius / OpenRouter / DeepSeek direct)
        setIfPresent("NEBIUS_API_KEY", data.nebiusApiKey);
        setIfPresent("OPENROUTER_API_KEY", data.openrouterApiKey);
        setIfPresent("DEEPSEEK_API_KEY", data.deepseekApiKey);
        // Sources academicas
        setIfPresent("MINERU_API_KEY", data.mineruApiKey);
        setIfPresent("HF_TOKEN", data.hfToken);
        setIfPresent("SERP_API_KEY", data.serpApiKey);
        setIfPresent("SERPAPI_KEY", data.serpApiKey); // alias
        setIfPresent("CORE_API_KEY", data.coreApiKey);
        setIfPresent("SEMANTIC_SCHOLAR_API_KEY", data.semanticScholarApiKey);
        setIfPresent("SCOPUS_API_KEY", data.scopusApiKey);
        setIfPresent("REDALYC_TOKEN", data.redalycToken);
        setIfPresent("UNPAYWALL_EMAIL", data.unpaywallEmail);
        setIfPresent("OSM_USER_AGENT", data.osmUserAgent);
      }
    }
  } catch (err: any) {
    console.error("[secrets] Failed to load from disk:", err.message);
  }
}
```

### 4.2 `SecretsShape` (lineas 116-148)

```ts
// API keys shape persisted to userData/secrets.json. Both the IA set (legacy
// 5 + Anthropic/OpenAI/Groq) and the academic/sources set, plus the
// providers-catalog keys (Nebius/OpenRouter/DeepSeek). All keys managed from
// ProvidersSyncPanel / ApiKeysConfig GUI are persisted here so they survive
// restarts and can be pre-embedded in the private installer.
export interface SecretsShape {
  // IA classicas
  mcpApiKey?: string;
  geminiApiKey?: string;
  mistralApiKey?: string;
  nvidiaApiKey?: string;
  opencodeApiKey?: string;
  // IA adicionales
  anthropicApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  // Proveedores del providers-catalog (la GUI ProvidersSyncPanel gestiona estos)
  nebiusApiKey?: string;
  openrouterApiKey?: string;
  deepseekApiKey?: string;
  // Sources academicas
  mineruApiKey?: string;
  hfToken?: string;
  serpApiKey?: string;
  coreApiKey?: string;
  semanticScholarApiKey?: string;
  scopusApiKey?: string;
  redalycToken?: string;
  unpaywallEmail?: string;
  osmUserAgent?: string;
}
```

### 4.3 `BUILD_VARIANT` + URLs HF condicionales (lineas 192-210)

```ts
// Check if secrets/environment variables are present
// NOTE: declared as `let` so runtime key updates from /api/keys take effect.
// loadSecretsFromDisk() reads persisted keys BEFORE these declarations so
// the values are populated from userData/secrets.json in desktop builds.
loadSecretsFromDisk();
let mcpApiKey = process.env.MCP_API_KEY || "";
let geminiApiKey = process.env.GEMINI_API_KEY || "";
let mistralApiKey = process.env.MISTRAL_API_KEY || "";

// Endpoint selection mode (LetXinet Suite):
//   "auto"        - local first, fall back to remote HF on failure (default)
//   "local_only"  - only the local MCP-V11 on 127.0.0.1:4003
//   "remote_only" - only the remote HF/letxinet.lat
//   "hf_only"     - legacy: hard-coded HF (back-compat with DESKTOP_HF_ONLY=1)
// =============================================================================
// Build variant: "public" | "private" (default: private for back-compat)
// Injected by scripts/apply-variant.cjs at build time. Public builds ship
// with NO hardcoded HF fallback URLs and default to local_only mode so the
// user must explicitly opt-in to remote endpoints. Private builds keep the
// legacy HF fallback URLs active (auto mode).
// =============================================================================
const BUILD_VARIANT = (process.env.BUILD_VARIANT || "private").toLowerCase() as
  "public" | "private";
const IS_PUBLIC_BUILD = BUILD_VARIANT === "public";
const DESKTOP_ENDPOINT_MODE =
  (process.env.DESKTOP_ENDPOINT_MODE || (IS_PUBLIC_BUILD ? "local_only" : "auto")).toLowerCase() as
    "auto" | "local_only" | "remote_only" | "hf_only";
const HF_ONLY_MODE =
  process.env.DESKTOP_HF_ONLY === "1" ||
  DESKTOP_ENDPOINT_MODE === "hf_only";

// LetXinet Suite: externalize remote endpoints via env, fall back to public HF.
// Operators can point at self-hosted mirrors by editing shared-env/LetXinet-Suite.env.
// Public builds: NO hardcoded HF URLs (empty fallback). Private builds: legacy HF defaults.
const HF_LETXIPU_MCP_URL =
  process.env.LETXIPU_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://C2MV-letxipu-search-mcp-v9.hf.space/api/mcp");
const HF_LETXIPU_OSM_MCP_URL =
  process.env.LETXIPU_OSM_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://c2mv-letxipu-osm-mcp.hf.space/mcp");
const HF_LETXINET_MCP_URL =
  process.env.LETXINET_MCP_URL || (IS_PUBLIC_BUILD ? "" : "https://www.letxinet.lat/api/v1/mcp");
```

### 4.4 `GET /api/keys` - respuesta con las 3 nuevas (lineas 3310-3350)

Extracto abreviado de la seccion relevante:

```ts
app.get("/api/keys", (_req, res) => {
  res.json({
    // ... masked keys IA clasicas y academicas ...
    nebiusApiKey: maskKey(process.env.NEBIUS_API_KEY || ""),
    openrouterApiKey: maskKey(process.env.OPENROUTER_API_KEY || ""),
    deepseekApiKey: maskKey(process.env.DEEPSEEK_API_KEY || ""),
    // ... configured flags ...
    nebiusApiKeyConfigured: !!process.env.NEBIUS_API_KEY,
    openrouterApiKeyConfigured: !!process.env.OPENROUTER_API_KEY,
    deepseekApiKeyConfigured: !!process.env.DEEPSEEK_API_KEY,
    // ...
  });
});
```

### 4.5 `POST /api/keys` - applyKey de las 3 nuevas (lineas 3404-3406, 3434-3436)

```ts
app.post("/api/keys", (req, res) => {
  // ... applyKey para clasicas y academicas ...
  applyKey("nebiusApiKey", "NEBIUS_API_KEY");
  applyKey("openrouterApiKey", "OPENROUTER_API_KEY");
  applyKey("deepseekApiKey", "DEEPSEEK_API_KEY");
  // ...

  // Persisted to secrets.json
  const persisted: SecretsShape = {
    // ... campos clasicos y academicas ...
    nebiusApiKey: newKeys.nebiusApiKey !== undefined ? newKeys.nebiusApiKey : (process.env.NEBIUS_API_KEY || ""),
    openrouterApiKey: newKeys.openrouterApiKey !== undefined ? newKeys.openrouterApiKey : (process.env.OPENROUTER_API_KEY || ""),
    deepseekApiKey: newKeys.deepseekApiKey !== undefined ? newKeys.deepseekApiKey : (process.env.DEEPSEEK_API_KEY || ""),
  };
  // ... saveSecretsToDisk(persisted); ...
});
```

## 5. `electron/main.cjs` - `seedSecretsFromBundle()` (lineas 233-265)

```js
// Private build seeding: if the installer ships with a pre-populated
// secrets.json (placed at resources/secrets.json via electron-builder
// extraResources), copy it to userData on first launch so the backend gets
// the embedded API keys (Nebius/OpenRouter/DeepSeek) without GUI input.
// If userData/secrets.json already exists (user already configured keys
// via ProvidersSyncPanel), do NOT overwrite - user config wins.
function seedSecretsFromBundle() {
  try {
    const userData = app.getPath('userData');
    const targetPath = path.join(userData, 'secrets.json');
    // extraResources places the file at {resourcesPath}/secrets.json
    const bundlePath = path.join(process.resourcesPath, 'secrets.json');
    if (!fs.existsSync(bundlePath)) {
      return; // public build or private build without secrets - nothing to seed
    }
    if (fs.existsSync(targetPath)) {
      trace(`[secrets] userData/secrets.json already exists - skipping bundle seed (user config wins)`);
      return;
    }
    const raw = fs.readFileSync(bundlePath, 'utf8');
    // Sanity check: ensure it's valid JSON before propagating
    JSON.parse(raw || '{}');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(targetPath, raw, 'utf8');
    trace(`[secrets] Seeded userData/secrets.json from bundle (${raw.length} bytes)`);
  } catch (e) {
    trace(`[secrets] seedSecretsFromBundle error: ${e.message}`);
  }
}
```

### 5.1 Llamada en `app.whenReady()` (linea 400)

```js
app.whenReady().then(async () => {
  try {
    trace('Electron ready');
    // ... traces ...
    // ... probe si backend ya esta corriendo en APP_PORT ...

    if (!alreadyHealthy) {
      seedSecretsFromBundle();  // private build: pre-populate userData/secrets.json from bundle
      startBackend();
      await waitForBackend();
    }
    trace('Backend healthy');
    // ... createWindow(); ...
```

## 6. `src/index.css` - override persistente (lineas 161-198)

```css
/* === OVERRIDE PERSISTENTE DE ANIMACIONES (Phase 3 final) ===
 * Neutraliza todas las animaciones infinitas que consumian CPU en background.
 * Las 5 apariciones textuales de "infinite" en el CSS bundle son en vars de
 * Tailwind v4 (--animate-spin: spin 1s linear infinite, etc.), pero son
 * IGNORADAS a runtime por el !important del override (.animate-spin
 * { animation: none !important } aparece despues en la cascada y por
 * especificidad+cascada gana).
 */
@keyframes none { from { } to { } }

:root {
  --animate-spin: none;
  --animate-ping: none;
  --animate-pulse: none;
  --animate-bounce: none;
  --animate-spin-slow: none;
  --animate-pulse-slow: none;
  --animate-pulse-fast: none;
  --animate-bounce-slow: none;
  --animate-bounce-fast: none;
  --animate-ping-slow: none;
  --animate-ping-fast: none;
  --animate-spin-reverse: none;
  --animate-shimmer: none;
  --animate-gradient: none;
  --animate-aura: none;
  --animate-fade-in: none;
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

## 7. `.env` (limpieza) y `.env.local` (nuevo)

### 7.1 `.env` - lineas eliminadas (261-263 en backup pre-Sesion 5)

```
# ELIMINADAS:
NEBIUS_API_KEY=v1.CmQKH...     (movido a .env.local)
OPENROUTER_API_KEY=sk-or-...   (movido a .env.local)
DEEPSEEK_API_KEY=sk-bfda...    (movido a .env.local)
```

El resto del `.env` queda como template (placeholders vacios o defaults).

### 7.2 `.env.local` (nuevo, gitignored)

```
# .env.local - API keys reales del operador (NO entra en git ni en el installer).
# Este archivo es consumido por scripts/apply-variant.cjs en builds privados, no por dotenv.
NEBIUS_API_KEY=v1.CmQKH...
OPENROUTER_API_KEY=sk-or-v1-0...
DEEPSEEK_API_KEY=sk-bfdafe7...
```

### 7.3 `.gitignore` (lineas 7-8, sin cambios)

```
.env*
!.env.example
```

`.env*` catch-all excluye `.env.local`. `!.env.example` exception para template.

## 8. Verificacion de coherencia de nombres (camelCase vs UPPER_SNAKE)

| Lugar | Nombre usado | Tipo |
|---|---|---|
| `server.ts` SecretsShape | `nebiusApiKey`, `openrouterApiKey`, `deepseekApiKey` | camelCase |
| `server.ts` setIfPresent | `NEBIUS_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` | UPPER_SNAKE env |
| `server.ts` GET/POST /api/keys (body) | `nebiusApiKey`, `openrouterApiKey`, `deepseekApiKey` | camelCase |
| `apply-variant.cjs` (genera `build/secrets.json`) | `nebiusApiKey`, `openrouterApiKey`, `deepseekApiKey` | camelCase |
| `main.cjs` seedSecretsFromBundle (copia tal cual) | (pasa el JSON sin modificar) | identidad |
| `electron-builder.private.json` extraResources | `from: build/secrets.json` (filename) | filename |
| `ProvidersSyncPanel` GUI (React) | `nebiusApiKey`, `openrouterApiKey`, `deepseekApiKey` | camelCase |

Mapeo conclusion: `.env.local` usa UPPER_SNAKE (lineas NEBIUS_API_KEY=...). `apply-variant.cjs` los transforma a camelCase cuando escribe `build/secrets.json`. El backend (`server.ts`) espera camelCase en `secrets.json` (SecretsShape), y los mapea a UPPER_SNAKE via `setIfPresent` para `process.env`.

## 9. Linea de tiempo de los cambios

| Hora | Accion |
|---|---|
| 15:45 | Backup fuentes pre-builddual: `backups/src-pre-builddual-20260806-154529/` |
| 15:50 | Limpieza `.env`, creacion `.env.local` |
| 15:55 | `server.ts`: `setIfMissing` -> `setIfPresent` (18 llamadas) |
| 16:00 | `server.ts`: `BUILD_VARIANT` + `IS_PUBLIC_BUILD` + 3 URLs HF condicionales |
| 16:03 | `server.ts`: `SecretsShape` ampliado + GET/POST `/api/keys` con 3 keys nuevas |
| 16:05 | `electron/main.cjs`: `seedSecretsFromBundle()` (lineas 233-265) |
| 16:08 | `src/index.css`: override CSS persistente (45 lineas) |
| 16:10 | `scripts/apply-variant.cjs` creado |
| 16:12 | `electron-builder.private.json` creado |
| 16:14 | `package.json`: nuevos scripts + `cross-env` devDep + `signAndEditExecutable=false` |
| 16:15 | `npm run lint` -> 0 errores |
| 16:18 | Deploy elevado al standalone: `backups/standalone-pre-builddual-20260806-161411/` |
| 16:18 | Copia assets + server.cjs + main.cjs + apply-variant.cjs + package.json |
| 16:26 | Build publico start |
| 17:07 | **Instaladores PUBLICOS generados**: 95.99 MB NSIS + 95.69 MB portable |
| 17:08 | Build privado start |
| 17:27 | Instaladores privados generados (SIN secrets.json embebido - bug encontrado) |
| 17:30 | Investigacion: 7z confirmo secrets.json ausente en app-64.7z |
| 17:48 | Workaround: copia manual `build/secrets.json` a `win-unpacked/resources/` antes de NSIS |
| 18:01 | Rebuild privado con --prepackaged + signtool fix (`signAndEditExecutable=false`) |
| 18:22 | **Instaladores PRIVADOS finales con secrets.json embebido**: 281.04 MB + 280.73 MB |
| 18:46 | (Intento de regenerar publico con config nueva - fallo NSIS intermitente, conservados los de 17:07) |

## 10. Estado final de archivos fuente

| Archivo | Tamaño | Estado |
|---|---|---|
| `D:\OTROS\LETXINET-DESKTOP-HF\scripts\apply-variant.cjs` | 5237 bytes | ✓ creado |
| `D:\OTROS\LETXINET-DESKTOP-HF\electron-builder.private.json` | 110 bytes | ✓ creado |
| `D:\OTROS\LETXINET-DESKTOP-HF\server.ts` | (no medido) | ✓ modificado (setIfPresent, BUILD_VARIANT, SecretsShape) |
| `D:\OTROS\LETXINET-DESKTOP-HF\electron\main.cjs` | 18840 bytes | ✓ modificado (seedSecretsFromBundle) |
| `D:\OTROS\LETXINET-DESKTOP-HF\src\index.css` | 115454 bytes (CSS final) | ✓ modificado (override persistente) |
| `D:\OTROS\LETXINET-DESKTOP-HF\package.json` | 3053 bytes | ✓ modificado (scripts + cross-env + win.signAndEditExecutable=false) |
| `D:\OTROS\LETXINET-DESKTOP-HF\.env` | (reducido) | ✓ limpiado (3 API keys removidas) |
| `D:\OTROS\LETXINET-DESKTOP-HF\.env.local` | (pequeno) | ✓ creado (3 API keys reales) |

## 11. Backup final de fuentes (post-Sesion 5)

Carpeta: `D:\OTROS\LETXINET-OPTIM-BUILD\backups\src-post-builddual-20260806-183000\` (a crear)

Fuentes a respaldar:
- `src/` (con App.tsx Fase 3 + AgentChat.tsx + index.css override persistente)
- `server.ts`
- `electron/main.cjs`
- `scripts/apply-variant.cjs`
- `electron-builder.private.json`
- `package.json`
- `.env` (limpio)
- `.env.local` (con keys reales - este no se comparte, solo backup local del operador)
