import { expect, vi } from "vitest";
import type { AppError } from "@/api/tauri-commands";

export function suppressConsoleError(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

export function suppressConsoleWarn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

export type ConsoleErrorSpy = ReturnType<typeof suppressConsoleError>;
export type ConsoleWarnSpy = ReturnType<typeof suppressConsoleWarn>;

export function expectTauriCommandError(consoleError: ConsoleErrorSpy, command: string, error: AppError): void {
  expect(consoleError).toHaveBeenCalledWith(`[tauri-commands] ${command} failed:`, error);
}
