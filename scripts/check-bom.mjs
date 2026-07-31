import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 禁止源码文件出现 BOM(U+FEFF)。
 * 编辑器反复保存会在文件开头累积多个 EF BB BF,在 IDE 里显示成一串白框问号,
 * 并可能让部分工具链解析失败。默认只检查并报错;传入 --fix 时自动清除。
 */

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const shouldFix = process.argv.includes("--fix");
const scanDirectories = ["src", "tests", "scripts"];
const scanExtensions = [".ts", ".css", ".mjs", ".js", ".json", ".html"];
const rootFiles = ["index.html", "package.json", "tsconfig.json", "vite.config.ts"];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await collectFiles(fullPath)));
    } else if (scanExtensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }
  return files;
}

const targets = [...rootFiles.map((file) => resolve(projectRoot, file))];
for (const directory of scanDirectories) {
  targets.push(...(await collectFiles(resolve(projectRoot, directory))));
}

const offenders = [];
for (const file of targets) {
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }
  let count = 0;
  while (count < content.length && content.charCodeAt(count) === 0xfeff) count += 1;
  if (count === 0) continue;
  offenders.push({ file, count });
  if (shouldFix) {
    await writeFile(file, content.slice(count), "utf8");
  }
}

if (offenders.length === 0) {
  console.log(`[BOM] 已检查 ${targets.length} 个文件，未发现 BOM。`);
  process.exit(0);
}

for (const { file, count } of offenders) {
  const relative = file.replace(projectRoot, "").replace(/^[\\/]/, "");
  console.log(`[BOM] ${shouldFix ? "已清除" : "发现"} ${count} 个 BOM：${relative}`);
}

if (shouldFix) {
  console.log(`[BOM] 共修复 ${offenders.length} 个文件。`);
  process.exit(0);
}

console.error("[BOM] 检查失败：请运行 npm run fix:bom 清除。");
process.exit(1);
