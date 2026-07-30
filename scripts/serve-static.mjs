import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const rootDirectory = resolve(process.argv[2] ?? ".");
const requestedPort = Number.parseInt(process.argv[3] ?? "4173", 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".zip", "application/zip"]
]);

function safeFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(rootDirectory, ...requestedPath.split("/"));
  if (filePath !== rootDirectory && !filePath.startsWith(`${rootDirectory}${sep}`)) return null;
  return filePath;
}

async function existingFile(filePath) {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile() ? fileStats : null;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  try {
    const requestedFile = safeFilePath(request.url ?? "/");
    if (!requestedFile) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    let filePath = requestedFile;
    let fileStats = await existingFile(filePath);
    if (!fileStats && !extname(filePath)) {
      filePath = resolve(rootDirectory, "index.html");
      fileStats = await existingFile(filePath);
    }
    if (!fileStats) {
      response.writeHead(404).end("Not found");
      return;
    }

    const extension = extname(filePath).toLowerCase();
    const immutableAsset = filePath.includes(`${sep}assets${sep}`) && /-[a-zA-Z0-9_-]{8,}\./.test(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
      "Content-Length": fileStats.size,
      "Cache-Control": immutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500).end("Internal server error");
    console.error(error);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`星际守护者已启动：http://127.0.0.1:${port}/`);
  console.log(`静态目录：${rootDirectory}`);
  console.log("按 Ctrl+C 停止服务器。");
});
