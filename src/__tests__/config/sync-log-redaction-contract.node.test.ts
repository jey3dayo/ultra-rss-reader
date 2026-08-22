import { readdirSync, readFileSync, statSync } from "node:fs";
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

// Test modules are expected to build strings containing raw fixture values;
// only production log statements are in scope for the privacy policy.
function productionSource(source: string, fileName: string): string {
  if (fileName === "tests.rs") {
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

describe("sync provider log redaction contract", () => {
  it("keeps raw account names, feed URLs, titles, and remote ids out of tracing macros", () => {
    const files = collectRustFiles(SYNC_PROVIDERS_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const relPath = relative(SYNC_PROVIDERS_ROOT, file).split("\\").join("/");
      const source = productionSource(readFileSync(file, "utf8"), relPath);
      for (const body of extractMacroBodies(source)) {
        const scannable = stripSanctionedRedactionCalls(body);
        for (const forbidden of FORBIDDEN_LOG_EXPRESSIONS) {
          if (scannable.includes(forbidden)) {
            offenders.push(`${relPath}: \`${forbidden}\` in tracing macro body`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("still finds tracing macros to scan (guards against silent scope loss)", () => {
    const files = collectRustFiles(SYNC_PROVIDERS_ROOT);
    const totalMacroBodies = files.reduce((count, file) => {
      const relPath = relative(SYNC_PROVIDERS_ROOT, file).split("\\").join("/");
      const source = productionSource(readFileSync(file, "utf8"), relPath);
      return count + extractMacroBodies(source).length;
    }, 0);

    // The sync_providers module logs sync phases and reconcile warnings; if
    // this ever drops to zero the scan above is vacuous and must be re-wired.
    expect(totalMacroBodies).toBeGreaterThan(5);
  });
});
