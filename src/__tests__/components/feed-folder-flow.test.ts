import { Result } from "@praha/byethrow";
import { expectTauriCommandError, suppressConsoleError } from "@tests/helpers/console-spies";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/tauri-commands";
import { createFolderIfNeeded, createFolderIfNeededResult } from "@/components/reader/feed-folder-flow";

describe("feed-folder-flow", () => {
  afterEach(() => {
    teardownTauriMocks();
    vi.restoreAllMocks();
  });

  it("returns the selected folder when a new folder is not needed", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      return undefined;
    });

    const result = await createFolderIfNeededResult({
      accountId: "acc-1",
      selectedFolderId: "folder-1",
      isCreatingFolder: false,
      newFolderName: "Reading",
    });

    expect(Result.isSuccess(result)).toBe(true);
    expect(Result.unwrap(result)).toBe("folder-1");
    expect(calls).not.toContainEqual(expect.objectContaining({ cmd: "create_folder" }));
  });

  it("returns the created folder id when creating a folder succeeds", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "create_folder") {
        return { id: "folder-new", account_id: args.accountId, name: args.name, sort_order: 1 };
      }

      return undefined;
    });

    const result = await createFolderIfNeededResult({
      accountId: "acc-1",
      selectedFolderId: null,
      isCreatingFolder: true,
      newFolderName: "  Reading  ",
    });

    expect(Result.isSuccess(result)).toBe(true);
    expect(Result.unwrap(result)).toBe("folder-new");
  });

  it("returns the AppError when creating a folder fails", async () => {
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "Folder already exists" };
    setupTauriMocks((cmd) => {
      if (cmd === "create_folder") {
        throw appError;
      }

      return undefined;
    });

    const result = await createFolderIfNeededResult({
      accountId: "acc-1",
      selectedFolderId: null,
      isCreatingFolder: true,
      newFolderName: "Reading",
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(appError);
    expectTauriCommandError(consoleError, "create_folder", appError);
  });

  it("keeps the compatibility wrapper behavior on create failure", async () => {
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "Folder already exists" };
    const onError = vi.fn();
    setupTauriMocks((cmd) => {
      if (cmd === "create_folder") {
        throw appError;
      }

      return undefined;
    });

    await expect(
      createFolderIfNeeded({
        accountId: "acc-1",
        selectedFolderId: null,
        isCreatingFolder: true,
        newFolderName: "Reading",
        onError,
      }),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(appError);
    expectTauriCommandError(consoleError, "create_folder", appError);
  });
});
