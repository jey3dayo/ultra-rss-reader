export function extractCommandNames(source: string, commandPattern: RegExp): string[] {
  const commands = new Set<string>();

  for (const match of source.matchAll(commandPattern)) {
    const command = match[1];
    if (command) {
      commands.add(command);
    }
  }

  return [...commands].toSorted();
}

export function extractSafeInvokeCommandsWithArgs(source: string): string[] {
  const commands = new Set<string>();
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const start = source.indexOf("safeInvoke(", searchFrom);
    if (start === -1) {
      break;
    }

    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          const call = source.slice(start, end + 1);
          if (/\bargs\s*:/.test(call)) {
            const match = call.match(/safeInvoke\(\s*"([^"]+)"/);
            const command = match?.[1];
            if (command) {
              commands.add(command);
            }
          }
          break;
        }
      }
    }

    searchFrom = end + 1;
  }

  return [...commands].toSorted();
}

export function extractRegisteredRustCommandNames(source: string): string[] {
  const handlerMatch = source.match(/tauri::generate_handler!\s*\[([\s\S]*?)\]/);
  if (!handlerMatch) {
    throw new Error("Tauri generate_handler command list should exist");
  }

  return [
    ...new Set(
      [...(handlerMatch[1] ?? "").matchAll(/commands::[a-zA-Z0-9_]+::([a-zA-Z0-9_]+)/g)].map((match) => match[1] ?? ""),
    ),
  ].toSorted();
}

export function extractRustTauriAsyncCommandNames(source: string): string[] {
  const commandPattern = /#\[tauri::command\]\s+(?:#\[[^\]]+\]\s+)*(?:pub\s+)?async\s+fn\s+([a-zA-Z0-9_]+)\s*\(/g;

  return [...new Set([...source.matchAll(commandPattern)].map((match) => match[1] ?? ""))].toSorted();
}

export function extractCommandDbLockPolicyCases(source: string): Record<string, string> {
  const policyBodyMatch = source.match(
    /pub\(crate\)\s+fn\s+command_db_lock_policy[\s\S]*?let policy = match command_name \{([\s\S]*?)\n\s*_\s*=>\s*return None,/,
  );
  if (!policyBodyMatch) {
    throw new Error("command_db_lock_policy match body should exist");
  }

  const policies: Record<string, string> = {};
  const policyArmPattern = /([\s\S]*?)=>\s*CommandDbLockPolicy::([A-Za-z0-9_]+)/g;

  for (const match of (policyBodyMatch[1] ?? "").matchAll(policyArmPattern)) {
    const commands = [...(match[1] ?? "").matchAll(/"([^"]+)"/g)]
      .map((commandMatch) => commandMatch[1])
      .filter(Boolean);
    const policy = match[2];
    if (!policy) {
      continue;
    }

    for (const command of commands) {
      policies[command] = policy;
    }
  }

  return policies;
}

export type CommandIndex = {
  readonly commands: readonly string[];
  readonly commandSet: ReadonlySet<string>;
};

export function createCommandIndex(commands: readonly string[]): CommandIndex {
  return {
    commands,
    commandSet: new Set(commands),
  };
}

export function orderedCommandDifference(left: CommandIndex, right: CommandIndex): string[] {
  const difference: string[] = [];

  for (const command of left.commands) {
    if (!right.commandSet.has(command)) {
      difference.push(command);
    }
  }

  return difference;
}
