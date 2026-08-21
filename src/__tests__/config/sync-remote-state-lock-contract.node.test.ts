import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import applyRemoteStateWithProtectionSource from "../../../src-tauri/src/commands/sync_providers/mod.rs?raw";
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

// The only files allowed to call `.apply_remote_state(` outside test code:
// - commands/sync_providers/mod.rs: defines `apply_remote_state_with_protection`,
//   the sole sanctioned caller of the trait method.
// - infra/db/sqlite_article.rs: the trait implementation itself (plus its own
//   unit tests).
// - service/sync_flow/mod.rs: explicitly out of scope for plan 021. This is a
//   generic sync flow not reachable from the production FreshRSS/Local
//   command paths (only integration tests exercise it) and has a different
//   repository-DI lock-ownership shape. See plan 021 "設計判断". Resolving
//   this decoy is deferred to the separate "候補2" architecture decision.
const ALLOWLISTED_APPLY_REMOTE_STATE_CALL_FILES = new Set([
  "commands/sync_providers/mod.rs",
  "infra/db/sqlite_article.rs",
  "service/sync_flow/mod.rs",
]);

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

describe("remote-state apply lock contract", () => {
  it("limits non-test `.apply_remote_state(` call sites to the sanctioned allowlist", () => {
    const files = collectRustFiles(srcTauriSrcRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
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

  it("keeps apply_remote_state_with_protection re-reading pending protection inside the DB lock", () => {
    const helperBody = extractBlock(
      applyRemoteStateWithProtectionSource,
      /fn apply_remote_state_with_protection\([\s\S]*?\) -> Result<\(\), AppError> \{([\s\S]*?)\n\}/,
      "apply_remote_state_with_protection body",
    );

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

  it("limits pending_remote_ids_by_axis callers to the helper and the unread reconcile", () => {
    const files = collectRustFiles(srcTauriSrcRoot);
    const callerFiles: string[] = [];

    for (const file of files) {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
      const source = readFileSync(file, "utf8");
      const callCount = [...source.matchAll(/pending_remote_ids_by_axis\(/g)].length;
      const definitionCount = source.includes("fn pending_remote_ids_by_axis(") ? 1 : 0;
      if (callCount - definitionCount > 0) {
        callerFiles.push(relPath);
      }
    }

    expect(callerFiles.sort()).toEqual(["commands/sync_providers/mod.rs", "commands/sync_providers/unread.rs"]);
  });
});
