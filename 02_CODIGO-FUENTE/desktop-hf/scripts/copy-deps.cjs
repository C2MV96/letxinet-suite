const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const srcModules = path.join(root, 'node_modules');
const distModules = path.join(root, 'dist', 'node_modules');

const KEEP = new Set([
  'express',
  '@google',
  '@mistralai',
  'dotenv',
  'pdf-parse',
  '@langchain',
  'vite',
  'accepts',
  'body-parser',
  'bytes',
  'cookie',
  'debug',
  'depd',
  'ee-first',
  'encodeurl',
  'escape-html',
  'etag',
  'finalhandler',
  'fresh',
  'http-errors',
  'merge-descriptors',
  'methods',
  'mime',
  'ms',
  'on-finished',
  'proxy-addr',
  'qs',
  'range-parser',
  'raw-body',
  'safe-buffer',
  'safer-buffer',
  'send',
  'serve-static',
  'setprototypeof',
  'statuses',
  'type-is',
  'unpipe',
  'utils-merge',
  'vary',
  'content-disposition',
  'content-type',
  'cookie-signature',
  'negotiator',
  'destroy',
  'raw-body',
  'ipaddr.js',
]);

function isKept(name) {
  if (KEEP.has(name)) return true;
  for (const k of KEEP) {
    if (name.startsWith(k + '/')) return true;
  }
  return false;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      try { fs.symlinkSync(target, d); } catch (_) {}
    } else if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

console.log('[copy-deps] Preparing dist/node_modules...');
if (fs.existsSync(distModules)) {
  fs.rmSync(distModules, { recursive: true, force: true });
}
fs.mkdirSync(distModules, { recursive: true });

let count = 0;
for (const entry of fs.readdirSync(srcModules, { withFileTypes: true })) {
  if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
  if (!isKept(entry.name)) continue;
  const s = path.join(srcModules, entry.name);
  const d = path.join(distModules, entry.name);
  copyDir(s, d);
  count++;
}
console.log(`[copy-deps] Copied ${count} top-level entries to dist/node_modules`);
