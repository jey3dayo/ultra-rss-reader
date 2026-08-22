import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Recursively collects `.rs` file paths under `dir`. Shared by the Rust
 * source contract tests (`src/__tests__/config/*-contract.node.test.ts`)
 * that scan `src-tauri/src` for pinned call-site invariants.
 */
export function collectRustFiles(dir: string): string[] {
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
