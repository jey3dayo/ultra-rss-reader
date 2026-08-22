import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import accountRsSource from "../../../src-tauri/src/commands/sync_providers/account.rs?raw";
import unreadReconcileSource from "../../../src-tauri/src/commands/sync_providers/unread.rs?raw";

// Structural regression guard for .claude/rules/remote-state-reconciliation.md
// (plan 021): the pending-mutation protection list must be re-read inside the
// same DB lock as the apply that overwrites local state with remote state.
//
// This is a name-based scan, not full enforcement: a rename, a call through a
// new trait indirection, or a fresh raw-SQL UPDATE path could slip past it.
// It exists to catch the common regression (a new caller reintroducing the
// two-lock TOCTOU window) before it reaches review, not to prove the
// invariant holds for all possible code shapes.

const srcTauriSrcRoot = join(process.cwd(), "src-tauri/src");
const ACCOUNT_RS_REL_PATH = "commands/sync_providers/account.rs";
const UNREAD_RS_REL_PATH = "commands/sync_providers/unread.rs";

// Files allowed to call `.apply_remote_state(` outside test code, other than
// account.rs's `apply_remote_state_with_protection` (checked at the block level
// below, since account.rs also contains many unrelated functions):
// - infra/db/sqlite_article.rs: the trait implementation itself. The only
//   `.apply_remote_state(` matches in this file are its own `#[cfg(test)]`
//   unit tests calling the method on a repo instance; the definition itself
//   is `fn apply_remote_state(` (no leading dot) and doesn't match.
const ALLOWLISTED_APPLY_REMOTE_STATE_CALL_FILES = new Set(["infra/db/sqlite_article.rs"]);

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

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (matched === undefined) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

function productionSourceExcludingTestModule(source: string): string {
  const testModuleStart = source.indexOf("\nmod tests {");
  if (testModuleStart === -1) {
    // The inline test module has been extracted to its own file; the whole
    // source is production code.
    return source;
  }
  return source.slice(0, testModuleStart);
}

const HELPER_FN_PATTERN =
  /fn apply_remote_state_with_protection\([\s\S]*?\) -> Result<\(\), AppError> \{([\s\S]*?)\n\}/;

describe("remote-state apply lock contract", () => {
  it("limits non-test `.apply_remote_state(` call sites to the sanctioned allowlist", () => {
    const files = collectRustFiles(srcTauriSrcRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
      if (relPath === ACCOUNT_RS_REL_PATH) {
        // account.rs is checked below at the block level: only the sanctioned
        // helper may contain `.apply_remote_state(`, and nothing else in the
        // file (outside its test module) may.
        continue;
      }
      if (ALLOWLISTED_APPLY_REMOTE_STATE_CALL_FILES.has(relPath)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (source.includes(".apply_remote_state(")) {
        offenders.push(relPath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps apply_remote_state_with_protection as account.rs's only `.apply_remote_state(` caller", () => {
    const helperBody = extractBlock(accountRsSource, HELPER_FN_PATTERN, "apply_remote_state_with_protection body");

    const helperCallCount = helperBody.split(".apply_remote_state(").length - 1;
    expect(helperCallCount).toBe(1);

    const productionSource = productionSourceExcludingTestModule(accountRsSource);
    const helperStart = productionSource.indexOf("fn apply_remote_state_with_protection");
    if (helperStart === -1) {
      throw new Error("Could not find apply_remote_state_with_protection in account.rs production source");
    }
    const helperFullMatch = productionSource
      .slice(helperStart)
      .match(/fn apply_remote_state_with_protection\([\s\S]*?\) -> Result<\(\), AppError> \{[\s\S]*?\n\}/);
    if (!helperFullMatch) {
      throw new Error("Could not match the full apply_remote_state_with_protection function");
    }
    const helperEnd = helperStart + helperFullMatch[0].length;
    const restOfProductionSource = productionSource.slice(0, helperStart) + productionSource.slice(helperEnd);

    expect(restOfProductionSource).not.toContain(".apply_remote_state(");
  });

  it("keeps apply_remote_state_with_protection re-reading pending protection inside the DB lock", () => {
    const helperBody = extractBlock(accountRsSource, HELPER_FN_PATTERN, "apply_remote_state_with_protection body");

    expect(helperBody).toContain("lock_db(db)?");
    expect(helperBody).toContain("pending_remote_ids_by_axis(db_guard.reader(), account_id)?");
    expect(helperBody).toContain(".apply_remote_state(");
  });

  it("keeps the unread reconcile lock/protect/update/commit block inside a single lock_db scope", () => {
    const reconcileBody = extractBlock(
      unreadReconcileSource,
      /async fn reconcile_greader_unread_state_for_feed\([\s\S]*?\) -> Result<\(\), AppError> \{([\s\S]*?)\n\}/,
      "reconcile_greader_unread_state_for_feed body",
    );

    const lockDbCallCount = reconcileBody.split("lock_db(db)?").length - 1;
    expect(lockDbCallCount).toBe(1);

    expect(reconcileBody).toContain("super::pending_remote_ids_by_axis(db_guard.reader(), &account.id)?");
    expect(reconcileBody).toContain("UPDATE articles SET is_read");
    expect(reconcileBody).toContain("tx.commit()");
  });

  it("limits pending_remote_ids_by_axis callers to exactly one in the helper and one in the unread reconcile", () => {
    const files = collectRustFiles(srcTauriSrcRoot);
    const callCountsByFile = new Map<string, number>();

    for (const file of files) {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
      const source = readFileSync(file, "utf8");
      const callCount = [...source.matchAll(/pending_remote_ids_by_axis\(/g)].length;
      const definitionCount = source.includes("fn pending_remote_ids_by_axis(") ? 1 : 0;
      const callerCount = callCount - definitionCount;
      if (callerCount > 0) {
        callCountsByFile.set(relPath, callerCount);
      }
    }

    // Both the file-level location AND the exact per-file count are pinned:
    // a second caller added anywhere in account.rs (not just outside the helper)
    // would otherwise slip through a "file appears in the caller set" check.
    expect(callCountsByFile).toEqual(
      new Map([
        [ACCOUNT_RS_REL_PATH, 1],
        [UNREAD_RS_REL_PATH, 1],
      ]),
    );
  });
});
