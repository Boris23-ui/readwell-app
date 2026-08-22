import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "dist");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const API_PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 5001;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function proxyToApi(req, res) {
  const options = {
    hostname: "127.0.0.1",
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${API_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error("API proxy error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Backend API Server is unavailable on port " + API_PORT,
      code: "API_UNAVAILABLE"
    }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  // Proxy /api/* to backend API server
  if (pathname.startsWith("/api/")) {
    return proxyToApi(req, res);
  }

  // Simulator routes
  if (pathname === "/" || pathname === "") {
    pathname = "/simulator.html";
  } else if (pathname === "/app" || pathname === "/web") {
    pathname = "/index.html";
  } else if (pathname === "/simulator" || pathname === "/sim" || pathname === "/ios" || pathname === "/android") {
    pathname = "/simulator.html";
  }

  let filePath = path.join(DIST_DIR, pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server Error: " + err.message);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`📱 ReadWell Simulator Hub: http://localhost:${PORT}`);
  console.log(`   - 🍎 iOS Viewport:     http://localhost:${PORT}/ios`);
  console.log(`   - 🤖 Android Viewport: http://localhost:${PORT}/android`);
  console.log(`   - 🌐 Raw Web App:      http://localhost:${PORT}/app`);
  console.log(`⚡ API Proxy: Forwarding /api/* -> port ${API_PORT}`);
  console.log(`====================================================`);
});
