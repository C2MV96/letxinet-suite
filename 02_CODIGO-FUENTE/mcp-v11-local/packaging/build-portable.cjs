#!/usr/bin/env node
/**
 * build-portable.cjs — Orquestador de packaging para MCP-V11-Local.
 *
 * Pipeline:
 *  1. npm install (en raiz LETXIPU-SEARCH-MCP-V11-LOCAL)
 *  2. npm run build  (tsc → dist/)
 *  3. electron-builder NSIS → dist/MCP-V11-Local-Setup 0.0.0.exe
 *
 * El empaquetado de Python embedded + spaCy + modelos se orquesta aparte
 * (ver packaging/python-bootstrap.cjs) porque es elevate-slow y solo se
 * hace una vez por máquina de build.
 *
 * Uso:
 *   node packaging/build-portable.cjs           # full pipeline
 *   node packaging/build-portable.cjs --nsis    # solo el paso NSIS (post-build)
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function step(name, fn) {
  console.log(`\n=== ${name} ===`);
  fn();
}

const onlyNsis = process.argv.includes('--nsis');

try {
  if (!onlyNsis) {
    step('1/4 npm install', () => {
      run('npm install --no-audit --no-fund');
    });

    step('2/4 Compilar TypeScript (tsc → dist/)', () => {
      run('npm run build');
    });

    step('3/4 Copiar runtime assets a dist/', () => {
      // src/python/spacy_server.py + modelos + requirements → dist/python/
      // para que pkg/node encuentre el sidecar desde dist/server.js vía __dirname.
      const pySrc = path.join(ROOT, 'src', 'python');
      const pyDst = path.join(DIST, 'python');
      if (fs.existsSync(pyDst)) fs.rmSync(pyDst, { recursive: true, force: true });
      fs.mkdirSync(pyDst, { recursive: true });
      // Copiar spacy_server.py y requirements.txt (no .bak, no __pycache__).
      fs.copyFileSync(path.join(pySrc, 'spacy_server.py'), path.join(pyDst, 'spacy_server.py'));
      fs.copyFileSync(path.join(pySrc, 'requirements.txt'), path.join(pyDst, 'requirements.txt'));
      // Copiar modelos (en_core_web_sm, es_core_news_sm, pt_core_news_sm, es_core_news_lg).
      // Patch C8 (2026-07-30): añadir es_core_news_lg (568MB, 500k word vectors) para
      // que smart_search pueda generar variantes semánticas reales preinstaladas.
      for (const m of ['en_core_web_sm', 'es_core_news_sm', 'pt_core_news_sm', 'es_core_news_lg']) {
        const src = path.join(pySrc, 'models', m);
        const dst = path.join(pyDst, 'models', m);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dst, { recursive: true });
          console.log(`  copied model ${m}`);
        }
      }
      // Copiar config/data JSON usados por dist/server.js en runtime
      const cfgSrc = path.join(ROOT, 'src', 'config');
      const cfgDst = path.join(DIST, 'config');
      if (!fs.existsSync(cfgDst)) fs.cpSync(cfgSrc, cfgDst, { recursive: true });
      const dataSrc = path.join(ROOT, 'src', 'data');
      const dataDst = path.join(DIST, 'data');
      if (!fs.existsSync(dataDst)) fs.cpSync(dataSrc, dataDst, { recursive: true });
      console.log('  runtime assets copiados');
    });
  }

  step('4/4 electron-builder NSIS', () => {
    run('npx electron-builder --config packaging/package.json --win nsis');
  });

  console.log('\n=== BUILD COMPLETADO ===');
  console.log(`Output: ${DIST}`);
  if (fs.existsSync(path.join(DIST, 'MCP-V11-Local-Setup 0.0.0.exe'))) {
    const size = fs.statSync(path.join(DIST, 'MCP-V11-Local-Setup 0.0.0.exe')).size;
    console.log(`MCP-V11-Local-Setup 0.0.0.exe — ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
} catch (err) {
  console.error('\n[FATAL] build-portable.cjs:', err);
  process.exit(1);
}
