type StorybookDefaultMetaLike = {
  component: unknown;
  args?: unknown;
  parameters?: unknown;
  globals?: unknown;
  render?: unknown;
  decorators?: unknown;
};

type StorybookStoryModuleLike = {
  default: StorybookDefaultMetaLike;
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
  defaultMeta: StorybookDefaultMetaLike;
  storyExportNames: string[];
  allowedNonStoryExportNames: string[];
};

const ALLOWED_NON_STORY_EXPORTS = new Set([
  // UI Reference canvases are exported so component-level registry tests can assert specimen coverage.
  // Normal story files must keep helper components private and expose only Storybook story objects.
  "/src/components/storybook/ui-reference-button-controls-canvas.stories.tsx#ButtonControlsCanvas",
  "/src/components/storybook/ui-reference-foundations-canvas.stories.tsx#FoundationsCanvas",
  "/src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx#NavigationCollectionsCanvas",
  "/src/components/storybook/ui-reference-settings-canvas.stories.tsx#InputControlsCanvas",
  "/src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx#SettingsWorkspaceCanvas",
  "/src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx#ShellOverlayCanvas",
  "/src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx#ViewSpecimensCanvas",
]);

const storyModules = import.meta.glob<unknown>("/src/**/*.stories.tsx", { eager: true });

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

function isStorybookDefaultMetaLike(value: unknown): value is StorybookDefaultMetaLike {
  return isRecord(value) && "component" in value;
}

function describeStorybookDefaultMetaIssue(value: unknown) {
  if (!isRecord(value)) {
    return `received ${describeStorybookValue(value)}`;
  }

  return "missing component";
}

function isStorybookStoryModuleLike(value: unknown): value is StorybookStoryModuleLike {
  return isRecord(value) && isStorybookDefaultMetaLike(value.default);
}

function describeStorybookStoryModuleIssue(value: unknown) {
  if (Array.isArray(value)) {
    return "module must be an object (array)";
  }

  if (!isRecord(value)) {
    return `module must be an object (${describeStorybookValue(value)})`;
  }

  return `default export must be a Storybook meta object with component (${describeStorybookDefaultMetaIssue(
    value.default,
  )})`;
}

function isStorybookNamedStoryLike(value: unknown): value is StorybookNamedStoryLike {
  return isRecord(value);
}

function isAllowedNonStoryExport(filePath: string, exportName: string) {
  return ALLOWED_NON_STORY_EXPORTS.has(`${filePath}#${exportName}`);
}

export function collectStorybookStoryExportRegistry(storyModulesByPath: Record<string, unknown>) {
  const registry: StorybookStoryExportRegistryEntry[] = [];
  const issues: string[] = [];

  for (const [filePath, storyModule] of Object.entries(storyModulesByPath).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!isStorybookStoryModuleLike(storyModule)) {
      issues.push(`${filePath}: ${describeStorybookStoryModuleIssue(storyModule)}`);
      continue;
    }

    const defaultMeta = storyModule.default;
    const storyExportNames: string[] = [];
    const allowedNonStoryExportNames: string[] = [];

    for (const [exportName, exportValue] of Object.entries(storyModule).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (exportName === "default") {
        continue;
      }

      if (isStorybookNamedStoryLike(exportValue)) {
        storyExportNames.push(exportName);
        continue;
      }

      if (isAllowedNonStoryExport(filePath, exportName)) {
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
