import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceText(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function readTauriCommandModuleSources(): string[] {
  return readdirSync(join(process.cwd(), "src/api/tauri-commands"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => `src/api/tauri-commands/${entry.name}`)
    .toSorted()
    .map(readWorkspaceText);
}

export function readTauriCommandsSource(): string {
  return [readWorkspaceText("src/api/tauri-commands.ts"), ...readTauriCommandModuleSources()].join("\n");
}
