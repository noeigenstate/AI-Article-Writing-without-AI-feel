import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8787";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsBackground = resolve(repoRoot, "docs", "background.png");

function docsBackgroundPlugin(): Plugin {
  let outputDir = "";

  return {
    name: "docs-background",
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/scene-background.png", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }

        if (!existsSync(docsBackground)) {
          res.statusCode = 404;
          res.end("docs/background.png not found");
          return;
        }

        const stats = statSync(docsBackground);
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", stats.size);
        res.setHeader("Cache-Control", "no-cache");

        if (req.method === "HEAD") {
          res.end();
          return;
        }

        createReadStream(docsBackground).pipe(res);
      });
    },
    closeBundle() {
      if (!existsSync(docsBackground)) return;
      mkdirSync(outputDir, { recursive: true });
      copyFileSync(docsBackground, resolve(outputDir, "scene-background.png"));
    },
  };
}

export default defineConfig({
  plugins: [react(), docsBackgroundPlugin()],
  server: {
    port: 51773,
    proxy: {
      "/api": backendUrl,
    },
  },
});
