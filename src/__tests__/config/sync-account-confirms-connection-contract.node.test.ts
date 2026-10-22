import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural regression guard: a successful FreshRSS sync is the only thing that clears a stale
// connection-test `Error`, so `sync_account_with_mode` must reach the provider sync through
// `sync_greader_account_and_confirm_connection`. Name-based scan; the behavior itself is covered
// by sync_commands/tests/connection_verification.rs.

const ACCOUNT_SYNC_SOURCE = readFileSync(
  join(process.cwd(), "src-tauri/src/commands/sync_commands/account_sync.rs"),
  "utf8",
);

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (matched === undefined) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

const syncAccountWithModeBody = extractBlock(
  ACCOUNT_SYNC_SOURCE,
  /async fn sync_account_with_mode\([\s\S]*?\) -> Result<ProviderSyncOutcome, AppError> \{([\s\S]*?)\n\}/,
  "sync_account_with_mode body",
);
const freshRssBranch = extractBlock(
  syncAccountWithModeBody,
  /ProviderKind::FreshRss => \{([\s\S]*?)ProviderKind::Quarantined/,
  "FreshRss branch of sync_account_with_mode",
);

describe("sync_account_with_mode connection confirmation contract", () => {
  it("syncs FreshRSS accounts through sync_greader_account_and_confirm_connection", () => {
    expect(freshRssBranch).toContain("sync_greader_account_and_confirm_connection(");
  });

  it("does not call sync_greader_account directly in the FreshRSS branch", () => {
    expect(freshRssBranch).not.toMatch(/\bsync_greader_account\(/);
  });
});
