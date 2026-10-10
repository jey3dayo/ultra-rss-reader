import { readFileSync } from "node:fs";
import { extractCommandNames, extractRegisteredRustCommandNames } from "@tests/helpers/tauri-command-contract";
import { readTauriCommandsSource } from "@tests/helpers/tauri-command-source";
import { describe, expect, it } from "vitest";

const RUST_COMMANDS_WITHOUT_FRONTEND_WRAPPER: ReadonlySet<string> = new Set(["create_tag_and_assign_article"]);

describe("tauri command wrapper names", () => {
  it("keeps frontend safeInvoke command names identical to registered Rust commands", () => {
    const frontendCommands = new Set(
      extractCommandNames(readTauriCommandsSource(), /safeInvoke\(\s*"([^"]+)"/g).filter(
        (command) => !command.startsWith("plugin:"),
      ),
    );
    const registeredCommands = new Set(extractRegisteredRustCommandNames(readFileSync("src-tauri/src/lib.rs", "utf8")));

    expect({
      missingInRust: [...frontendCommands].filter((command) => !registeredCommands.has(command)).toSorted(),
      missingInFrontend: [...registeredCommands]
        .filter((command) => !frontendCommands.has(command) && !RUST_COMMANDS_WITHOUT_FRONTEND_WRAPPER.has(command))
        .toSorted(),
    }).toEqual({ missingInRust: [], missingInFrontend: [] });
  });
});
