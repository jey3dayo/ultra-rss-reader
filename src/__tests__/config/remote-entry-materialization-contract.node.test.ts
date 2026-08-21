import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
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

// Finds the index of the character that closes the brace opened at
// `openBraceIndex`. This is a lightweight Rust lexer, not a full parser: it
// skips line/block comments, normal and raw string literals, and char
// literals so braces inside them (e.g. a deliberately malformed-JSON string
// used to test error handling, or a mockito response body) never affect
// depth counting. It does not handle nested `/* */` block comments or byte
// string prefixes (`b"..."`, `br"..."`), which are not used inside any
// `#[cfg(test)]` module block in this codebase today.
function findMatchingBraceEnd(source: string, openBraceIndex: number): number {
  let depth = 0;
  let i = openBraceIndex;
  const n = source.length;
  while (i < n) {
    const ch = source[i];

    if (ch === "/" && source[i + 1] === "/") {
      const newlineIndex = source.indexOf("\n", i);
      i = newlineIndex === -1 ? n : newlineIndex + 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const closeIndex = source.indexOf("*/", i + 2);
      i = closeIndex === -1 ? n : closeIndex + 2;
      continue;
    }
    if (ch === "r" && /^r#*"/.test(source.slice(i, i + 8))) {
      const rawOpenMatch = /^r(#*)"/.exec(source.slice(i));
      if (rawOpenMatch) {
        const closer = `"${rawOpenMatch[1]}`;
        const contentStart = i + rawOpenMatch[0].length;
        const closeIndex = source.indexOf(closer, contentStart);
        i = closeIndex === -1 ? n : closeIndex + closer.length;
        continue;
      }
    }
    if (ch === '"') {
      i += 1;
      while (i < n) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === "'") {
      // Only a real `'x'` / `'\x'` char literal is consumed as one unit;
      // a lifetime tick (`'a`, `&'static`) has no closing quote and falls
      // through to being scanned character-by-character as normal, which is
      // safe since lifetime identifiers never contain braces.
      const charLiteralMatch = /^'(\\.|[^'\\\n])'/.exec(source.slice(i));
      if (charLiteralMatch) {
        i += charLiteralMatch[0].length;
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

// Finds every inline `#[cfg(test)] mod <name> { ... }` block in `source` by
// pairing the `#[cfg(test)]` attribute with the module keyword that
// immediately follows it, then resolving the block's real extent via brace
// balancing (not "everything after the first `mod tests` substring"). A
// `mod tests { ... }` block WITHOUT a preceding `#[cfg(test)]` attribute is
// production code and is intentionally left untouched.
function findAttributeGatedInlineTestModuleBlocks(source: string): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const attrPattern = /#\[cfg\(test\)\]\s*\r?\n\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{/g;
  let match: RegExpExecArray | null = attrPattern.exec(source);
  while (match !== null) {
    const openBraceIndex = match.index + match[0].length - 1;
    const blockEnd = findMatchingBraceEnd(source, openBraceIndex);
    if (blockEnd === -1) {
      throw new Error(`Could not find matching closing brace for cfg(test) module starting at index ${match.index}`);
    }
    blocks.push({ start: match.index, end: blockEnd + 1 });
    match = attrPattern.exec(source);
  }
  return blocks;
}

// Resolves whether `filePath` is declared entirely as a test module via
// `#[cfg(test)] mod <name>;` (no body) in its directory's `mod.rs`, i.e. a
// file-split test module such as `service/sync_flow/tests.rs` declared by
// `service/sync_flow/mod.rs`. Returns false (never excludes) when the parent
// `mod.rs` is missing or does not contain a matching cfg-gated declaration,
// so an unverifiable basename can never cause a false exclusion.
function isDeclaredAsCfgTestOnlyModule(filePath: string): boolean {
  const dir = dirname(filePath);
  const moduleName = basename(filePath, ".rs");
  const parentModPath = join(dir, "mod.rs");
  if (parentModPath === filePath || !existsSync(parentModPath)) {
    return false;
  }
  const parentSource = readFileSync(parentModPath, "utf8");
  const escapedName = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarationPattern = new RegExp(
    `#\\[cfg\\(test\\)\\]\\s*\\r?\\n\\s*(?:pub(?:\\([^)]*\\))?\\s+)?mod\\s+${escapedName}\\s*;`,
  );
  return declarationPattern.test(parentSource);
}

// Excludes production-irrelevant test code from `source` so fixture-only
// `INSERT INTO articles` and `generate_entry_id(` calls used to build
// expected test values don't count as production duplicates:
// - a file declared entirely as a test module by its parent `mod.rs`
//   (verified via `isDeclaredAsCfgTestOnlyModule`, not by basename alone)
//   contributes nothing;
// - otherwise, every `#[cfg(test)]`-gated inline `mod <name> { ... }` block
//   is removed by its verified brace-balanced extent.
// A `mod tests { ... }` block without the `#[cfg(test)]` attribute is
// production code and is never removed.
function productionSource(filePath: string, source: string): string {
  if (isDeclaredAsCfgTestOnlyModule(filePath)) {
    return "";
  }
  const blocks = findAttributeGatedInlineTestModuleBlocks(source);
  if (blocks.length === 0) {
    return source;
  }
  let result = "";
  let cursor = 0;
  for (const block of blocks) {
    result += source.slice(cursor, block.start);
    cursor = block.end;
  }
  result += source.slice(cursor);
  return result;
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

  describe("productionSource extraction hardening", () => {
    it("does not exclude a production `mod tests { ... }` block lacking the #[cfg(test)] attribute", () => {
      const source = [
        "fn production_helper() {",
        "    generate_entry_id(1);",
        "}",
        "",
        "mod tests {",
        "    fn some_helper() {}",
        "}",
        "",
        "fn another_production_fn() {",
        "    generate_entry_id(2);",
        "}",
        "",
      ].join("\n");

      const result = productionSource(join(srcTauriSrcRoot, "synthetic_no_cfg_gate.rs"), source);

      // Both call sites survive: the one before the ungated `mod tests`
      // block, and the one textually placed after it, since the block is
      // never a sanctioned test-module exclusion without the attribute.
      expect(result.split("generate_entry_id(").length - 1).toBe(2);
      expect(result).toContain("some_helper");
    });

    it("excludes an attribute-gated inline `mod tests { ... }` block by its real brace-balanced extent", () => {
      const source = [
        "fn production_helper() {",
        "    generate_entry_id(1);",
        "}",
        "",
        "#[cfg(test)]",
        "mod tests {",
        "    fn nested() {",
        '        let json = "{\\"a\\": {\\"b\\": 1}}";',
        "        generate_entry_id(2);",
        "    }",
        "}",
        "",
        "fn after_test_module() {",
        "    generate_entry_id(3);",
        "}",
        "",
      ].join("\n");

      const result = productionSource(join(srcTauriSrcRoot, "synthetic_cfg_gate.rs"), source);

      // Only the calls outside the gated block survive; the gated block's
      // own call and its nested (already-balanced) JSON braces are removed
      // together as one unit.
      expect(result.split("generate_entry_id(").length - 1).toBe(2);
      expect(result).not.toContain("nested");
      expect(result).toContain("after_test_module");
    });

    it("only excludes a whole file when the parent mod.rs declares it as a verified cfg(test)-only module", () => {
      const parentDir = join(srcTauriSrcRoot, "service", "sync_flow");
      const declaredTestOnlyFile = join(parentDir, "tests.rs");
      const source = "fn helper() {\n    generate_entry_id(1);\n}\n";

      expect(isDeclaredAsCfgTestOnlyModule(declaredTestOnlyFile)).toBe(true);
      expect(productionSource(declaredTestOnlyFile, source)).toBe("");

      // A same-named file in a directory whose mod.rs never declares it
      // (or has no mod.rs at all) is not excluded merely by basename.
      const undeclaredFile = join(srcTauriSrcRoot, "domain", "tests.rs");
      expect(isDeclaredAsCfgTestOnlyModule(undeclaredFile)).toBe(false);
      expect(productionSource(undeclaredFile, source)).toBe(source);
    });
  });
});
