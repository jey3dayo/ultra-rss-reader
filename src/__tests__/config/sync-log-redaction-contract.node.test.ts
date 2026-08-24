import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural regression guard for docs/feed-content-privacy.md: release logs
// emitted from commands/sync_providers/ must not carry account names, raw
// feed URLs, feed/folder titles, or remote entry ids. Diagnostics are limited
// to account_id / feed_id and the redacted host class.
//
// This is a name-based scan of tracing macro bodies, not full enforcement: a
// leak through an intermediate variable, a helper that formats a raw URL, or
// a renamed field could slip past it. It catches the common regression (a new
// log line interpolating the raw value directly) before it reaches review.

const SYNC_PROVIDERS_ROOT = join(process.cwd(), "src-tauri/src/commands/sync_providers");
const SYNC_COMMANDS_ROOT = join(process.cwd(), "src-tauri/src/commands/sync_commands");
const SYNC_LOG_ROOTS = [SYNC_PROVIDERS_ROOT, SYNC_COMMANDS_ROOT] as const;

// Name-based tracing scans cannot follow arbitrary data flow. Keep the known
// account-name-to-warning pattern pinned so this specific regression fails.
const SYNC_COMMANDS_KNOWN_INDIRECT_LOG_EXPRESSIONS = ["let name = account.name.clone();"] as const;

// The scheduler consumes ProviderSyncWarning values whose `message` is
// user-facing copy that can embed feed titles and account names; logging it
// verbatim (or `account.name`) would leak the same values the sync_providers
// redaction removes.
const SCHEDULER_SERVICE_ROOT = join(process.cwd(), "src-tauri/src/service");
const SCHEDULER_SOURCE = join(SCHEDULER_SERVICE_ROOT, "sync_scheduler.rs");
const SCHEDULER_MODULE_ROOT = join(SCHEDULER_SERVICE_ROOT, "sync_scheduler");
const SCHEDULER_FORBIDDEN_LOG_EXPRESSIONS = ["account.name", "warning.message", ".title"] as const;

// Raw-value expressions that must never appear inside a tracing macro body.
// `redacted_feed_host_class(...)` calls are stripped first, so the sanctioned
// `host_class = redacted_feed_host_class(&feed.url)` usage stays allowed.
const FORBIDDEN_LOG_EXPRESSIONS = [
  "account.name",
  "feed.url",
  "feed.title",
  "folder.name",
  "remote_entry_id",
  "remote_id",
  ".remote_entry_id",
] as const;

const TRACING_MACRO_PATTERN = /(?:tracing::)?(?:info|warn|error)!\(/g;

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

function readSchedulerModuleSource(): string {
  const files = [
    ...(existsSync(SCHEDULER_SOURCE) ? [{ file: SCHEDULER_SOURCE, root: SCHEDULER_SERVICE_ROOT }] : []),
    ...(existsSync(SCHEDULER_MODULE_ROOT)
      ? collectRustFiles(SCHEDULER_MODULE_ROOT).map((file) => ({ file, root: SCHEDULER_MODULE_ROOT }))
      : []),
  ];

  return files
    .map(({ file, root }) => {
      const relPath = relative(root, file).split("\\").join("/");
      return productionSource(readFileSync(file, "utf8"), relPath);
    })
    .join("\n");
}

// Test modules are expected to build strings containing raw fixture values;
// only production log statements are in scope for the privacy policy.
function productionSource(source: string, fileName: string): string {
  if (fileName === "tests.rs" || fileName.startsWith("tests/") || fileName.includes("/tests/")) {
    return "";
  }
  const testModuleStart = source.indexOf("\nmod tests {");
  if (testModuleStart === -1) {
    return source;
  }
  return source.slice(0, testModuleStart);
}

function extractMacroBodies(source: string): string[] {
  const bodies: string[] = [];
  for (const match of source.matchAll(TRACING_MACRO_PATTERN)) {
    const openParenIndex = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = openParenIndex; i < source.length; i += 1) {
      const char = source[i];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(source.slice(openParenIndex + 1, i));
          break;
        }
      }
    }
  }
  return bodies;
}

function stripSanctionedRedactionCalls(body: string): string {
  return body.replace(/redacted_feed_host_class\([^)]*\)/g, "<redacted-host-class>");
}

function countProductionTracingMacros(root: string): number {
  return collectRustFiles(root).reduce((count, file) => {
    const relPath = relative(root, file).split("\\").join("/");
    return count + extractMacroBodies(productionSource(readFileSync(file, "utf8"), relPath)).length;
  }, 0);
}

describe("sync log redaction contract", () => {
  it("keeps raw account names, feed URLs, titles, and remote ids out of tracing macros", () => {
    const files = SYNC_LOG_ROOTS.flatMap((root) => collectRustFiles(root).map((file) => ({ file, root })));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const { file, root } of files) {
      const relPath = relative(root, file).split("\\").join("/");
      const displayPath = relative(process.cwd(), file).split("\\").join("/");
      const source = productionSource(readFileSync(file, "utf8"), relPath);
      for (const body of extractMacroBodies(source)) {
        const scannable = stripSanctionedRedactionCalls(body);
        for (const forbidden of FORBIDDEN_LOG_EXPRESSIONS) {
          if (scannable.includes(forbidden)) {
            offenders.push(`${displayPath}: \`${forbidden}\` in tracing macro body`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the known indirect account-name logging pattern out of sync commands", () => {
    const source = readFileSync(join(SYNC_COMMANDS_ROOT, "manual.rs"), "utf8");
    const offenders = SYNC_COMMANDS_KNOWN_INDIRECT_LOG_EXPRESSIONS.filter((expression) => source.includes(expression));

    expect(offenders).toEqual([]);
  });

  it("keeps account names and warning copy out of scheduler tracing macros", () => {
    const source = readSchedulerModuleSource();
    const bodies = extractMacroBodies(source);
    expect(bodies.length).toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const body of bodies) {
      for (const forbidden of SCHEDULER_FORBIDDEN_LOG_EXPRESSIONS) {
        if (body.includes(forbidden)) {
          offenders.push(`sync_scheduler.rs: \`${forbidden}\` in tracing macro body`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("still finds tracing macros to scan (guards against silent scope loss)", () => {
    // These modules log sync phases and reconcile warnings; if a root ever
    // drops to zero the corresponding scan is vacuous.
    expect(countProductionTracingMacros(SYNC_PROVIDERS_ROOT)).toBeGreaterThan(5);
    expect(countProductionTracingMacros(SYNC_COMMANDS_ROOT)).toBeGreaterThan(5);
    expect(extractMacroBodies(readSchedulerModuleSource()).length).toBeGreaterThan(5);
  });
});
