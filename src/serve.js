import http from 'node:http';
import {createReadStream, existsSync} from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export function serveReports({root = './reports', host = '127.0.0.1', port = 8787} = {}) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${host}:${port}`);
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    const pathname = url.pathname === '/' ? '/dashboard.html' : decodeURIComponent(url.pathname);
    const filePath = path.resolve(resolvedRoot, `.${pathname}`);
    if (!filePath.startsWith(resolvedRoot) || !existsSync(filePath)) {
      response.writeHead(404, {'content-type': 'text/plain'});
      response.end('Not found');
      return;
    }
    response.writeHead(200, {'content-type': TYPES[path.extname(filePath)] ?? 'application/octet-stream'});
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve({server, url: `http://${host}:${port}/`, root: resolvedRoot}));
  });
}
