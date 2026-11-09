// Test script: invoke the in-process dispatcher against the real Express app
// without requiring HTTP. Simula el contexto de Vercel serverless.
process.env.VERCEL = '1';  // fuerza active path
const PORT = 4099;
process.env.PORT = PORT;

(async () => {
  const mcpMod = require('../dist/routes/mcp.js');
  const express = require('express');
  const http = require('http');

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/mcp', mcpMod.default || mcpMod);

  const tests = [
    { name: 'list_sources', args: {} },
    { name: 'search', args: { query: 'diabetes', sources: ['openalex'], maxResults: 3 } },
    { name: 'health_check', args: {} },
    { name: 'smart_search', args: { query: 'rizobacterias IAA Peru', sources: ['latam'], maxResults: 5, fastMode: true } },
  ];

  const server = app.listen(4099, async () => {
    for (const test of tests) {
      await new Promise((resolve) => {
        const data = JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'tools/call',
          params: { name: test.name, arguments: test.args }
        });
        const req = http.request({
          hostname: 'localhost', port: 4099, path: '/api/mcp', method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            console.log(`=== ${test.name} ===`);
            console.log('STATUS:', res.statusCode, 'LEN:', body.length);
            if (body.includes('fetch failed')) console.log('  !! BROKEN: fetch failed');
            else if (body.includes('"error"') && !body.includes('"error": null')) console.log('  !! ERROR:', body.slice(0, 300));
            else if (body.includes('"total":0') || body.includes('"total": 0')) console.log('  WARN: 0 results (but no fetch failed) –', body.slice(0, 200));
            else console.log('  OK');
            resolve();
          });
        });
        req.on('error', (e) => { console.log('request error:', e.message); resolve(); });
        req.on('timeout', () => { console.log(`  ${test.name}: TIMEOUT`); req.destroy(); resolve(); });
        req.setTimeout(60000);
        req.write(data);
        req.end();
      });
    }
    server.close();
  });
  server.on('error', (e) => console.log('server error', e.message));
})();
