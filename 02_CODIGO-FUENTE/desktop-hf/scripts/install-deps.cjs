const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const prodDeps = {
  "express": "^4.21.2",
  "@google/genai": "^2.4.0",
  "@mistralai/mistralai": "^2.2.5",
  "dotenv": "^17.2.3",
  "@langchain/langgraph": "^1.4.8",
  "@langchain/core": "^1.2.3",
  "pdf-parse": "^2.4.5",
  "vite": "^6.2.3"
};

const manifest = {
  name: "letxipu-desktop-hf-backend",
  version: "0.0.0",
  private: true,
  type: "commonjs",
  dependencies: prodDeps
};

const distPkg = path.join(distDir, 'package.json');
fs.writeFileSync(distPkg, JSON.stringify(manifest, null, 2));
console.log('[install-deps] Wrote', distPkg);

if (fs.existsSync(path.join(distDir, 'node_modules'))) {
  fs.rmSync(path.join(distDir, 'node_modules'), { recursive: true, force: true });
}
if (fs.existsSync(path.join(distDir, 'package-lock.json'))) {
  fs.rmSync(path.join(distDir, 'package-lock.json'), { force: true });
}

console.log('[install-deps] Running npm install --production...');
execSync('npm install --production --no-audit --no-fund --no-package-lock', {
  cwd: distDir,
  stdio: 'inherit'
});
console.log('[install-deps] Done. node_modules installed to dist/node_modules');
