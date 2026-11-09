#!/usr/bin/env node
// Pool de harnesses de LetXinet Suite: ejecuta todas las pruebas en paralelo por fases y genera el informe.
//   node ejecutar-pool.cjs                 todo
//   node ejecutar-pool.cjs h02 h04         solo esos harnesses
//   node ejecutar-pool.cjs --sin-comparativo
// Fases: 1) funcionales en paralelo, 2) fuentes y comparativo, 3) rendimiento solo (para medir sin carga ajena),
//        4) verificacion de referencias y 5) informe. Resultados en resultados\AAAAMMDD-HHMM\.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RAIZ = __dirname;
const args = process.argv.slice(2);
const sinComparativo = args.includes('--sin-comparativo');
const elegidos = args.filter((a) => /^h\d\d$/.test(a));
const sello = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const SALIDA = path.join(RAIZ, 'resultados', sello);
fs.mkdirSync(SALIDA, { recursive: true });

const FASES = [
  ['h01-servicios', 'h02-v11-herramientas', 'h04-osm-herramientas', 'h05-markitdown', 'h06-puentes', 'h07-clientes', 'h08-gateway', 'h10-seguridad'],
  ['h03-fuentes', ...(sinComparativo ? [] : ['h11-benchmark-letxinet'])],
  ['h09-rendimiento'],
];

function correr(script) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const log = fs.createWriteStream(path.join(SALIDA, `${script}.log`));
    const p = spawn(process.execPath, [path.join(RAIZ, script.endsWith('.cjs') ? script : `${script}.cjs`)], { env: { ...process.env, POOL_SALIDA: SALIDA } });
    p.stdout.on('data', (d) => { log.write(d); for (const l of String(d).split('\n')) if (/TERMINADO|\[FALLA\]/.test(l)) process.stdout.write(l + '\n'); });
    p.stderr.on('data', (d) => log.write(d));
    p.on('close', (codigo) => { log.end(); ok({ script, codigo, s: Math.round((Date.now() - t0) / 1000) }); });
  });
}

(async () => {
  const t0 = Date.now();
  console.log(`Pool de harnesses LetXinet -> ${SALIDA}`);
  for (const [i, fase] of FASES.entries()) {
    const lista = fase.filter((s) => !elegidos.length || elegidos.includes(s.slice(0, 3)));
    if (!lista.length) continue;
    console.log(`\n== Fase ${i + 1}: ${lista.join(', ')}`);
    const rs = await Promise.all(lista.map(correr));
    for (const r of rs) if (r.codigo !== 0) console.log(`  ${r.script} termino con codigo ${r.codigo} (ver ${r.script}.log)`);
  }
  if (!sinComparativo && (!elegidos.length || elegidos.includes('h11'))) {
    console.log('\n== Fase 4: verificacion de referencias (IA y LetXinet)');
    await correr('verificar-referencias');
  }
  console.log('\n== Fase 5: informe');
  await new Promise((ok) => spawn(process.execPath, [path.join(RAIZ, 'generar-informe.cjs'), SALIDA], { stdio: 'inherit' }).on('close', ok));
  console.log(`\nListo en ${Math.round((Date.now() - t0) / 60000)} min. Informe: ${path.join(SALIDA, 'informe-pool.md')}`);
})();
