import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const resolveRepoPath = (target: string) => path.resolve(import.meta.dirname, target);
const productionDevAliases = {
  "@/dev/scenario-ids": resolveRepoPath("./src/dev/prod-stubs/scenario-ids.ts"),
  "@/dev/use-dev-intent": resolveRepoPath("./src/dev/prod-stubs/use-dev-intent.ts"),
  "@/dev/use-resolved-dev-intent": resolveRepoPath("./src/dev/prod-stubs/use-resolved-dev-intent.ts"),
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === "build" && mode === "production";
  const sentrySourceMapUploadEnabled = isProductionBuild && Boolean(process.env.SENTRY_AUTH_TOKEN);
  const sentryPlugin = sentrySourceMapUploadEnabled
    ? sentryVitePlugin({
        org: "jey3dayo",
        project: "ultra-rss-reader",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          filesToDeleteAfterUpload: ["dist/**/*.map"],
        },
      })
    : undefined;

  return {
    plugins: [tailwindcss(), react(), ...(sentryPlugin ? [sentryPlugin] : [])],
    build: {
      target: "es2023",
      ...(sentrySourceMapUploadEnabled ? { sourcemap: "hidden" } : {}),
    },
    resolve: {
      alias: {
        ...(isProductionBuild ? productionDevAliases : {}),
        "@": path.resolve(import.meta.dirname, "./src"),
        "@tests": path.resolve(import.meta.dirname, "./tests"),
      },
    },

    // Vite options tailored for Tauri development
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      headers: {
        "Cache-Control": "no-store",
      },
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
