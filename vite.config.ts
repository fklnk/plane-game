import { readFile, writeFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";

/**
 * BOM 自动清除插件。
 * 编辑器反复保存会在文件开头累积多个 U+FEFF(EF BB BF),在 IDE 里显示成一串白框问号。
 * 该插件在 dev 服务器启动时清一次,并在任何源码文件保存时立刻清除,无需手动执行命令。
 */
function stripBomOnSave(): Plugin {
  const watched = /\.(ts|css|mjs|js|json|html)$/;
  const ignored = /[\\/](node_modules|dist)[\\/]/;

  // vite.config.ts 同时也是 vitest 的配置,需要完全禁用插件以免冲突
  const isVitestRun =
    process.argv.includes("vitest") || process.argv.includes("--configLoader") || process.argv.includes("runner");

  async function strip(file: string): Promise<boolean> {
    if (!watched.test(file) || ignored.test(file)) return false;
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      return false;
    }
    let count = 0;
    while (count < content.length && content.charCodeAt(count) === 0xfeff) count += 1;
    if (count === 0) return false;
    await writeFile(file, content.slice(count), "utf8");
    console.log(`[BOM] 已自动清除 ${count} 个 BOM：${file}`);
    return true;
  }

  if (isVitestRun) {
    // vitest 模式下返回空插件占位,完全不注册钩子
    return { name: "strip-bom-on-save" };
  }

  return {
    name: "strip-bom-on-save",
    // 生产构建前兜底清理,保证发布产物不含 BOM
    async buildStart() {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      try {
        await promisify(execFile)(process.execPath, ["scripts/check-bom.mjs", "--fix"]);
      } catch {
        // 清理失败不阻断构建,build 脚本里的显式检查会兜住
      }
    },
    configureServer(server) {
      server.watcher.on("change", (file) => {
        void strip(file);
      });
      server.watcher.on("add", (file) => {
        void strip(file);
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [stripBomOnSave()],
  esbuild: {
    legalComments: "none"
  },
  build: {
    target: "es2022",
    sourcemap: false,
    minify: "esbuild",
    cssMinify: "esbuild",
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false
    },
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    }
  }
});
