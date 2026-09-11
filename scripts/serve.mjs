#!/usr/bin/env node
/**
 * A static file server for local development, in the standard library.
 *
 * The app is plain ES modules, which browsers refuse to load over `file://`, so
 * it needs a server even though it needs no build. Rather than add a dependency
 * for that, this is forty lines of `node:http`.
 *
 * Usage: npm start [-- --port 8080]
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const portFlag = process.argv.indexOf("--port");
const PORT = Number(portFlag > -1 ? process.argv[portFlag + 1] : process.env.PORT ?? 8080);

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  const target = relative === "" ? join(ROOT, "index.html") : join(ROOT, relative);

  // Anything that resolves outside the project is a traversal attempt, not a typo.
  if (!target.startsWith(ROOT)) {
    response.writeHead(403).end("forbidden");
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache"
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`ENCORE is serving ${ROOT}`);
  console.log(`open http://localhost:${PORT}`);
});
