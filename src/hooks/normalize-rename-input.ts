export function normalizeRenameInput(value: string): string {
  return value.trim().normalize("NFC");
}
