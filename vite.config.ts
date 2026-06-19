import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf-8"),
) as { name: string };

/** On GitHub Actions, use /repo-name/ so assets load on project Pages. */
function basePath(): string {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (process.env.GITHUB_ACTIONS === "true") {
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    return `/${repo ?? pkg.name}/`;
  }
  return "./";
}

export default defineConfig({
  plugins: [react()],
  base: basePath(),
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          engine: [
            "./src/engine/effects.ts",
            "./src/engine/rng.ts",
            "./src/content/events.ts",
            "./src/content/eventChunks.ts",
          ],
        },
      },
    },
  },
});
