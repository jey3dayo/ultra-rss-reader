import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import syncFlowModSource from "../../../src-tauri/src/service/sync_flow/mod.rs?raw";

// Structural regression guard for plans/022-remote-entry-materialization.md:
// RemoteEntry -> Article field materialization must go through the single
// `article_from_remote_entry` function in service/sync_flow/mod.rs, and the
// `articles` table upsert SQL must live only in
// infra/db/sqlite_article.rs::upsert_articles_with_conn. Before this plan,
// both were duplicated across 4-5 call sites that could silently drift.
//
// This is a name/string based scan, not full enforcement: a rename, a new
// id-generation helper, a different SQL statement shape (e.g. dynamic SQL or
// a second `INSERT INTO articles`), or hand-inlining the RemoteEntry->Article
// copy again under a different function name would all slip past it. It
// exists to catch the common regression (a new sync path reintroducing an
// inline copy) before it reaches review, not to prove the invariant holds
// for all possible code shapes.

const srcTauriSrcRoot = join(process.cwd(), "src-tauri/src");

function collectRustFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectRustFiles(fullPath);
    }
    if (entry.name.endsWith(".rs") && statSync(fullPath).isFile()) {
      return [fullPath];
    }
    return [];
  });
}

// Excludes each file's own `#[cfg(test)] mod tests { ... }` block (or, for a
// module split into its own file via `mod tests;`, treats the whole
// referenced file as test-only) so fixture-only `INSERT INTO articles` and
// `generate_entry_id(` calls used to build expected test values don't count
// as production duplicates. Detection is generic per file (first `mod tests`
// boundary), not hardcoded to any single file's layout, since the scanned
// tree mixes both inline test modules and file-split test modules.
// Files declared entirely as test-only via `#[cfg(test)] mod <name>;` in
// their parent (a file-split test module, not an inline `mod tests { ... }`
// block), so none of their content is a production call site.
const WHOLE_FILE_TEST_ONLY_BASENAMES = new Set(["tests.rs", "test_fixtures.rs"]);

function productionSource(filePath: string, source: string): string {
  if (WHOLE_FILE_TEST_ONLY_BASENAMES.has(basename(filePath))) {
    return "";
  }
  const testModuleMatch = source.match(/\nmod tests[\s;{]/);
  if (!testModuleMatch || testModuleMatch.index === undefined) {
    return source;
  }
  return source.slice(0, testModuleMatch.index);
}

function collectProductionMatches(pattern: RegExp): Map<string, number> {
  const files = collectRustFiles(srcTauriSrcRoot);
  const countsByFile = new Map<string, number>();
  for (const file of files) {
    const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
    const source = readFileSync(file, "utf8");
    const production = productionSource(file, source);
    const matchCount = [...production.matchAll(pattern)].length;
    if (matchCount > 0) {
      countsByFile.set(relPath, matchCount);
    }
  }
  return countsByFile;
}

describe("remote-entry materialization contract", () => {
  it("limits production `generate_entry_id(` calls to the single materializer in sync_flow", () => {
    const counts = collectProductionMatches(/generate_entry_id\(/g);

    // `fn generate_entry_id(` (the definition, in domain/article.rs) also
    // matches this substring pattern, so it is expected to show 1 alongside
    // the single production call site inside sync_flow's
    // `article_from_remote_entry`.
    expect(counts).toEqual(
      new Map([
        ["domain/article.rs", 1],
        ["service/sync_flow/mod.rs", 1],
      ]),
    );
  });

  it("keeps article_from_remote_entry as the only body calling generate_entry_id", () => {
    const fnMatch = syncFlowModSource.match(
      /pub\(crate\) fn article_from_remote_entry\([\s\S]*?\) -> Article \{([\s\S]*?)\n\}/,
    );
    if (!fnMatch) {
      throw new Error("Could not find article_from_remote_entry in service/sync_flow/mod.rs");
    }
    const body = fnMatch[1];
    expect(body).toContain("generate_entry_id(");
    expect(body.split("generate_entry_id(").length - 1).toBe(1);
  });

  it("limits production `INSERT INTO articles` SQL to infra/db/sqlite_article.rs", () => {
    // Matches `INSERT INTO articles (` / `INSERT INTO articles\n` but not
    // `INSERT INTO articles_fts(...)`, which is a separate FTS shadow table
    // with its own insert statements in infra/db/connection.rs.
    const counts = collectProductionMatches(/INSERT INTO articles[\s(]/g);

    expect(counts).toEqual(new Map([["infra/db/sqlite_article.rs", 1]]));
  });

  it("does not misclassify known test-fixture `INSERT INTO articles` call sites as production", () => {
    // These files build article rows directly via SQL in their own test
    // fixtures (not through upsert_articles_with_conn) and previously would
    // have been false positives for a naive whole-file scan.
    const knownFixtureFiles = [
      "commands/article_commands.rs",
      "infra/db/sqlite_feed/mod.rs",
      "infra/db/connection.rs",
      "infra/db/sqlite_account.rs",
      "infra/db/sqlite_tag.rs",
      "infra/db/backup.rs",
      "infra/db/sqlite_mute_keyword.rs",
      "infra/db/sqlite_feed/unread.rs",
      "infra/db/migration/tests.rs",
      "commands/tag_commands.rs",
      "commands/sync_commands.rs",
      "service/local_account_sync.rs",
      "service/local_account_sync_apply.rs",
    ];
    const counts = collectProductionMatches(/INSERT INTO articles[\s(]/g);

    for (const relPath of knownFixtureFiles) {
      expect(counts.has(relPath)).toBe(false);
    }
  });
});
