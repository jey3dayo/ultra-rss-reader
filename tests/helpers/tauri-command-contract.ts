export function extractCommandNames(source: string, commandPattern: RegExp): string[] {
  const commands = new Set<string>();

  for (const match of source.matchAll(commandPattern)) {
    const command = match[1];
    if (command) {
      commands.add(command);
    }
  }

  return [...commands].sort();
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

  return [...commands].sort();
}

export function orderedSetDifference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  const difference: string[] = [];

  for (const item of left) {
    if (!rightSet.has(item)) {
      difference.push(item);
    }
  }

  return difference;
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
