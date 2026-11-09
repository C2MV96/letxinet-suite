const { app, BrowserWindow, dialog, utilityProcess } = require('electron');
  const spawn = require('child_process').spawn;
const path = require('path');
const http = require('http');
const fs = require('fs');
const net = require('net');

const startupLog = path.join(process.env.TEMP || process.cwd(), 'letxipu-desktop-main.log');
function trace(message) {
  try { fs.appendFileSync(startupLog, `[${new Date().toISOString()}] ${message}\n`); } catch (_) {}
}
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
  trace('Electron main loaded');

const APP_PORT = Number(process.env.LETXIPU_DESKTOP_PORT || 43123);
let backend;
let mainWindow = null;
let startupWindow = null;
let backendStartedSuccessfully = false;

// -----------------------------------------------------------------------------
// Single-instance lock: if another instance is already running, focus the
// existing window and quit this second one. This avoids EADDRINUSE because
// the backend (port 43123) is only ever bound by the first instance.
// -----------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  trace('Single-instance lock not acquired; another instance is running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    trace('second-instance event received; focusing existing window.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// -----------------------------------------------------------------------------
// Probe whether the backend port is already listening (zombie backend from a
// prior crashed instance). Returns true if free.
// -----------------------------------------------------------------------------
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => { tester.close(() => resolve(true)); });
    tester.listen(port, '127.0.0.1');
  });
}

// LetXinet Suite 1.1.4: antes esperaba 2 minutos. En laptops lentas, o en el primer arranque
// mientras el antivirus revisa los archivos, el backend tarda mas y la app se cerraba con
// "The desktop backend did not start in time". Ahora espera hasta 10 minutos.
const BACKEND_TIMEOUT_MS = Number(process.env.LETXIPU_BACKEND_TIMEOUT_MS || 600000);

// Ventana pequena de "Iniciando..." mientras arranca el backend, para que no parezca colgada.
function showStartupWindow() {
  try {
    const w = new BrowserWindow({
      width: 460, height: 190, frame: false, resizable: false, show: true,
      backgroundColor: '#111827', skipTaskbar: false, title: 'LetXinet Desktop',
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    const html = '<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;'
      + 'background:#111827;color:#e5e7eb;font-family:Segoe UI,sans-serif;text-align:center">'
      + '<div><div style="font-size:18px;font-weight:600">Iniciando LetXinet Desktop...</div>'
      + '<div style="font-size:13px;margin-top:10px;color:#9ca3af">La primera vez puede tardar unos minutos.</div></div></body></html>';
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return w;
  } catch (e) {
    trace(`startup window failed: ${e.message}`);
    return null;
  }
}

function waitForBackend(timeoutMs = BACKEND_TIMEOUT_MS) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`http://127.0.0.1:${APP_PORT}/health`, (response) => {
        response.resume();
        if (response.statusCode === 200) {
          backendStartedSuccessfully = true;
          return resolve();
        }
        retry();
      });
      request.on('error', retry);
      request.setTimeout(2000, () => { request.destroy(); retry(); });
    };
    const retry = () => {
      if (!backend || backend.exitCode !== null || backend.killed) {
        return reject(new Error(`Backend process died during startup. See ${path.join(app.getPath('userData'), 'backend.log')}`));
      }
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error(`El backend de LetXinet Desktop no arranco en ${Math.round(timeoutMs / 60000)} minutos. `
          + `Vuelve a abrir la app; si se repite, revisa ${path.join(app.getPath('userData'), 'backend.log')} `
          + `y ${startupLog}.`));
      }
      setTimeout(check, 400);
    };
    check();
  });
}

function resolveServerEntry(appPath) {
  // Without asar packaging, appPath is .../resources/app and server.cjs lives
  // at .../resources/app/dist/server.cjs (real FS, fully readable/spawnable).
  // With asar packaging (legacy), it lives in the unpacked mirror at
  // .../resources/app.asar.unpacked/dist/server.cjs.
  const direct = path.join(appPath, 'dist', 'server.cjs');
  const unpacked = path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'dist', 'server.cjs');
  if (fs.existsSync(unpacked)) return unpacked;
  if (fs.existsSync(direct)) return direct;
  // Fall back to whichever path resolves (the asar one, which fails later
  // with a clearer E_CANNOT_READ_FROM_ASAR when spawned).
  return fs.existsSync(path.join(appPath, 'dist')) ? direct : unpacked;
}

function startBackend() {
  const appPath = app.getAppPath();
  const serverEntry = resolveServerEntry(appPath);
  const backendCwd = path.dirname(serverEntry);
  trace(`Starting backend: ${serverEntry}`);
  trace(`Backend cwd: ${backendCwd}`);

  const logDir = app.getPath('userData');
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) {}
  const logPath = path.join(logDir, 'backend.log');
  try { fs.writeFileSync(logPath, ''); } catch (_) {}

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    NODE_ENV: 'production',
    // LetXinet Suite: when launched by the Suite, DESKTOP_ENDPOINT_MODE is set
    // by shared-env/LetXinet-Suite.env. Default 'auto' = local MCP first,
    // fall back to remote HF/letxinet on failure. Preserve any explicit
    // DESKTOP_ENDPOINT_MODE passed in via process.env, otherwise override
    // the legacy DESKTOP_HF_ONLY=1 to enable auto mode when the user did not
    // explicitly request hf_only.
    DESKTOP_ENDPOINT_MODE: process.env.DESKTOP_ENDPOINT_MODE || 'auto',
    DESKTOP_HF_ONLY: process.env.DESKTOP_ENDPOINT_MODE === 'hf_only' ? '1' : process.env.DESKTOP_HF_ONLY || '',
    PORT: String(APP_PORT),
    LETXIPU_DESKTOP_USERDATA: logDir,
  };
  for (const k of ['ORIGINAL_XDG_CURRENT_DESKTOP']) delete env[k];

  try {
    backend = spawn(process.execPath, [serverEntry], {
      cwd: backendCwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    backend.stdout.on('data', (d) => { try { logStream.write(d); } catch (_) {} });
    backend.stderr.on('data', (d) => { try { logStream.write(d); } catch (_) {} });
    backend.on('error', (e) => trace(`spawn error: ${e.message}`));
    backend.on('exit', (code, signal) => {
      trace(`Backend exited with code=${code} signal=${signal}`);
      if (!backendStartedSuccessfully) {
        // Died during startup; waitForBackend will see no /health and fail with reason.
        trace('Backend died before becoming healthy');
      }
    });
    trace(`Spawned backend PID=${backend.pid}`);
  } catch (e) {
    trace(`startBackend threw: ${e && e.stack ? e.stack : e.message}`);
    throw e;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Fase P10 Attachment / Extra Tools — preload que expone webUtils.getPathForFile()
      // al renderer via contextBridge. Permite que <input type="file"> HTML obtenga
      // el path absoluto del archivo seleccionado (File.path depreado en Electron 32+).
      preload: require('path').join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}`);
  mainWindow.on('closed', () => { mainWindow = null; });
}

process.on('uncaughtException', (err) => {
  trace(`uncaughtException: ${err && err.stack ? err.stack : err}`);
});
process.on('unhandledRejection', (reason) => {
  trace(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

// -----------------------------------------------------------------------------
// Local MCP-V11-Local portable discovery + spawn.
//
// The MCP-V11-Local portable ships as a folder containing:
//   MCP-V11-Local.exe   (renamed node.exe standalone)
//   start-mcp-local.cmd (entrypoint, sets env vars + python-runtime path)
//   dist\               (compiled MCP code)
//   node_modules\
//   python-runtime\     (Python 3.12 embedded + numpy/flask/spacy)
//   python\             (spacy_server.py)
//
// The gateway Electron passes the user's API keys (recovered from secrets.json)
// to the MCP via env vars. The MCP "belongs" to this Electron instance — on
// quit we kill the spawned process and its children.
let localMcpProcess = null;
let localMcpRestartCount = 0;
const LOCAL_MCP_MAX_RESTARTS = 3;
const LOCAL_MCP_PORT = Number(process.env.LOCAL_MCP_PORT || 4003);
const LOCAL_MCP_HEALTH_URL = `http://127.0.0.1:${LOCAL_MCP_PORT}/api/health`;

function discoverLocalMcpDir() {
  const candidates = [
    process.env.LETXIPU_LOCAL_MCP_DIR,
    path.join(process.env.ProgramFiles || '', 'MCP-V11-Local'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'MCP-V11-Local'),
    path.join(process.env.LOCALAPPDATA || '', 'MCP-V11-Local'),
    path.join(process.env.USERPROFILE || '', 'MCP-V11-Local'),
    path.join(process.env.ProgramFiles || '', 'MCP-V11-Local-Portable'),
    path.join(process.env.LOCALAPPDATA || '', 'MCP-V11-Local-Portable'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'start-mcp-local.cmd')) && fs.existsSync(path.join(c, 'MCP-V11-Local.exe'))) {
      return c;
    }
  }
  return null;
}

function isLocalMcpHealthy() {
  return new Promise((resolve) => {
    const r = http.get(LOCAL_MCP_HEALTH_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    r.on('error', () => resolve(false));
    r.setTimeout(2000, () => { r.destroy(); resolve(false); });
  });
}

async function loadSecretsFile() {
  const userData = app.getPath('userData');
  const secretsPath = path.join(userData, 'secrets.json');
  try {
    if (fs.existsSync(secretsPath)) {
      const raw = fs.readFileSync(secretsPath, 'utf8');
      return JSON.parse(raw || '{}');
    }
  } catch (e) {
    trace(`loadSecretsFile error: ${e.message}`);
  }
  return {};
}

// Private build seeding: if the installer ships with a pre-populated
// secrets.json (placed at resources/secrets.json via electron-builder
// extraResources), copy it to userData on first launch so the backend gets
// the embedded API keys (Nebius/OpenRouter/DeepSeek) without GUI input.
// If userData/secrets.json already exists (user already configured keys
// via ProvidersSyncPanel), do NOT overwrite — user config wins.
function seedSecretsFromBundle() {
  try {
    const userData = app.getPath('userData');
    const targetPath = path.join(userData, 'secrets.json');
    // extraResources places the file at {resourcesPath}/secrets.json
    const bundlePath = path.join(process.resourcesPath, 'secrets.json');
    if (!fs.existsSync(bundlePath)) {
      return; // public build or private build without secrets — nothing to seed
    }
    if (fs.existsSync(targetPath)) {
      trace(`[secrets] userData/secrets.json already exists — skipping bundle seed (user config wins)`);
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

async function maybeStartLocalMcp() {
  const alreadyHealthy = await isLocalMcpHealthy();
  if (alreadyHealthy) {
    trace(`[local-mcp] already healthy at ${LOCAL_MCP_HEALTH_URL}; not spawning`);
    return;
  }

  const dir = discoverLocalMcpDir();
  if (!dir) {
    trace('[local-mcp] MCP-V11-Local portable not found (looked in ProgramFiles, LocalAppData, USERPROFILE). Backend will use remote HF MCP.');
    return;
  }
  trace(`[local-mcp] discovered portable at: ${dir}`);

  const secrets = await loadSecretsFile();
  const mcpEnv = {
    ...process.env,
    PORT: String(LOCAL_MCP_PORT),
    SPACY_PORT: '4002',
    LETXIPU_DESKTOP_GATEWAY: 'true',
    LETXIPU_DESKTOP_USERDATA: app.getPath('userData'),
    // IA classicas (legacy modal):
    GOOGLE_API_KEY: secrets.geminiApiKey || process.env.GOOGLE_API_KEY || '',
    GEMINI_API_KEY: secrets.geminiApiKey || process.env.GEMINI_API_KEY || '',
    MISTRAL_API_KEY: secrets.mistralApiKey || process.env.MISTRAL_API_KEY || '',
    MCP_API_KEY: secrets.mcpApiKey || process.env.MCP_API_KEY || '',
    NVIDIA_API_KEY: secrets.nvidiaApiKey || process.env.NVIDIA_API_KEY || '',
    OPENCODE_API_KEY: secrets.opencodeApiKey || process.env.OPENCODE_API_KEY || '',
    // IA additions (Anthropic / OpenAI / Groq) - both API_KEY and TOKEN aliases.
    ANTHROPIC_API_KEY: secrets.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    ANTHROPIC_TOKEN:   secrets.anthropicApiKey || process.env.ANTHROPIC_TOKEN   || '',
    OPENAI_API_KEY:    secrets.openaiApiKey    || process.env.OPENAI_API_KEY    || '',
    OPENAI_TOKEN:      secrets.openaiApiKey    || process.env.OPENAI_TOKEN      || '',
    GROQ_API_KEY:      secrets.groqApiKey       || process.env.GROQ_API_KEY      || '',
    GROQ_TOKEN:        secrets.groqApiKey       || process.env.GROQ_TOKEN        || '',
    // Sources academicas (variante B configurable desde la GUI)
    MINERU_API_KEY:                secrets.mineruApiKey           || process.env.MINERU_API_KEY                || '',
    HF_TOKEN:                      secrets.hfToken               || process.env.HF_TOKEN                       || '',
    SERP_API_KEY:                  secrets.serpApiKey             || process.env.SERP_API_KEY                   || '',
    SERPAPI_KEY:                   secrets.serpApiKey             || process.env.SERPAPI_KEY                    || '',
    CORE_API_KEY:                  secrets.coreApiKey            || process.env.CORE_API_KEY                   || '',
    SEMANTIC_SCHOLAR_API_KEY:      secrets.semanticScholarApiKey || process.env.SEMANTIC_SCHOLAR_API_KEY       || '',
    SCOPUS_API_KEY:                secrets.scopusApiKey          || process.env.SCOPUS_API_KEY                 || '',
    REDALYC_TOKEN:                 secrets.redalycToken           || process.env.REDALYC_TOKEN                  || '',
    UNPAYWALL_EMAIL:               secrets.unpaywallEmail         || process.env.UNPAYWALL_EMAIL                || '',
    OSM_USER_AGENT:                secrets.osmUserAgent           || process.env.OSM_USER_AGENT                 || '',
  };
  // Don't inherit the gateway's DESKTOP_HF_ONLY/LETXIPU_MCP_URL — the local
  // MCP doesn't talk to the remote HF; it IS the MCP backend.
  delete mcpEnv.DESKTOP_HF_ONLY;
  delete mcpEnv.LETXIPU_MCP_URL;
  delete mcpEnv.LETXIPU_OSM_MCP_URL;
  delete mcpEnv.LETXINET_MCP_URL;

  const logPath = path.join(app.getPath('userData'), 'local-mcp.log');
  let logStream;
  try { logStream = fs.createWriteStream(logPath, { flags: 'a' }); } catch (_) { logStream = null; }

  const launcher = path.join(dir, 'start-mcp-local.cmd');
  try {
    localMcpProcess = spawn('cmd.exe', ['/c', launcher], {
      cwd: dir,
      env: mcpEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
    if (localMcpProcess && logStream) {
      localMcpProcess.stdout.on('data', (d) => { try { logStream.write(d); } catch (_) {} });
      localMcpProcess.stderr.on('data', (d) => { try { logStream.write(d); } catch (_) {} });
    }
    localMcpProcess.on('error', (e) => trace(`[local-mcp] spawn error: ${e.message}`));
    localMcpProcess.on('exit', (code, signal) => {
      trace(`[local-mcp] process exit code=${code} signal=${signal}`);
      localMcpProcess = null;
      if (!appExiting && localMcpRestartCount < LOCAL_MCP_MAX_RESTARTS) {
        localMcpRestartCount++;
        trace(`[local-mcp] auto-restart attempt #${localMcpRestartCount} in 2s`);
        setTimeout(() => { maybeStartLocalMcp(); }, 2000);
      }
    });
    trace(`[local-mcp] spawned PID=${localMcpProcess.pid} via ${launcher}`);

    // Wait up to 30s for the local MCP to become healthy (longer than the
    // express gateway backend because the spaCy sidecar takes time to load).
    for (let i = 0; i < 60; i++) {
      const ok = await isLocalMcpHealthy();
      if (ok) {
        trace(`[local-mcp] healthy after ${(i + 1) * 0.5}s`);
        return;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    trace('[local-mcp] NOT healthy after 30s; backend will use remote HF MCP fallback.');
  } catch (e) {
    trace(`[local-mcp] maybeStartLocalMcp threw: ${e && e.stack ? e.stack : e.message}`);
    localMcpProcess = null;
  }
}

let appExiting = false;

app.whenReady().then(async () => {
  try {
    trace('Electron ready');
    trace(`process.execPath=${process.execPath}`);
    trace(`process.version=${process.version}`);
    trace(`process.versions.electron=${process.versions.electron}`);
    trace(`app.getAppPath()=${app.getAppPath()}`);
    trace(`process.resourcesPath=${process.resourcesPath}`);

    // If a previous healthy backend is already running on the port (e.g. this
    // is the first instance after a kill -9 of the previous window), reuse it
    // instead of spawning a new one and hitting EADDRINUSE.
    let alreadyHealthy = false;
    try {
      // LetXinet 1.1.4: antes decia "new Promise<boolean>" (sintaxis de TypeScript en un .cjs), lo que
      // lanzaba un error y esta comprobacion nunca funcionaba.
      const probe = await new Promise((resolve) => {
        const r = http.get(`http://127.0.0.1:${APP_PORT}/health`, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        });
        r.on('error', () => resolve(false));
        r.setTimeout(1500, () => { r.destroy(); resolve(false); });
      });
      if (probe) {
        alreadyHealthy = true;
        trace('Backend already healthy on port — not spawning a new one');
      } else {
        // Port not responding health: free any zombie binding.
        const free = await isPortFree(APP_PORT);
        if (!free) {
          trace(`Port ${APP_PORT} is bound but not responding /health; will still try to spawn (likely EADDRINUSE).`);
        }
      }
    } catch (_) {}

    if (!alreadyHealthy) {
      seedSecretsFromBundle();  // private build: pre-populate userData/secrets.json from bundle
      startupWindow = showStartupWindow();
      startBackend();
      await waitForBackend();
    }
    trace('Backend healthy');

    // Try to discover and spawn the local MCP-V11-Local portable.
    // Search order: (1) %ProgramFiles%\MCP-V11-Local, (2) %ProgramFiles(x86)%\MCP-V11-Local,
    // (3) %LocalAppData%\MCP-V11-Local, (4) %USERPROFILE%\MCP-V11-Local,
    // (5) LETXIPU_LOCAL_MCP_DIR env var (advanced users).
    // If found, spawn start-mcp-local.cmd and pass the gateway-admin's API keys
    // (recovered from secrets.json in server.ts). If the MCP local is already
    // running (probe /api/health returns 200), skip spawning.
    await maybeStartLocalMcp();

    createWindow();
    // Se cierra despues de abrir la principal: si se cerrara antes, window-all-closed cerraria la app
    closeStartupWindow();
  } catch (error) {
    trace(`Startup failed: ${error && error.stack ? error.stack : error.message}`);
    try { dialog.showErrorBox('LetXipu Desktop HF', error && error.message ? error.message : String(error)); } catch (_) {}
    closeStartupWindow();
    app.quit();
  }
});

function closeStartupWindow() {
  try { if (startupWindow && !startupWindow.isDestroyed()) startupWindow.close(); } catch (_) {}
  startupWindow = null;
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  appExiting = true;
  try {
    if (localMcpProcess && !localMcpProcess.killed) {
      // On Windows, killing the cmd.exe parent doesn't always terminate the
      // child node.exe. Use taskkill with /T to kill the whole tree.
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /PID ${localMcpProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch (_) {
        try { localMcpProcess.kill(); } catch (_) {}
      }
    }
  } catch (_) {}
  try { process.exit(0); } catch (_) {}
});
