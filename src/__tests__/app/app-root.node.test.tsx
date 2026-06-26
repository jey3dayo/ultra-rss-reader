import { Result } from "@praha/byethrow";
import { act, render, waitFor } from "@testing-library/react";
import { testRetryableAppError, testUserVisibleAppError } from "@tests/helpers/app-error";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { type DevIntentState, resetDevIntentState } from "@tests/helpers/dev-intent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import type { AccountDto, AppError } from "@/api/tauri-commands";
import { STORAGE_KEYS } from "@/constants/storage";
import { APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS } from "@/constants/ui-runtime";

setupBrowserTestDom();

type UiState = {
  selectedAccountId: string | null;
  settingsOpen: boolean;
};

const {
  loadPreferencesMock,
  triggerStartupSyncMock,
  syncAccountMock,
  listAccountsMock,
  preferencesState,
  devIntentState,
  uiState,
} = await vi.hoisted(async () => {
  const { createDevIntentState } = await import("@tests/helpers/dev-intent");
  const devIntentState: DevIntentState = createDevIntentState();
  const uiState: UiState = { selectedAccountId: null, settingsOpen: false };

  return {
    loadPreferencesMock: vi.fn(),
    triggerStartupSyncMock: vi.fn<(accountId?: string) => Promise<Result.Result<boolean, AppError>>>(() =>
      Promise.resolve(Result.succeed(true)),
    ),
    syncAccountMock: vi.fn<(accountId: string) => Promise<Result.Result<boolean, AppError>>>(() =>
      Promise.resolve(Result.succeed(true)),
    ),
    listAccountsMock: vi.fn<() => Promise<Result.Result<AccountDto[], AppError>>>(() =>
      Promise.resolve(Result.succeed([])),
    ),
    preferencesState: {
      prefs: {},
      loaded: true,
    },
    devIntentState,
    uiState,
  };
});

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
}));

vi.mock("@/stores/ui-store", () => ({
  useUiStore: <T,>(selector: (state: { selectedAccountId: string | null; settingsOpen: boolean }) => T) =>
    selector({
      selectedAccountId: uiState.selectedAccountId,
      settingsOpen: uiState.settingsOpen,
    }),
}));

vi.mock("@/api/tauri-commands", () => ({
  listAccounts: listAccountsMock,
  syncAccount: syncAccountMock,
  triggerStartupSync: triggerStartupSyncMock,
}));

vi.mock("@/dev/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({
    intent: devIntentState.intent,
    ready: true,
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock("agentation", () => ({
  Agentation: () => <div data-testid="agentation-toolbar" />,
}));

function createAccount(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: "acc-1",
    kind: "local",
    name: "Local",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    keep_read_items_days: 30,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
}

function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    loadPreferencesMock.mockClear();
    triggerStartupSyncMock.mockClear();
    syncAccountMock.mockClear();
    listAccountsMock.mockClear();
    preferencesState.prefs = {};
    preferencesState.loaded = true;
    resetDevIntentState(devIntentState);
    uiState.selectedAccountId = null;
    uiState.settingsOpen = false;
  });

  it("hides Agentation while settings is open by default", () => {
    uiState.settingsOpen = true;

    const view = render(<App />);

    expect(view.queryByTestId("agentation-toolbar")).toBeNull();
  });

  it("shows Agentation over settings when debug visibility is always", async () => {
    preferencesState.prefs = { debug_agentation_visibility: "always" };
    uiState.settingsOpen = true;

    const view = render(<App />);

    expect(await view.findByTestId("agentation-toolbar")).not.toBeNull();
  });

  it("triggers one full sync on mount when startup sync is enabled", async () => {
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerStartupSyncMock).toHaveBeenCalledWith("acc-2");
    expect(syncAccountMock).not.toHaveBeenCalled();
  });

  it("still checks startup sync on mount when startup sync is disabled", async () => {
    preferencesState.prefs = { sync_on_startup: "false" };

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not trigger startup sync while any dev intent is active", async () => {
    preferencesState.prefs = { sync_on_startup: "true" };
    devIntentState.intent = "open-web-preview-url";

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerStartupSyncMock).not.toHaveBeenCalled();
  });

  it("does not trigger startup sync when a startup sync ran within the last 90 seconds", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    localStorage.setItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`, String(now - 89_000));

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerStartupSyncMock).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
  });

  it("triggers startup sync again once the 90-second cooldown has passed", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    localStorage.setItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`, String(now - 90_001));

    render(<App />);

    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerStartupSyncMock).toHaveBeenCalledWith("acc-2");
    dateNowSpy.mockRestore();
  });

  it("keeps startup sync throttle scoped to the selected account", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    localStorage.setItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-1`, String(now - 1_000));

    render(<App />);

    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(triggerStartupSyncMock).toHaveBeenCalledWith("acc-2");
    expect(localStorage.getItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`)).toBe(String(now));
    dateNowSpy.mockRestore();
  });

  it("cleans an invalid startup sync timestamp and runs startup sync", async () => {
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    localStorage.setItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`, "not-a-timestamp");

    render(<App />);

    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(localStorage.getItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`)).not.toBe("not-a-timestamp");
  });

  it("cleans a future startup sync timestamp and runs startup sync", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    localStorage.setItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`, String(now + 1_000));

    render(<App />);

    await waitFor(() => {
      expect(triggerStartupSyncMock).toHaveBeenCalledTimes(1);
    });
    expect(Number(localStorage.getItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`))).toBe(now);
    dateNowSpy.mockRestore();
  });

  it("logs startup sync Result.fail without reverting the startup throttle marker", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    triggerStartupSyncMock.mockResolvedValueOnce(Result.fail(testUserVisibleAppError("sync failed")));

    render(<App />);

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("Startup sync failed:", testUserVisibleAppError("sync failed"));
    });
    expect(Number(localStorage.getItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`))).toBe(now);
    dateNowSpy.mockRestore();
  });

  it("logs rejected startup sync promises without reverting the startup throttle marker", async () => {
    const now = new Date("2026-04-18T03:00:00+09:00").getTime();
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new Error("runtime rejected");
    preferencesState.prefs = { sync_on_startup: "true" };
    uiState.selectedAccountId = "acc-2";
    triggerStartupSyncMock.mockRejectedValueOnce(error);

    render(<App />);

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("Startup sync rejected:", error);
    });
    expect(Number(localStorage.getItem(`${STORAGE_KEYS.startupSyncLastTriggeredAt}:acc-2`))).toBe(now);
    dateNowSpy.mockRestore();
  });

  it("keeps sync-on-wake account selection scoped to active sync-on-wake accounts after the hidden threshold", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    uiState.selectedAccountId = "acc-active";
    listAccountsMock.mockResolvedValueOnce(
      Result.succeed([
        createAccount({ id: "acc-active", sync_on_wake: true }),
        createAccount({ id: "acc-background", sync_on_wake: true }),
        createAccount({ id: "acc-disabled", sync_on_wake: false }),
      ]),
    );
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(syncAccountMock).toHaveBeenCalledTimes(2);
    });
    expect(listAccountsMock).toHaveBeenCalledTimes(1);
    expect(syncAccountMock).toHaveBeenCalledWith("acc-active");
    expect(syncAccountMock).toHaveBeenCalledWith("acc-background");
    expect(syncAccountMock).not.toHaveBeenCalledWith("acc-disabled");
    dateNowSpy.mockRestore();
  });

  it("does not check sync-on-wake accounts when the app was hidden below the wake threshold", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS - 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    expect(listAccountsMock).not.toHaveBeenCalled();
    expect(syncAccountMock).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
  });

  it("keeps one stable visibility listener across rerenders", async () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { rerender, unmount } = render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    rerender(<App />);

    expect(addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "visibilitychange")).toHaveLength(1);
    expect(removeEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "visibilitychange")).toHaveLength(0);

    unmount();

    expect(removeEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "visibilitychange")).toHaveLength(1);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("does not start duplicate sync-on-wake work while a wake sync is in flight", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const listAccountsDeferred = createDeferred<Awaited<ReturnType<typeof listAccountsMock>>>();
    listAccountsMock.mockReturnValueOnce(listAccountsDeferred.promise);
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
      dispatchVisibilityChange();
    });

    expect(listAccountsMock).toHaveBeenCalledTimes(1);
    expect(syncAccountMock).not.toHaveBeenCalled();

    listAccountsDeferred.resolve(
      Result.succeed([
        createAccount({ id: "acc-wake", sync_on_wake: true }),
        createAccount({ id: "acc-manual", sync_on_wake: false }),
      ]),
    );

    await waitFor(() => {
      expect(syncAccountMock).toHaveBeenCalledTimes(1);
    });
    expect(syncAccountMock).toHaveBeenCalledWith("acc-wake");
    dateNowSpy.mockRestore();
  });

  it("logs sync-on-wake list account failures", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = testUserVisibleAppError("list failed");
    listAccountsMock.mockResolvedValueOnce(Result.fail(error));
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake failed to list accounts:", error);
    });
    expect(syncAccountMock).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("logs retryable sync-on-wake list account failures", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = testRetryableAppError("temporary list failure");
    listAccountsMock.mockResolvedValueOnce(Result.fail(error));
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake failed to list accounts:", error);
    });
    expect(syncAccountMock).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("logs sync-on-wake account sync failures", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = testUserVisibleAppError("sync failed");
    listAccountsMock.mockResolvedValueOnce(Result.succeed([createAccount({ id: "acc-wake" })]));
    syncAccountMock.mockResolvedValueOnce(Result.fail(error));
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake failed:", "acc-wake", error);
    });
    dateNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("logs rejected sync-on-wake account promises and still waits for remaining account diagnostics", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rejectedError = new Error("sync rejected");
    const failedError = testUserVisibleAppError("sync failed");
    listAccountsMock.mockResolvedValueOnce(
      Result.succeed([
        createAccount({ id: "acc-rejected" }),
        createAccount({ id: "acc-failed" }),
        createAccount({ id: "acc-success" }),
      ]),
    );
    syncAccountMock
      .mockRejectedValueOnce(rejectedError)
      .mockResolvedValueOnce(Result.fail(failedError))
      .mockResolvedValueOnce(Result.succeed(true));
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake rejected:", rejectedError);
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake failed:", "acc-failed", failedError);
    expect(syncAccountMock).toHaveBeenCalledTimes(3);
    dateNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("catches rejected sync-on-wake list promises at the app boundary and allows the next wake retry", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rejectedError = new Error("list rejected");
    listAccountsMock.mockRejectedValueOnce(rejectedError);
    dateNowSpy.mockReturnValue(0);

    render(<App />);

    await waitFor(() => {
      expect(loadPreferencesMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS + 1);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith("Sync on wake rejected at app boundary:", rejectedError);
    });

    listAccountsMock.mockResolvedValueOnce(Result.succeed([createAccount({ id: "acc-retry" })]));
    act(() => {
      setDocumentHidden(true);
      dispatchVisibilityChange();
    });
    dateNowSpy.mockReturnValue(APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS * 2 + 2);
    act(() => {
      setDocumentHidden(false);
      dispatchVisibilityChange();
    });

    await waitFor(() => {
      expect(syncAccountMock).toHaveBeenCalledWith("acc-retry");
    });
    dateNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
