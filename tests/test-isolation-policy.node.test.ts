import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("test isolation policy contract", () => {
  it("keeps Vitest projects split without disabling file isolation", () => {
    const vitestConfig = readRepoFile("vitest.config.ts");

    expect(vitestConfig).not.toMatch(/src\/__tests__\/components\/\*\*/);
    expect(vitestConfig).not.toMatch(/src\/__tests__\/lib\/\*\*/);
    expect(vitestConfig).not.toMatch(/\bisolate\s*:\s*false\b/);
    expect(vitestConfig).not.toMatch(/\bmaxWorkers\s*:/);
    expect(vitestConfig).not.toMatch(/\benvironmentMatchGlobs\s*:/);
    expect(vitestConfig).not.toMatch(/\bpoolOptions\s*:/);
  });

  it("keeps reset-resistant Rust OnceLock state wrapped in mutex-owned contracts", () => {
    const syncSchedulerSources = [
      "src-tauri/src/service/sync_scheduler/mod.rs",
      "src-tauri/src/service/sync_scheduler/scheduling.rs",
      "src-tauri/src/service/sync_scheduler/backoff.rs",
    ].map(readRepoFile);
    const rustSources = [
      readRepoFile("src-tauri/src/menu.rs"),
      ...syncSchedulerSources,
      ...[
        "mod.rs",
        "browser.rs",
        "integrity.rs",
        "mutations/mod.rs",
        "mutations/bulk.rs",
        "mutations/single.rs",
        "queries.rs",
        "tests.rs",
      ].map((file) => readRepoFile(`src-tauri/src/commands/article_commands/${file}`)),
    ];

    for (const source of rustSources) {
      for (const match of source.matchAll(/static\s+\w+:\s+OnceLock<([^>]+)>/g)) {
        expect(match[1], match[0]).toContain("Mutex");
      }
    }
  });
});
