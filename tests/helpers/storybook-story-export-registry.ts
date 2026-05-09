type StorybookMetaLike = {
  component: unknown;
  args?: unknown;
  parameters?: unknown;
  globals?: unknown;
  render?: unknown;
  decorators?: unknown;
};

type StorybookStoryModuleWithMeta = {
  default: StorybookMetaLike;
  [exportName: string]: unknown;
};

type StorybookNamedStoryLike = {
  args?: unknown;
  parameters?: unknown;
  globals?: unknown;
  render?: unknown;
  decorators?: unknown;
};

export type StorybookStoryExportRegistryEntry = {
  filePath: string;
  defaultMeta: StorybookMetaLike;
  storyExportNames: string[];
  allowedNonStoryExportNames: string[];
};

type StorybookHelperExportAllowlistEntry = {
  storyFilePath: string;
  helperExportName: string;
};

// UI Reference canvases are exported so component-level registry tests can assert specimen coverage.
// Normal story files must keep helper components private and expose only Storybook story objects.
const STORYBOOK_HELPER_EXPORT_ALLOWLIST: StorybookHelperExportAllowlistEntry[] = [
  {
    storyFilePath: "/src/components/storybook/ui-reference-button-controls-canvas.stories.tsx",
    helperExportName: "ButtonControlsCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-foundations-canvas.stories.tsx",
    helperExportName: "FoundationsCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx",
    helperExportName: "NavigationCollectionsCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-settings-canvas.stories.tsx",
    helperExportName: "InputControlsCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx",
    helperExportName: "SettingsWorkspaceCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx",
    helperExportName: "ShellOverlayCanvas",
  },
  {
    storyFilePath: "/src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx",
    helperExportName: "ViewSpecimensCanvas",
  },
];

const STORYBOOK_HELPER_EXPORT_ALLOWLIST_IDS = new Set(
  STORYBOOK_HELPER_EXPORT_ALLOWLIST.map(
    ({ storyFilePath, helperExportName }) => `${storyFilePath}#${helperExportName}`,
  ),
);

const storyModules = import.meta.glob<unknown>("/src/**/*.stories.tsx", {
  eager: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function describeStorybookValue(value: unknown) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function hasStorybookMetaComponent(value: Record<string, unknown>) {
  return "component" in value && value.component !== undefined;
}

function isStorybookMetaLike(value: unknown): value is StorybookMetaLike {
  return isRecord(value) && hasStorybookMetaComponent(value);
}

function describeStorybookMetaIssue(value: unknown) {
  if (!isRecord(value)) {
    return `received ${describeStorybookValue(value)}`;
  }

  return hasStorybookMetaComponent(value) ? "received invalid meta" : "missing component";
}

function isStorybookStoryModuleWithMeta(value: unknown): value is StorybookStoryModuleWithMeta {
  return isRecord(value) && isStorybookMetaLike(value.default);
}

function describeStorybookStoryModuleIssue(value: unknown) {
  if (Array.isArray(value)) {
    return "module must be an object (array)";
  }

  if (!isRecord(value)) {
    return `module must be an object (${describeStorybookValue(value)})`;
  }

  return `default export must be a Storybook meta-like object with component (${describeStorybookMetaIssue(
    value.default,
  )})`;
}

function isStorybookNamedStoryLike(value: unknown): value is StorybookNamedStoryLike {
  return isRecord(value) && !Array.isArray(value);
}

function isAllowlistedStorybookHelperExport(filePath: string, helperExportName: string) {
  return STORYBOOK_HELPER_EXPORT_ALLOWLIST_IDS.has(`${filePath}#${helperExportName}`);
}

export function collectStorybookStoryExportRegistry(storyModulesByPath: Record<string, unknown>) {
  const registry: StorybookStoryExportRegistryEntry[] = [];
  const issues: string[] = [];

  for (const [filePath, storyModule] of Object.entries(storyModulesByPath).toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!isStorybookStoryModuleWithMeta(storyModule)) {
      issues.push(`${filePath}: ${describeStorybookStoryModuleIssue(storyModule)}`);
      continue;
    }

    const defaultMeta = storyModule.default;
    const storyExportNames: string[] = [];
    const allowedNonStoryExportNames: string[] = [];

    for (const [exportName, exportValue] of Object.entries(storyModule).toSorted(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (exportName === "default") {
        continue;
      }

      if (isStorybookNamedStoryLike(exportValue)) {
        storyExportNames.push(exportName);
        continue;
      }

      if (isAllowlistedStorybookHelperExport(filePath, exportName)) {
        allowedNonStoryExportNames.push(exportName);
        continue;
      }

      issues.push(`${filePath}: named export "${exportName}" must be a story object or an allowlisted helper`);
    }

    if (storyExportNames.length === 0) {
      issues.push(`${filePath}: expected at least one named story object export`);
    }

    registry.push({
      filePath,
      defaultMeta,
      storyExportNames,
      allowedNonStoryExportNames,
    });
  }

  return { registry, issues };
}

const storyRegistryResult = collectStorybookStoryExportRegistry(storyModules);

export const storybookStoryExportRegistry = storyRegistryResult.registry;
export const storybookStoryRegistryIssues = storyRegistryResult.issues;
