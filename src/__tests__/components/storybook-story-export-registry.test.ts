import {
  collectStorybookStoryExportRegistry,
  storybookStoryExportRegistry,
  storybookStoryRegistryIssues,
} from "@tests/helpers/storybook-story-export-registry";
import { describe, expect, it } from "vitest";

describe("Storybook story export registry", () => {
  it("keeps every story file registered with a default meta and story exports", () => {
    expect(storybookStoryExportRegistry.length).toBeGreaterThan(0);
    expect(storybookStoryRegistryIssues).toEqual([]);
  });

  it("keeps non-story helper exports limited to UI Reference canvases", () => {
    const allowedNonStoryExports = storybookStoryExportRegistry.flatMap(
      (entry) =>
        entry.allowedNonStoryExportNames.map(
          (exportName) => `${entry.filePath}#${exportName}`,
        ),
    );

    expect(allowedNonStoryExports).toEqual(
      expect.arrayContaining([
        "/src/components/storybook/ui-reference-button-controls-canvas.stories.tsx#ButtonControlsCanvas",
        "/src/components/storybook/ui-reference-foundations-canvas.stories.tsx#FoundationsCanvas",
        "/src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx#NavigationCollectionsCanvas",
        "/src/components/storybook/ui-reference-settings-canvas.stories.tsx#InputControlsCanvas",
        "/src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx#SettingsWorkspaceCanvas",
        "/src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx#ShellOverlayCanvas",
        "/src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx#ViewSpecimensCanvas",
      ]),
    );
    expect(allowedNonStoryExports).toEqual(
      allowedNonStoryExports.filter((exportId) =>
        exportId.startsWith("/src/components/storybook/ui-reference-"),
      ),
    );
  });

  it("reports invalid module shapes with focused reasons", () => {
    const { registry, issues } = collectStorybookStoryExportRegistry({
      "/src/components/bad-array.stories.tsx": [],
      "/src/components/bad-default.stories.tsx": {
        default: { title: "Missing component" },
        Default: {},
      },
      "/src/components/bad-undefined-component.stories.tsx": {
        default: { component: undefined },
        Default: {},
      },
      "/src/components/bad-story-export.stories.tsx": {
        default: { component: "div" },
        Broken: "not a story",
      },
      "/src/components/bad-array-story-export.stories.tsx": {
        default: { component: "div" },
        Broken: [],
      },
      "/src/components/no-story.stories.tsx": { default: { component: "div" } },
    });

    expect(registry.map((entry) => entry.filePath)).toEqual([
      "/src/components/bad-array-story-export.stories.tsx",
      "/src/components/bad-story-export.stories.tsx",
      "/src/components/no-story.stories.tsx",
    ]);
    expect(issues).toEqual([
      '/src/components/bad-array-story-export.stories.tsx: named export "Broken" must be a story object or an allowlisted helper',
      "/src/components/bad-array-story-export.stories.tsx: expected at least one named story object export",
      "/src/components/bad-array.stories.tsx: module must be an object (array)",
      "/src/components/bad-default.stories.tsx: default export must be a Storybook meta-like object with component (missing component)",
      '/src/components/bad-story-export.stories.tsx: named export "Broken" must be a story object or an allowlisted helper',
      "/src/components/bad-story-export.stories.tsx: expected at least one named story object export",
      "/src/components/bad-undefined-component.stories.tsx: default export must be a Storybook meta-like object with component (missing component)",
      "/src/components/no-story.stories.tsx: expected at least one named story object export",
    ]);
  });
});
