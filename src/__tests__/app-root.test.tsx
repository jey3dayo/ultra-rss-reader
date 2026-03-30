import { Result } from "@praha/byethrow";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";

const { loadPreferencesMock, syncAccountMock, listAccountsMock } = vi.hoisted(() => ({
  loadPreferencesMock: vi.fn(),
  syncAccountMock: vi.fn(() => Promise.resolve(Result.succeed(true))),
  listAccountsMock: vi.fn(() => Promise.resolve(Result.succeed([]))),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: () => <div>App Shell</div>,
}));

vi.mock("@/stores/preferences-store", () => ({
  usePreferencesStore: <T,>(selector: (state: { loadPreferences: () => void }) => T) =>
    selector({ loadPreferences: loadPreferencesMock }),
}));

vi.mock("@/api/tauri-commands", () => ({
  listAccounts: listAccountsMock,
  syncAccount: syncAccountMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

describe("App", () => {
  beforeEach(() => {
    loadPreferencesMock.mockClear();
    syncAccountMock.mockClear();
    listAccountsMock.mockClear();
  });

  it("does not trigger sync automatically on mount", async () => {
    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    expect(syncAccountMock).not.toHaveBeenCalled();
  });
});
