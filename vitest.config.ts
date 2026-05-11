import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "node_modules/.vite/vitest",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(import.meta.dirname, "src"),
      "@tests": path.join(import.meta.dirname, "tests"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    clearMocks: true,
    slowTestThreshold: 300,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
