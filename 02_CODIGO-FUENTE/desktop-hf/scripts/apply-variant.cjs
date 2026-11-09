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
    console.log('[apply-variant] Removed build/secrets.json (public build — no keys embedded)');
  } else {
    console.log('[apply-variant] No build/secrets.json present (public build — confirmed)');
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
    // academic sources keys) are left undefined here — the operator can
    // pre-fill them manually in build/secrets.json if desired.
    const secrets = {};
    if (envVars.NEBIUS_API_KEY)       secrets.nebiusApiKey       = envVars.NEBIUS_API_KEY;
    if (envVars.OPENROUTER_API_KEY)   secrets.openrouterApiKey   = envVars.OPENROUTER_API_KEY;
    if (envVars.DEEPSEEK_API_KEY)     secrets.deepseekApiKey     = envVars.DEEPSEEK_API_KEY;

    fs.writeFileSync(buildSecretsPath, JSON.stringify(secrets, null, 2));
    const filled = Object.keys(secrets).length;
    console.log(`[apply-variant] Wrote ${buildSecretsPath} (private build — ${filled} provider key(s) embedded)`);
    if (filled === 0) {
      console.log('[apply-variant] NOTE: No provider keys found in .env.local — secrets.json will be empty.');
    }
  } else {
    console.log('[apply-variant] No .env.local found (private build — secrets.json will not be pre-populated)');
    if (!fs.existsSync(buildSecretsPath)) {
      fs.writeFileSync(buildSecretsPath, JSON.stringify({}, null, 2));
    }
  }
}

// --- 3. Patch package.json build.appId/productName in-memory ---------------
// We do NOT modify the source package.json — electron-builder reads
// package.json at runtime. Instead, we override via CLI flags passed
// to electron-builder in the npm script:
//   --config.appId=... --config.productName=...
// So this script does NOT touch package.json. We just log the recommended flag.
const appId = IS_PUBLIC ? 'com.c2mv.letxipu.desktophf.public' : 'com.c2mv.letxipu.desktophf.private';
const productName = IS_PUBLIC ? 'LetXipu Desktop HF' : 'LetXipu Desktop HF Pro';
console.log(`[apply-variant] electron-builder will use appId="${appId}" productName="${productName}"`);
console.log('[apply-variant] Done.');
