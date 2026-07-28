import { copyFile, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

const worker = `
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    if (request.method === "GET" && !url.pathname.includes(".")) {
      url.pathname = "/";
      return env.ASSETS.fetch(new Request(url, request));
    }

    return response;
  }
};
`;

await writeFile("dist/server/index.js", worker.trimStart(), "utf8");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
