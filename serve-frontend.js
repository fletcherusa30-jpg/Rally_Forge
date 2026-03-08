import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5173;
const BACKEND_PORT = 3000;
const DIST_DIR = join(__dirname, 'app', 'frontend-modern', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Proxy API requests to backend
function proxyToBackend(req, res) {
  const options = {
    hostname: 'localhost',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxy = httpRequest(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway - Backend unavailable');
  });

  req.pipe(proxy);
}

const server = createServer(async (req, res) => {
  // Proxy API and health requests to backend
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    return proxyToBackend(req, res);
  }

  // Serve static files
  try {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    const ext = extname(filePath);
    const fullPath = join(DIST_DIR, filePath);
    
    const content = await readFile(fullPath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // For SPA routing, serve index.html for 404s
      try {
        const indexPath = join(DIST_DIR, 'index.html');
        const content = await readFile(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('404 Not Found');
      }
    } else {
      res.writeHead(500);
      res.end('500 Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`✓ Frontend server running at http://localhost:${PORT}`);
  console.log(`✓ Serving: ${DIST_DIR}`);
});
