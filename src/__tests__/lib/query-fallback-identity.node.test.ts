import { describe, expect, it } from "vitest";
import commandPaletteSource from "@/components/reader/hooks/command-palette/use-command-palette-data?raw";
import feedSectionControllerSource from "@/components/reader/hooks/sidebar/use-sidebar-feed-section-controller?raw";
import feedTreeSource from "@/components/reader/hooks/sidebar/use-sidebar-feed-tree?raw";
import sidebarSourcesSource from "@/components/reader/hooks/sidebar/use-sidebar-sources?raw";

// A bare `const x = something ?? [];` allocates a new array on every render for as long as the
// query has no data — which is not a brief window, since a disabled or failed query keeps `data`
// undefined indefinitely. Every memo downstream then recomputes, and in the sidebar that reached
// an unguarded localStorage write. React Doctor reports the shape as `exhaustive-deps`, but
// neither CI nor the git hooks run it (see .claude/rules/quality-policy.md, "Nothing Runs React
// Doctor Automatically"), so this test is the only thing that fails when it comes back.
//
// The regex distinguishes the two shapes by what follows the `[]`: a statement-level binding ends
// in `;`, while the memoised form continues into the dependency array with `,`.
const BARE_EMPTY_ARRAY_BINDING = /const\s+\w+(?:\s*:[^=]+)?\s*=\s*[^;]*\?\?\s*\[\]\s*;/;

describe.each([
  ["use-command-palette-data", commandPaletteSource],
  ["use-sidebar-feed-section-controller", feedSectionControllerSource],
  ["use-sidebar-feed-tree", feedTreeSource],
  ["use-sidebar-sources", sidebarSourcesSource],
])("%s query fallbacks", (_name, source) => {
  it("keeps empty-array fallbacks referentially stable across renders", () => {
    expect(source).not.toMatch(BARE_EMPTY_ARRAY_BINDING);
  });
});
