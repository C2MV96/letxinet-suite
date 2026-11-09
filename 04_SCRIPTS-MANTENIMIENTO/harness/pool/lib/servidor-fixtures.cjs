// Sirve la carpeta fixtures por HTTP en 127.0.0.1 (V11 no acepta rutas locales para los PDF).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { FIXTURES } = require('./comun.cjs');

const TIPOS = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function servirFixtures() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const nombre = path.basename(decodeURIComponent(req.url.split('?')[0]));
      const ruta = path.join(FIXTURES, nombre);
      if (!fs.existsSync(ruta)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
      fs.createReadStream(ruta).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${srv.address().port}`;
      ok({ url: (n) => `${base}/${n}`, cerrar: () => srv.close() });
    });
  });
}

module.exports = { servirFixtures };
