export function shouldShowKindLabel(name: string, kind: string): boolean {
  return name.trim().toLocaleLowerCase() !== kind.trim().toLocaleLowerCase();
}
