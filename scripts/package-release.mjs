import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createStoredZip, filesFromDirectory } from "./zip-store.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const releaseFileName = "星际守护者-高性能生产构建包.zip";
const publicReleasePath = join(projectRoot, "public", "downloads", releaseFileName);
const distReleasePath = join(projectRoot, "dist", "downloads", releaseFileName);

const mode = process.argv[2] ?? "pack";

if (mode === "clean") {
  // Only remove the two generated release artifacts. Source assets are never touched.
  await rm(publicReleasePath, { force: true });
  await rm(distReleasePath, { force: true });
  console.log(`[release] 已清理旧构建包：${releaseFileName}`);
  process.exit(0);
}

if (mode !== "pack") {
  throw new Error(`未知模式：${mode}。可用模式为 clean 或 pack。`);
}

const sourceRoots = [
  ["src", "源码构建版/src"],
  ["tests", "源码构建版/tests"],
  ["scripts", "源码构建版/scripts"]
];
const rootFiles = [
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "README.md",
  "CHANGELOG.md",
  "项目续作交接说明.md",
  ".openai/hosting.json"
];

const archiveEntries = await filesFromDirectory(
  join(projectRoot, "dist"),
  "直接运行版",
  (relativePath) => !relativePath.startsWith("downloads/")
);
archiveEntries.push({
  name: "直接运行版/启动游戏.mjs",
  sourcePath: join(projectRoot, "scripts", "serve-static.mjs")
});

for (const [sourceDirectory, archivePrefix] of sourceRoots) {
  archiveEntries.push(
    ...(await filesFromDirectory(join(projectRoot, sourceDirectory), archivePrefix))
  );
}

archiveEntries.push(
  ...(await filesFromDirectory(
    join(projectRoot, "public"),
    "源码构建版/public",
    (relativePath) => !relativePath.startsWith("downloads/")
  ))
);

for (const fileName of rootFiles) {
  archiveEntries.push({
    name: `源码构建版/${fileName.replaceAll("\\", "/")}`,
    sourcePath: join(projectRoot, fileName)
  });
}

const instructions = `飞机大战：星际守护者
高性能生产构建包使用说明
================================

一、直接运行（推荐）
1. 解压本 ZIP。
2. 进入“直接运行版”目录。
3. 不要直接双击 index.html；请通过本地 HTTP 服务器运行。
4. 已安装 Node.js 时，在“直接运行版”目录执行：
   node 启动游戏.mjs
   然后打开 http://127.0.0.1:4173/
5. 也可以把“直接运行版”整体上传到任意静态网站服务器。

二、源码开发与重新编译
1. 安装 Node.js 20 或更高版本（推荐 Node.js 22 LTS）。
2. 进入“源码构建版”目录。
3. 执行 npm ci 安装锁定版本依赖。
4. 开发调试：npm run dev
5. 类型检查、生产编译并重新生成下载包：npm run build
6. 无外部服务器依赖预览生产版：npm run serve:dist
7. 验证下载包完整性：npm run verify:release

三、生产优化
- 面向现代浏览器编译（ES2022）。
- JavaScript 与 CSS 使用 esbuild 高速压缩。
- 不生成 source map，减少下载体积。
- Phaser 引擎拆为独立缓存分包，更新游戏逻辑时无需重新下载整套引擎。
- 静态资源使用内容哈希文件名，便于浏览器长期缓存。

四、目录说明
- 直接运行版：已经编译好的静态网站，无需安装项目依赖。
- 源码构建版：完整的源码、资源、测试和 Node/Vite 编译环境。
- ZIP 不包含 node_modules，请使用 npm ci 安装依赖。
`;

const manifest = {
  name: "starfall-airstrike",
  packageVersion: "0.6.1",
  runtimeTarget: "ES2022 modern browsers",
  minifier: "esbuild",
  sourcemap: false,
  vendorChunks: ["phaser"],
  includesNodeModules: false
};

archiveEntries.push(
  { name: "启动与编译说明.txt", contents: instructions },
  {
    name: "构建配置.json",
    contents: `${JSON.stringify(manifest, null, 2)}\n`
  }
);

const result = await createStoredZip(publicReleasePath, archiveEntries);
await mkdir(dirname(distReleasePath), { recursive: true });
await copyFile(publicReleasePath, distReleasePath);

console.log(
  `[release] 已生成 ${result.entries} 个文件、${(result.bytes / 1024 / 1024).toFixed(2)} MiB：`
);
console.log(`[release] 下载源：${publicReleasePath}`);
console.log(`[release] 生产站点：${distReleasePath}`);
