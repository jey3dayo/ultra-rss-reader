export function readFirstNonEmptyEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = import.meta.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}
