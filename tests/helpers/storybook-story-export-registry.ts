type StorybookStoryModule = Record<string, unknown> & {
  default?: unknown;
};

export type StorybookStoryExportRegistryEntry = {
  filePath: string;
  defaultMeta: Record<string, unknown>;
  storyExportNames: string[];
  allowedNonStoryExportNames: string[];
};

const ALLOWED_NON_STORY_EXPORTS = new Set([
  "/src/components/reader/sidebar-selection-review.stories.tsx#SidebarSelectionReviewCanvas",
  "/src/components/storybook/ui-reference-button-controls-canvas.stories.tsx#ButtonControlsCanvas",
  "/src/components/storybook/ui-reference-foundations-canvas.stories.tsx#FoundationsCanvas",
  "/src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx#NavigationCollectionsCanvas",
  "/src/components/storybook/ui-reference-settings-canvas.stories.tsx#InputControlsCanvas",
  "/src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx#SettingsWorkspaceCanvas",
  "/src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx#ShellOverlayCanvas",
  "/src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx#ViewSpecimensCanvas",
]);

const storyModules = import.meta.glob<StorybookStoryModule>("/src/**/*.stories.tsx", { eager: true });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAllowedNonStoryExport(filePath: string, exportName: string) {
  return ALLOWED_NON_STORY_EXPORTS.has(`${filePath}#${exportName}`);
}

function collectStoryRegistry() {
  const registry: StorybookStoryExportRegistryEntry[] = [];
  const issues: string[] = [];

  for (const [filePath, storyModule] of Object.entries(storyModules).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const defaultMeta = storyModule.default;
    if (!isRecord(defaultMeta)) {
      issues.push(`${filePath}: default export must be a Storybook meta object`);
      continue;
    }

    if (!("component" in defaultMeta)) {
      issues.push(`${filePath}: default meta must define component for renderStory compatibility`);
    }

    const storyExportNames: string[] = [];
    const allowedNonStoryExportNames: string[] = [];

    for (const [exportName, exportValue] of Object.entries(storyModule).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      if (exportName === "default") {
        continue;
      }

      if (isRecord(exportValue)) {
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

const storyRegistryResult = collectStoryRegistry();

export const storybookStoryExportRegistry = storyRegistryResult.registry;
export const storybookStoryRegistryIssues = storyRegistryResult.issues;
