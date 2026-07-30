import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { extractStoredZip, readStoredZip } from "./zip-store.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const releasePath = join(
  projectRoot,
  "public",
  "downloads",
  "星际守护者-高性能生产构建包.zip"
);

const requiredEntries = [
  "直接运行版/index.html",
  "直接运行版/启动游戏.mjs",
  "源码构建版/index.html",
  "源码构建版/package.json",
  "源码构建版/package-lock.json",
  "源码构建版/tsconfig.json",
  "源码构建版/vite.config.ts",
  "源码构建版/scripts/package-release.mjs",
  "源码构建版/src/main.ts",
  "启动与编译说明.txt",
  "构建配置.json"
];

const entries = await readStoredZip(releasePath);
const names = new Set(entries.map((entry) => entry.name));
const missing = requiredEntries.filter((entry) => !names.has(entry));
if (missing.length > 0) {
  throw new Error(`构建包缺少必要文件：\n${missing.join("\n")}`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "starfall-release-"));
try {
  const extractedNames = await extractStoredZip(releasePath, temporaryDirectory);
  for (const requiredEntry of requiredEntries) {
    await stat(resolve(temporaryDirectory, ...requiredEntry.split("/")));
  }

  const packageJson = JSON.parse(
    await readFile(join(temporaryDirectory, "源码构建版", "package.json"), "utf8")
  );
  if (!packageJson.scripts?.build || packageJson.dependencies?.phaser !== "3.90.0") {
    throw new Error("源码构建版 package.json 内容不完整。");
  }
  if (!packageJson.scripts?.["serve:dist"]) {
    throw new Error("源码构建版缺少免依赖的生产预览命令。");
  }

  const zipStats = await stat(releasePath);
  console.log(
    `[verify] ZIP 列表与 CRC 校验通过：${entries.length} 个文件，${(
      zipStats.size /
      1024 /
      1024
    ).toFixed(2)} MiB`
  );
  console.log(`[verify] 临时解压验证通过：${extractedNames.length} 个文件`);
  console.log(`[verify] 下载文件：${releasePath}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
