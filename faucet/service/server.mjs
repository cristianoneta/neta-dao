// Decide maintenance before importing any signing or database modules.
import http from 'node:http';

const maintenance = process.env.COSMOOT_MAINTENANCE;
if (![undefined, 'false', 'true'].includes(maintenance))
  throw Error('COSMOOT_MAINTENANCE must be true or false.');

if (maintenance === 'true') {
  const server = http.createServer((request, response) => {
    response.writeHead(503, {
      'content-type': 'application/json', 'cache-control': 'no-store',
      'connection': 'close', 'retry-after': '60', 'x-cosmoot-maintenance': 'true'
    });
    response.end(JSON.stringify({ ok: false, maintenance: true }));
    request.resume();
  });
  server.maxConnections = 64;
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1', () => {
    console.log('Backend maintenance: no signing or database access; port ' + server.address().port);
  });
  process.on('SIGTERM', () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
} else {
  await import('./active-server.mjs');
}
