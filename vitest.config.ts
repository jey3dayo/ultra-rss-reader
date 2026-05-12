import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const unitTestFileGlobs = ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"] as const;
const jsdomSetupFiles = ["tests/setup.ts"] as const;
const nodeProjectName = "node";
const jsdomProjectName = "jsdom";
const nodeProjectGroupOrder = 0;
const jsdomProjectGroupOrder = 1;

// Keep folders that are consistently DOM-free fast by default. Rendering and
// DOM-facing tests stay in jsdom unless they opt into node with *.node.test.*.
const nodeEnvironmentTestGlobs = [
  "src/__tests__/api/schemas/**/*.test.ts",
  "src/__tests__/constants/**/*.test.ts",
  "src/__tests__/schemas/**/*.test.ts",
  "src/__tests__/scripts/**/*.test.ts",
  "src/__tests__/styles/**/*.test.ts",
  "src/__tests__/config/ci-workflow-contract.test.ts",
  "src/__tests__/config/github-templates-contract.test.ts",
  "src/__tests__/config/storybook-smoke-health-contract.test.ts",
  "src/__tests__/dev/dev-mock-data.test.ts",
  "src/__tests__/dev/scenario-runtime.test.ts",
  "src/__tests__/dev/scenarios/registry.test.ts",
  "src/__tests__/stores/platform-store.test.ts",
  "tests/helpers/app-error.test.ts",
  "tests/helpers/deferred.test.ts",
  "tests/helpers/dev-intent.test.ts",
  "tests/helpers/diagnostics-reporters.test.ts",
  "tests/helpers/fixtures.test.ts",
  "tests/helpers/repo-contract-parser.test.ts",
  "tests/todo-triage.test.ts",
  "tests/type-surface-contract.test.ts",
  "tests/windows-dispatch.test.ts",
] as const;
const nodeNamedTestGlobs = ["src/**/*.node.test.{ts,tsx}", "tests/**/*.node.test.{ts,tsx}"] as const;

// Migration-only exceptions for mixed folders. New tests should prefer a
// node-first folder or the *.node.test.* naming convention.
const legacyNodeEnvironmentTestFiles = [
  "src/__tests__/api/bulk-count-schemas.test.ts",
  "src/__tests__/api/schema-barrel-public-api.test.ts",
  "src/__tests__/hooks/tag-mute-settings-contract.test.ts",
  "src/__tests__/hooks/use-breakpoint.test.ts",
] as const;

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
    projects: [
      {
        extends: true,
        test: {
          name: nodeProjectName,
          environment: nodeProjectName,
          include: [...nodeEnvironmentTestGlobs, ...nodeNamedTestGlobs, ...legacyNodeEnvironmentTestFiles],
          setupFiles: [],
          sequence: {
            groupOrder: nodeProjectGroupOrder,
          },
        },
      },
      {
        extends: true,
        test: {
          name: jsdomProjectName,
          environment: jsdomProjectName,
          include: [...unitTestFileGlobs],
          exclude: [...nodeEnvironmentTestGlobs, ...nodeNamedTestGlobs, ...legacyNodeEnvironmentTestFiles],
          setupFiles: [...jsdomSetupFiles],
          sequence: {
            groupOrder: jsdomProjectGroupOrder,
          },
        },
      },
    ],
    clearMocks: true,
    slowTestThreshold: 300,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
