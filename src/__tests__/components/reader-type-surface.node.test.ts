import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTypeSurfaceHelper, type TypeSurfaceContract } from "@tests/helpers/type-surface";
import { remainingTypeSurfaceAllowlist } from "@tests/helpers/type-surface-allowlist";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readerTypeSurfaceFiles = [
  "src/components/reader/add-feed-dialog.types.ts",
  "src/components/reader/browser-view.types.ts",
  "src/components/reader/command-palette.types.ts",
  "src/components/reader/feed-tree.types.ts",
  "src/components/reader/rename-feed-dialog.types.ts",
  "src/components/reader/sidebar-feed-section.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/reader/sidebar.types.ts",
] as const;

const settingsTypeSurfaceFiles = ["src/components/settings/settings-page.types.ts"] as const;

const localOnlyTypeSurfaceFiles = [
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
] as const;

const cleanupContractTestFiles = {
  semanticTokenAndRoleContracts: [
    "src/__tests__/components/article-filter-toggle-button.test.ts",
    "src/__tests__/components/article-list-context-strip.test.tsx",
    "src/__tests__/components/article-list-footer.test.tsx",
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/surface-card.test.tsx",
  ],
  readerPureHelperContracts: [
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/feed-mark-all-read.node.test.ts",
    "src/__tests__/components/use-article-list-navigation.node.test.tsx",
  ],
  publicWrapperSurfaceContracts: ["src/__tests__/components/ui-wrapper-public-api.node.test.ts"],
} as const;

const typeSurfaceSearchDirectories = [
  "src/components/reader",
  "src/components/settings",
  "src/__tests__/components",
  "src/__tests__/hooks",
] as const;

const remainingTypeSurfaceSearchDirectories = [
  "src/components/reader",
  "src/components/settings",
  "src/lib/subscriptions",
  "src/lib/sync",
  "src/lib/ui",
  "src/stores",
] as const;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

const typeSurfaceHelper = createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories: typeSurfaceSearchDirectories,
});

const remainingTypeSurfaceHelper = createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories: remainingTypeSurfaceSearchDirectories,
});

const publicContractAllowlist = {
  reader: {
    label: "reader public contract allowlist",
    typeFileList: readerTypeSurfaceFiles,
  },
  settings: {
    label: "settings public contract allowlist",
    typeFileList: settingsTypeSurfaceFiles,
  },
} as const satisfies Record<string, TypeSurfaceContract>;

const viewLocalPropsBlacklist = {
  label: "view-local props blacklist",
  typeFileList: localOnlyTypeSurfaceFiles,
} as const satisfies TypeSurfaceContract;

describe("reader type surface", () => {
  it("tracks the reader feature-local type split candidates", () => {
    typeSurfaceHelper.assertTypeFileList(publicContractAllowlist.reader);
  });

  it("keeps exported reader type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(publicContractAllowlist.reader)).toEqual([]);
  });

  it("tracks settings feature-local type split candidates", () => {
    typeSurfaceHelper.assertTypeFileList(publicContractAllowlist.settings);
  });

  it("keeps exported settings type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(publicContractAllowlist.settings)).toEqual([]);
  });

  it("tracks local-only exported Props/Params/Result cleanup candidates", () => {
    typeSurfaceHelper.assertTypeFileList(viewLocalPropsBlacklist);
  });

  it("keeps local-only exported type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(viewLocalPropsBlacklist)).toEqual([]);
  });

  it("keeps remaining .types.ts files on an explicit ratchet allowlist", () => {
    remainingTypeSurfaceHelper.assertRemainingTypeSurfaceAllowlist({
      label: "remaining type surface allowlist",
      typeFileList: remainingTypeSurfaceAllowlist,
    });
  });

  it("tracks small cleanup contracts without adding broad visual snapshots", () => {
    const contractTestFiles = Object.values(cleanupContractTestFiles).flat();

    expect(contractTestFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);

    for (const contractTestFile of contractTestFiles) {
      const source = readRepoFile(contractTestFile);

      expect(source, `${contractTestFile} should avoid snapshot-based visual coverage`).not.toContain(
        "toMatchSnapshot",
      );
      expect(source, `${contractTestFile} should stay focused on contract assertions`).toMatch(
        /toHaveAttribute|toHaveClass|expectTypeOf|toEqual|toContain|toBe|toHaveBeenCalledWith/,
      );
    }
  });
});
