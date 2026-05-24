import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const checkedFiles = [
  "src/components/shared/surface-card.tsx",
  "src/components/shared/feed-favicon.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/button-variants.ts",
  "src/components/ui/input.tsx",
  "src/components/ui/dialog.tsx",
  "src/components/ui/command.tsx",
  "src/components/ui/scroll-area.tsx",
  "src/components/settings/shared/settings-content-layout.tsx",
] as const;

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("shared radius contract", () => {
  it("keeps shared primitives on radius scale utilities or inherited radius", () => {
    const literalRadiusUsages = checkedFiles.flatMap((path) => {
      const source = readWorkspaceFile(path);
      return [...source.matchAll(/rounded-\[(?!inherit\])([^\]]+)\]|borderRadius|border-radius/g)].map(
        (match) => `${path}: ${match[0]}`,
      );
    });

    expect(literalRadiusUsages).toEqual([]);
  });
});
