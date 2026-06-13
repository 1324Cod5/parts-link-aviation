/**
 * Production static server for the prerendered aeroparts SPA.
 *
 * Serves dist/public (built by `vite build && node prerender.mjs`):
 *   - hashed static assets with long-lived cache headers
 *   - prerendered <route>/index.html (crawlable content) with 200
 *   - known client-side routes fall back to the app shell with 200
 *   - unknown URLs return a real 404 (no soft 404s), still rendering the shell
 *
 * Zero dependencies — plain Node http. Listens on $PORT (Railway sets it).
 * Replaces running `vite dev` in production, which served the empty SPA
 * template for every path and returned 200 for unknown URLs.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, "dist", "public");
const PORT = process.env.PORT || 8080;

// Client-side route prefixes from the SPA router (App.tsx). A request that is
// neither a static file nor a prerendered page, and does not match one of
// these, is an unknown URL and must return a real 404.
const SPA_ROUTE_PREFIXES = [
  "/marketplace", "/listings", "/login", "/seller", "/admin", "/pricing",
  "/rfqs", "/mro", "/privacy", "/terms", "/cookies", "/contact", "/about",
  "/buyer-protection", "/certification", "/compliance", "/seller-guidelines",
  "/developer", "/watchlist", "/debug-login-free-seller", "/auth-test",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  if (p !== base && !p.startsWith(base + path.sep)) return null; // block traversal
  return p;
}

function send(req, res, file, status, extraHeaders = {}) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const body = fs.readFileSync(file);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": body.length,
    ...extraHeaders,
  });
  if (req.method === "HEAD") return res.end();
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain", Allow: "GET, HEAD" });
      return res.end("Method Not Allowed");
    }

    let pathname = "/";
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      pathname = "/";
    }

    // Normalize: collapse trailing slashes (keep root) — keeps canonical URLs clean.
    const reqPath = pathname.replace(/\/+$/, "") || "/";

    // 1. Static file request (has an extension): assets, robots.txt, sitemap.xml, images.
    if (reqPath !== "/" && path.extname(reqPath)) {
      const file = safeJoin(DIST, reqPath);
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
        const immutable = reqPath.startsWith("/assets/");
        return send(req, res, file, 200, {
          "Cache-Control": immutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        });
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }

    // 2. Prerendered route HTML (crawlable content in #root).
    const rel = reqPath === "/" ? "index.html" : path.join(reqPath.slice(1), "index.html");
    const prerendered = safeJoin(DIST, rel);
    if (prerendered && fs.existsSync(prerendered) && fs.statSync(prerendered).isFile()) {
      return send(req, res, prerendered, 200, { "Cache-Control": "public, max-age=300" });
    }

    // 3. App-shell fallback: 200 for known client routes, real 404 for unknown URLs.
    const spaShell = path.join(DIST, "__spa.html");
    const shell = fs.existsSync(spaShell) ? spaShell : path.join(DIST, "index.html");
    const known =
      reqPath === "/" ||
      SPA_ROUTE_PREFIXES.some((p) => reqPath === p || reqPath.startsWith(p + "/"));
    return send(req, res, shell, known ? 200 : 404, { "Cache-Control": "no-cache" });
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`aeroparts static server listening on :${PORT} (serving ${DIST})`);
});
