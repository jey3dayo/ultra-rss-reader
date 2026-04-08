import { Result } from "@praha/byethrow";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";

const { loadPreferencesMock, triggerSyncMock, syncAccountMock, listAccountsMock, preferencesState, devIntentState } =
  vi.hoisted(() => ({
    loadPreferencesMock: vi.fn(),
    triggerSyncMock: vi.fn(() => Promise.resolve(Result.succeed(true))),
    syncAccountMock: vi.fn(() => Promise.resolve(Result.succeed(true))),
    listAccountsMock: vi.fn(() => Promise.resolve(Result.succeed([]))),
    preferencesState: {
      prefs: {},
      loaded: true,
    },
    devIntentState: {
      intent: null as string | null,
    },
  }));

vi.mock("@/components/app-shell", () => ({
  AppShell: () => <div>App Shell</div>,
}));

vi.mock("@/stores/preferences-store", () => ({
  usePreferencesStore: <T,>(
    selector: (state: { loadPreferences: () => void; prefs: Record<string, string>; loaded: boolean }) => T,
  ) =>
    selector({
      loadPreferences: loadPreferencesMock,
      prefs: preferencesState.prefs,
      loaded: preferencesState.loaded,
    }),
  resolvePreferenceValue: (prefs: Record<string, string>, key: string) =>
    prefs[key] ?? (key === "sync_on_startup" ? "true" : ""),
}));

vi.mock("@/api/tauri-commands", () => ({
  listAccounts: listAccountsMock,
  syncAccount: syncAccountMock,
  triggerSync: triggerSyncMock,
}));

vi.mock("@/lib/dev-intent", () => ({
  readDevIntent: () => devIntentState.intent,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

describe("App", () => {
  beforeEach(() => {
    loadPreferencesMock.mockClear();
    triggerSyncMock.mockClear();
    syncAccountMock.mockClear();
    listAccountsMock.mockClear();
    preferencesState.prefs = {};
    preferencesState.loaded = true;
    devIntentState.intent = null;
  });

  it("triggers one full sync on mount when startup sync is enabled", async () => {
    preferencesState.prefs = { sync_on_startup: "true" };

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(triggerSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(syncAccountMock).not.toHaveBeenCalled();
  });

  it("does not trigger full sync on mount when startup sync is disabled", async () => {
    preferencesState.prefs = { sync_on_startup: "false" };

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerSyncMock).not.toHaveBeenCalled();
  });

  it("does not trigger startup sync while any dev intent is active", async () => {
    preferencesState.prefs = { sync_on_startup: "true" };
    devIntentState.intent = "open-web-preview-url";

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerSyncMock).not.toHaveBeenCalled();
  });
});
