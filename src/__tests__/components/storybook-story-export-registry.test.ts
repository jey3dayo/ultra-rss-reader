import {
  storybookStoryExportRegistry,
  storybookStoryRegistryIssues,
} from "@tests/helpers/storybook-story-export-registry";
import { describe, expect, it } from "vitest";

describe("Storybook story export registry", () => {
  it("keeps every story file registered with a default meta and story exports", () => {
    expect(storybookStoryExportRegistry.length).toBeGreaterThan(0);
    expect(storybookStoryRegistryIssues).toEqual([]);
  });
});
