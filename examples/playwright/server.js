// Minimal static file server for the Acme demo app.
// Serves files from the `app/` directory with SPA-style fallback routing.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4200;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Serve from the project root so /app/app.js maps to <root>/app/app.js.
  let filePath = path.join(__dirname, url.pathname);

  // Check if a specific file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback: serve index.html for all unmatched routes
    filePath = path.join(__dirname, "app", "index.html");
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});
