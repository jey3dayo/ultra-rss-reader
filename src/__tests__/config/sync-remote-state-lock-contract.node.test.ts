import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { collectRustFiles } from "@tests/helpers/rust-source-files";
import { describe, expect, it } from "vitest";
import accountRsSource from "../../../src-tauri/src/commands/sync_providers/account/remote_state.rs?raw";
import unreadReconcileSource from "../../../src-tauri/src/commands/sync_providers/unread/mod.rs?raw";

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
// account.rs was split by responsibility (plan: refactor/account-rs-split);
// apply_remote_state_with_protection and pending_remote_ids_by_axis now live
// in account/remote_state.rs, paired per
// .claude/rules/remote-state-reconciliation.md. The other former account.rs
// functions moved to account/{mod,warnings,feeds,entries,db}.rs.
const ACCOUNT_RS_REL_PATH = "commands/sync_providers/account/remote_state.rs";
const UNREAD_RS_REL_PATH = "commands/sync_providers/unread/mod.rs";

// Files allowed to call `.apply_remote_state(` outside test code, other than
// account.rs's `apply_remote_state_with_protection` (checked at the block level
// below, since account.rs also contains many unrelated functions):
// - infra/db/sqlite_article/tests.rs: the only `.apply_remote_state(` matches
//   here are its own `#[cfg(test)]` unit tests calling the method on a repo
//   instance. The trait implementation itself lives in
//   infra/db/sqlite_article/remote_state.rs as `fn apply_remote_state(` (no
//   leading dot, so it doesn't match).
const ALLOWLISTED_APPLY_REMOTE_STATE_CALL_FILES = new Set(["infra/db/sqlite_article/tests.rs"]);

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

// Structural regression guard for plan 025 (`.claude/rules/remote-state-reconciliation.md`
// enforcement list): every `lock_db(` acquisition in `commands/sync_providers/**` production
// code must live inside a named, single-purpose function (never an unnamed inline scope in an
// async orchestrator), and each such function acquires the lock exactly once. New lock scopes
// must be added as a new named function and registered here; that update is also the prompt to
// re-check whether the new scope needs to re-read pending-mutation protection lists before an
// `apply_remote_state` call, per `.claude/rules/remote-state-reconciliation.md`.
const SYNC_PROVIDERS_REL_DIR = "commands/sync_providers";

// [relative file path, function name] pairs allowed to call `lock_db(` in
// commands/sync_providers/** production code. Keep sorted by file, then by name.
const SYNC_PROVIDERS_LOCK_DB_ALLOWLIST: ReadonlyArray<readonly [string, string]> = [
  ["commands/sync_providers/account/db.rs", "delete_pending_mutation"],
  ["commands/sync_providers/account/db.rs", "load_account_feeds"],
  ["commands/sync_providers/account/db.rs", "load_feed_sync_state"],
  ["commands/sync_providers/account/db.rs", "load_folder_remote_id_map"],
  ["commands/sync_providers/account/db.rs", "load_pending_mutations_for_account"],
  ["commands/sync_providers/account/db.rs", "persist_pulled_account_articles"],
  ["commands/sync_providers/account/db.rs", "persist_pulled_feed_articles"],
  ["commands/sync_providers/account/db.rs", "provider_managed_feed_snapshots"],
  ["commands/sync_providers/account/db.rs", "recalculate_feed_unread_counts"],
  ["commands/sync_providers/account/db.rs", "recalculate_provider_managed_feed_unread_counts"],
  ["commands/sync_providers/account/db.rs", "recalculate_single_feed_unread_count"],
  ["commands/sync_providers/account/db.rs", "save_feed_sync_state"],
  ["commands/sync_providers/account/db.rs", "save_greader_folders_snapshot"],
  ["commands/sync_providers/account/remote_state.rs", "apply_remote_state_with_protection"],
  ["commands/sync_providers/local.rs", "commit_local_feed_sync_result"],
  ["commands/sync_providers/local.rs", "load_local_feed_sync_state"],
  ["commands/sync_providers/state.rs", "article_count_for_feed"],
  ["commands/sync_providers/state.rs", "load_sync_state"],
  ["commands/sync_providers/state.rs", "save_sync_state"],
  ["commands/sync_providers/subscriptions.rs", "delete_missing_greader_folders"],
  ["commands/sync_providers/subscriptions.rs", "delete_missing_greader_subscriptions"],
  ["commands/sync_providers/subscriptions.rs", "pending_mutation_ids_targeting_provider_managed_greader_feeds"],
  ["commands/sync_providers/subscriptions.rs", "pending_mutation_log_contexts"],
  ["commands/sync_providers/subscriptions.rs", "provider_managed_remote_feed_ids"],
  ["commands/sync_providers/subscriptions.rs", "save_greader_subscriptions"],
  ["commands/sync_providers/unread/mod.rs", "fetch_local_unread_counts"],
  ["commands/sync_providers/unread/mod.rs", "reconcile_greader_unread_counts"],
  ["commands/sync_providers/unread/mod.rs", "reconcile_greader_unread_state_for_feed"],
];

function sortLockDbPairs(pairs: ReadonlyArray<readonly [string, string]>): Array<readonly [string, string]> {
  return [...pairs].sort(([fileA, nameA], [fileB, nameB]) =>
    fileA === fileB ? nameA.localeCompare(nameB) : fileA.localeCompare(fileB),
  );
}

/**
 * Skips whitespace from `start` and returns the next index to inspect.
 */
function skipWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

/**
 * Skips a generic parameter list by counting `<` and `>`, returning the index
 * just past the closing `>`. Returns `start` unchanged when no list is present
 * or when the brackets never balance.
 *
 * Counting rather than matching is what makes nested generics work. A regex
 * like `<[^>]*>` stops at the first `>`, so `fn f<T: Into<Vec<u8>>>()` never
 * reaches its `(` and the whole function drops out of the scan — the guard
 * then passes because it sees no body, not because the body is clean.
 *
 * Brackets inside `{ ... }` are skipped: within a const-generic default such as
 * `fn f<const LESS: bool = { 0 < 1 }>()` the `<` is a comparison operator, not
 * a nested type delimiter, and counting it would unbalance the list. Falling
 * back to `start` on an unbalanced list keeps an unparsable header from
 * scanning to EOF; the caller's `(` check then rejects that header.
 */
function skipGenericParams(source: string, start: number): number {
  if (source[start] !== "<") return start;
  let i = start + 1;
  let angleDepth = 1;
  let braceDepth = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "{") braceDepth++;
    else if (char === "}") braceDepth--;
    else if (braceDepth === 0) {
      if (char === "<") angleDepth++;
      else if (char === ">") {
        angleDepth--;
        if (angleDepth === 0) return i + 1;
      }
    }
    i++;
  }
  return start;
}

/**
 * Extracts top-level `fn`/`async fn` definitions from Rust source by
 * brace-matching from the first `{` after the parameter list. Sufficient for
 * commands/sync_providers/** production code, which has no nested `fn`
 * definitions or trait method signatures without a body.
 */
function extractFunctionBodies(source: string): Array<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const fnHeaderPattern = /(?:^|\n)[^\n]*?\bfn\s+([A-Za-z0-9_]+)/g;
  let match: RegExpExecArray | null = fnHeaderPattern.exec(source);
  while (match !== null) {
    const name = match[1];
    const afterGenerics = skipGenericParams(source, skipWhitespace(source, match.index + match[0].length));
    const parenIndex = skipWhitespace(source, afterGenerics);
    if (source[parenIndex] !== "(") {
      // Not a definition we can bound: no parameter list follows the name.
      match = fnHeaderPattern.exec(source);
      continue;
    }
    let i = parenIndex + 1;
    let parenDepth = 1;
    while (parenDepth > 0 && i < source.length) {
      if (source[i] === "(") parenDepth++;
      else if (source[i] === ")") parenDepth--;
      i++;
    }
    const braceIndex = source.indexOf("{", i);
    if (braceIndex !== -1) {
      let braceDepth = 1;
      let j = braceIndex + 1;
      while (braceDepth > 0 && j < source.length) {
        if (source[j] === "{") braceDepth++;
        else if (source[j] === "}") braceDepth--;
        j++;
      }
      results.push({ name, body: source.slice(braceIndex + 1, j - 1) });
    }
    match = fnHeaderPattern.exec(source);
  }
  return results;
}

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

  it("limits sync_providers lock_db( acquisitions to named, single-lock functions on the pinned allowlist", () => {
    const syncProvidersDir = join(srcTauriSrcRoot, SYNC_PROVIDERS_REL_DIR);
    const files = collectRustFiles(syncProvidersDir).filter((file) => {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
      return !relPath.includes("/tests/") && !relPath.endsWith("/tests.rs");
    });

    const found: Array<[string, string]> = [];
    for (const file of files) {
      const relPath = relative(srcTauriSrcRoot, file).split("\\").join("/");
      const source = productionSourceExcludingTestModule(readFileSync(file, "utf8"));
      let coveredLockDbCalls = 0;
      for (const { name, body } of extractFunctionBodies(source)) {
        const lockDbCount = body.split("lock_db(").length - 1;
        if (lockDbCount === 0) {
          continue;
        }
        expect(lockDbCount, `${relPath}::${name} should acquire lock_db exactly once`).toBe(1);
        coveredLockDbCalls += lockDbCount;
        found.push([relPath, name]);
      }
      // Extraction-coverage guard: every `lock_db(` in the file must sit inside
      // an extracted function body. If extractFunctionBodies misses a function
      // (e.g. a header shape its regex cannot parse, such as nested generics),
      // this fails loudly instead of silently exempting that scope from the pin.
      const totalLockDbCalls = source.split("lock_db(").length - 1;
      expect(
        coveredLockDbCalls,
        `${relPath}: every lock_db( call must be inside a function extracted by extractFunctionBodies`,
      ).toBe(totalLockDbCalls);
    }

    expect(sortLockDbPairs(found)).toEqual(sortLockDbPairs(SYNC_PROVIDERS_LOCK_DB_ALLOWLIST));
  });

  it("extracts fn bodies whose generic parameter lists are nested", () => {
    // The scan used to skip generics with `<[^>]*>`, which stops at the first
    // `>`. A header like `fn f<T: Into<Vec<u8>>>()` never reached its `(`, so
    // the function dropped out of extraction entirely — and a function that is
    // never extracted reads as "no lock_db here" rather than failing. The
    // coverage assertion in the test above is what turns that into a failure,
    // and this case pins the extraction itself at each nesting depth.
    const source = [
      "fn plain() {",
      '    lock_db("plain")?;',
      "}",
      "",
      "pub async fn one_level<T: Into<String>>(value: T) -> DomainResult<()> {",
      '    lock_db("one_level")?;',
      "    Ok(())",
      "}",
      "",
      "pub fn two_levels<T: Into<Vec<u8>>>(value: T) -> DomainResult<()> {",
      '    lock_db("two_levels")?;',
      "    Ok(())",
      "}",
      "",
      "fn four_levels<T: Into<Vec<Option<Box<u8>>>>>(value: T) -> usize {",
      '    lock_db("four_levels")?;',
      "    0",
      "}",
    ].join("\n");

    const extracted = extractFunctionBodies(source);

    expect(extracted.map((fn) => fn.name)).toEqual(["plain", "one_level", "two_levels", "four_levels"]);
    for (const name of ["plain", "one_level", "two_levels", "four_levels"]) {
      expect(extracted.find((fn) => fn.name === name)?.body, `${name} body must be captured`).toContain(
        `lock_db("${name}")`,
      );
    }
  });

  it("treats `<` inside a const-generic default as an operator, not a nested list", () => {
    // Counting every `<` would unbalance the list here and swallow the rest of
    // the file, dropping this function and everything the scan needed after it.
    // That direction is loud rather than silent — the coverage assertion turns
    // it into a failed build — but it would block a valid change, so pin it.
    const source = [
      "fn before() {",
      '    lock_db("before")?;',
      "}",
      "",
      "fn const_expr<const LESS: bool = { 0 < 1 }>() {",
      '    lock_db("const_expr")?;',
      "}",
      "",
      "fn after() {",
      '    lock_db("after")?;',
      "}",
    ].join("\n");

    expect(extractFunctionBodies(source).map((fn) => fn.name)).toEqual(["before", "const_expr", "after"]);
  });

  it("stops an unbalanced generic list instead of scanning to the end of the file", () => {
    // A header the scanner cannot bound must not consume the functions after
    // it. Falling back to the name position lets the `(` check reject just that
    // header, so `sane` is still extracted and still checked.
    const source = [
      "fn weird<T(value: u8) {",
      '    lock_db("weird")?;',
      "}",
      "",
      "fn sane() {",
      '    lock_db("sane")?;',
      "}",
    ].join("\n");

    expect(extractFunctionBodies(source).map((fn) => fn.name)).toEqual(["sane"]);
  });

  it("skips a bare `fn` mention that is not followed by a parameter list", () => {
    // Guards the other direction: dropping the `(` requirement from the header
    // pattern would let prose or a type-position `fn` start a bogus extraction.
    const source = ["// see fn documented_elsewhere for details", "fn real(value: u8) -> u8 {", "    value", "}"].join(
      "\n",
    );

    expect(extractFunctionBodies(source).map((fn) => fn.name)).toEqual(["real"]);
  });
});
