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
  "src/__tests__/scripts/**/*.test.ts",
  "src/__tests__/styles/**/*.test.ts",
] as const;
const nodeNamedTestGlobs = ["src/**/*.node.test.{ts,tsx}"] as const;

// Migration-only exceptions for mixed folders. New tests should prefer a
// node-first folder or the *.node.test.* naming convention.
const legacyNodeEnvironmentTestFiles = [
  "src/__tests__/api/bulk-count-schemas.test.ts",
  "src/__tests__/api/schema-barrel-public-api.test.ts",
  "src/__tests__/components/account-detail-query-cache.test.ts",
  "src/__tests__/components/account-detail-sync-status-refetch.test.ts",
  "src/__tests__/components/account-detail-toast.test.ts",
  "src/__tests__/components/add-account-services.test.ts",
  "src/__tests__/components/add-feed-dialog-state.test.ts",
  "src/__tests__/components/browser-overlay-presentation.test.ts",
  "src/__tests__/components/browser-surface-issue.test.ts",
  "src/__tests__/components/browser-view-presentation.test.ts",
  "src/__tests__/components/browser-webview-state.test.ts",
  "src/__tests__/components/command-palette-history.test.ts",
  "src/__tests__/components/exception-palettes.test.ts",
  "src/__tests__/components/feed-mark-all-read.test.ts",
  "src/__tests__/components/feed-query-cache.test.ts",
  "src/__tests__/components/feed-tree-drag-outcome.test.ts",
  "src/__tests__/components/feed-tree-drag-session.test.ts",
  "src/__tests__/components/feed-tree-hover-target.test.ts",
  "src/__tests__/components/shared-radius-contract.test.ts",
  "src/__tests__/components/sidebar-account-selection.test.ts",
  "src/__tests__/components/sidebar-density.test.ts",
  "src/__tests__/components/sidebar-feed-tree-helpers.test.ts",
  "src/__tests__/components/sidebar-sync-feedback.test.ts",
  "src/__tests__/components/ui-wrapper-public-api.test.ts",
  "src/__tests__/components/use-appearance-settings-view-props.test.ts",
  "src/__tests__/components/use-article-list-body-props.test.ts",
  "src/__tests__/components/use-debug-settings-view-props.test.ts",
  "src/__tests__/components/use-general-settings-view-props.test.ts",
  "src/__tests__/components/use-mute-settings-view-props.test.ts",
  "src/__tests__/components/use-sidebar-section-props.test.ts",
  "src/__tests__/components/workspace-pane-layout.test.ts",
  "src/__tests__/config/ci-workflow-contract.test.ts",
  "src/__tests__/config/github-templates-contract.test.ts",
  "src/__tests__/config/storybook-smoke-health-contract.test.ts",
  "src/__tests__/constants/exception-palettes.test.ts",
  "src/__tests__/dev/dev-mock-data.test.ts",
  "src/__tests__/dev/scenario-runtime.test.ts",
  "src/__tests__/dev/scenarios/registry.test.ts",
  "src/__tests__/hooks/tag-mute-settings-contract.test.ts",
  "src/__tests__/hooks/use-breakpoint.test.ts",
  "src/__tests__/lib/account/account-selection.test.ts",
  "src/__tests__/lib/account-selection.test.ts",
  "src/__tests__/lib/account-setup-session.test.ts",
  "src/__tests__/lib/account-sync-status-format.test.ts",
  "src/__tests__/lib/add-account-form.test.ts",
  "src/__tests__/lib/article-display.test.ts",
  "src/__tests__/lib/article-list.test.ts",
  "src/__tests__/lib/article-retention.test.ts",
  "src/__tests__/lib/article-view.test.ts",
  "src/__tests__/lib/browser-debug-geometry.test.ts",
  "src/__tests__/lib/browser-viewer-geometry.test.ts",
  "src/__tests__/lib/datetime.test.ts",
  "src/__tests__/lib/errors.test.ts",
  "src/__tests__/lib/feed-landing.test.ts",
  "src/__tests__/lib/feed.test.ts",
  "src/__tests__/lib/i18n-setup.test.ts",
  "src/__tests__/lib/i18next-locale-contract.test.ts",
  "src/__tests__/lib/ja-locales.test.ts",
  "src/__tests__/lib/keyboard-shortcuts.test.ts",
  "src/__tests__/lib/locale-placeholders.test.ts",
  "src/__tests__/lib/manual-sync.test.ts",
  "src/__tests__/lib/menu-i18n-shortcut-parity.test.ts",
  "src/__tests__/lib/options.test.ts",
  "src/__tests__/lib/query-client.test.ts",
  "src/__tests__/lib/query-invalidation.test.ts",
  "src/__tests__/lib/reader-query.test.ts",
  "src/__tests__/lib/runtime/match-media-listener.test.ts",
  "src/__tests__/lib/sidebar.test.ts",
  "src/__tests__/lib/subscription-review-candidates.test.ts",
  "src/__tests__/lib/subscriptions-index.test.ts",
  "src/__tests__/lib/sync-result-feedback.test.ts",
  "src/__tests__/lib/ui-errors.test.ts",
  "src/__tests__/lib/ui-language.test.ts",
  "src/__tests__/lib/ui-state-types.test.ts",
  "src/__tests__/lib/utils.test.ts",
  "src/__tests__/schemas/package-scripts.test.ts",
  "src/__tests__/schemas/parse.test.ts",
  "src/__tests__/schemas/platform-mock-parity.test.ts",
  "src/__tests__/schemas/preferences-schema-contract.test.ts",
  "src/__tests__/schemas/tauri-config-identifiers.test.ts",
  "src/__tests__/schemas/updater-config.test.ts",
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
    maxWorkers: "50%",
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
