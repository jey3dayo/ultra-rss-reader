import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createSettingsDirtyStateSnapshot,
  discardDirtySettingsEntries,
  getSettingsDirtyStateSnapshot,
  type SettingsDirtyStateEntry,
  saveDirtySettingsEntries,
} from "@/components/settings/hooks/settings-dirty-state-registry";
import {
  SettingsDirtyStateRegistryProvider,
  useRegisterSettingsDirtyState,
  useSettingsDirtyStateRegistrySnapshot,
} from "@/components/settings/hooks/use-settings-dirty-state-registry";

setupBrowserTestDom();

function wrapper({ children }: PropsWithChildren) {
  return <SettingsDirtyStateRegistryProvider>{children}</SettingsDirtyStateRegistryProvider>;
}

describe("settings dirty-state registry", () => {
  it("normalizes dirty, pending, and blocking reasons into a guard-ready snapshot", () => {
    expect(
      createSettingsDirtyStateSnapshot([
        {
          owner: "account",
          dirty: true,
          pending: false,
          blockingReason: "account-credentials-dirty",
        },
        {
          owner: "tag",
          dirty: false,
          pending: true,
          blockingReason: "tag-save-pending",
        },
        {
          owner: "shortcut",
          dirty: false,
          pending: false,
          blockingReason: null,
        },
      ]),
    ).toEqual({
      dirty: true,
      pending: true,
      blockingReasons: ["account-credentials-dirty", "tag-save-pending"],
      entries: [
        {
          owner: "account",
          dirty: true,
          pending: false,
          blockingReason: "account-credentials-dirty",
        },
        {
          owner: "tag",
          dirty: false,
          pending: true,
          blockingReason: "tag-save-pending",
        },
      ],
    });
  });

  it("collects registered account, tag, shortcut, and preferences owners", () => {
    const accountEntry: SettingsDirtyStateEntry = {
      owner: "account",
      dirty: true,
      pending: false,
      blockingReason: "account-credentials-dirty",
    };
    const tagEntry: SettingsDirtyStateEntry = {
      owner: "tag",
      dirty: false,
      pending: true,
      blockingReason: "tag-save-pending",
    };
    const shortcutEntry: SettingsDirtyStateEntry = {
      owner: "shortcut",
      dirty: true,
      pending: false,
      blockingReason: "shortcut-recording",
    };
    const preferencesEntry: SettingsDirtyStateEntry = {
      owner: "preferences",
      dirty: false,
      pending: true,
      blockingReason: "preferences-save-pending",
    };

    const { result, rerender } = renderHook(
      ({ account, tag, shortcut, preferences }) => {
        useRegisterSettingsDirtyState(account);
        useRegisterSettingsDirtyState(tag);
        useRegisterSettingsDirtyState(shortcut);
        useRegisterSettingsDirtyState(preferences);
        return useSettingsDirtyStateRegistrySnapshot();
      },
      {
        initialProps: {
          account: accountEntry,
          tag: tagEntry,
          shortcut: shortcutEntry,
          preferences: preferencesEntry,
        },
        wrapper,
      },
    );

    expect(result.current).toMatchObject({
      dirty: true,
      pending: true,
      blockingReasons: [
        "account-credentials-dirty",
        "tag-save-pending",
        "shortcut-recording",
        "preferences-save-pending",
      ],
    });
    expect(result.current.entries.map((entry) => entry.owner)).toEqual(["account", "tag", "shortcut", "preferences"]);
    expect(getSettingsDirtyStateSnapshot()).toMatchObject({
      dirty: true,
      pending: true,
      blockingReasons: [
        "account-credentials-dirty",
        "tag-save-pending",
        "shortcut-recording",
        "preferences-save-pending",
      ],
    });

    act(() => {
      rerender({
        account: { ...accountEntry, dirty: false, blockingReason: null },
        tag: { ...tagEntry, pending: false, blockingReason: null },
        shortcut: { ...shortcutEntry, dirty: false, blockingReason: null },
        preferences: {
          ...preferencesEntry,
          pending: false,
          blockingReason: null,
        },
      });
    });

    expect(result.current).toEqual({
      dirty: false,
      pending: false,
      blockingReasons: [],
      entries: [],
    });
    expect(getSettingsDirtyStateSnapshot()).toEqual({
      dirty: false,
      pending: false,
      blockingReasons: [],
      entries: [],
    });
  });

  it("clears the latest restart-guard snapshot when registered settings state unmounts", () => {
    const { unmount } = renderHook(
      () =>
        useRegisterSettingsDirtyState({
          owner: "shortcut",
          dirty: true,
          pending: false,
          blockingReason: "shortcut-recording",
        }),
      { wrapper },
    );

    expect(getSettingsDirtyStateSnapshot()).toMatchObject({
      dirty: true,
      blockingReasons: ["shortcut-recording"],
    });

    unmount();

    expect(getSettingsDirtyStateSnapshot()).toEqual({
      dirty: false,
      pending: false,
      blockingReasons: [],
      entries: [],
    });
  });

  it("stops before a dirty entry without actions after saving earlier entries", async () => {
    const firstSave = vi.fn().mockResolvedValue(true);
    const snapshot = createSettingsDirtyStateSnapshot([
      {
        owner: "account",
        dirty: true,
        pending: false,
        blockingReason: "account-credentials-dirty",
        actions: { save: firstSave, discard: vi.fn() },
      },
      {
        owner: "tag",
        dirty: true,
        pending: false,
        blockingReason: "tag-unsaved",
      },
    ]);

    await expect(saveDirtySettingsEntries(snapshot)).resolves.toBe(false);
    expect(firstSave).toHaveBeenCalledTimes(1);
  });

  it("stops saving at the first dirty entry whose save fails", async () => {
    const firstSave = vi.fn().mockResolvedValue(true);
    const failingSave = vi.fn().mockResolvedValue(false);
    const lastSave = vi.fn().mockResolvedValue(true);
    const snapshot = createSettingsDirtyStateSnapshot([
      {
        owner: "account",
        dirty: true,
        pending: false,
        blockingReason: null,
        actions: { save: firstSave, discard: vi.fn() },
      },
      {
        owner: "tag",
        dirty: true,
        pending: false,
        blockingReason: null,
        actions: { save: failingSave, discard: vi.fn() },
      },
      {
        owner: "shortcut",
        dirty: true,
        pending: false,
        blockingReason: null,
        actions: { save: lastSave, discard: vi.fn() },
      },
    ]);

    await expect(saveDirtySettingsEntries(snapshot)).resolves.toBe(false);
    expect(firstSave).toHaveBeenCalledTimes(1);
    expect(failingSave).toHaveBeenCalledTimes(1);
    expect(lastSave).not.toHaveBeenCalled();
  });

  it("resolves true when every dirty entry saves successfully", async () => {
    const firstSave = vi.fn().mockResolvedValue(true);
    const secondSave = vi.fn().mockResolvedValue(true);
    const snapshot = createSettingsDirtyStateSnapshot([
      {
        owner: "account",
        dirty: true,
        pending: false,
        blockingReason: null,
        actions: { save: firstSave, discard: vi.fn() },
      },
      {
        owner: "shortcut",
        dirty: true,
        pending: false,
        blockingReason: null,
        actions: { save: secondSave, discard: vi.fn() },
      },
    ]);

    await expect(saveDirtySettingsEntries(snapshot)).resolves.toBe(true);
    expect(firstSave).toHaveBeenCalledTimes(1);
    expect(secondSave).toHaveBeenCalledTimes(1);
  });

  it("ignores non-dirty entries with and without actions while saving", async () => {
    const untouchedSave = vi.fn().mockResolvedValue(true);
    const snapshot = createSettingsDirtyStateSnapshot([
      {
        owner: "tag",
        dirty: false,
        pending: false,
        blockingReason: null,
        actions: { save: untouchedSave, discard: vi.fn() },
      },
      {
        owner: "data",
        dirty: false,
        pending: false,
        blockingReason: null,
      },
    ]);

    await expect(saveDirtySettingsEntries(snapshot)).resolves.toBe(true);
    expect(untouchedSave).not.toHaveBeenCalled();
  });

  it("discards only dirty entries that have actions", () => {
    const dirtyDiscard = vi.fn();
    const cleanDiscard = vi.fn();
    const snapshot = createSettingsDirtyStateSnapshot([
      {
        owner: "account",
        dirty: true,
        pending: false,
        blockingReason: "account-credentials-dirty",
        actions: { save: vi.fn().mockResolvedValue(true), discard: dirtyDiscard },
      },
      {
        owner: "tag",
        dirty: false,
        pending: false,
        blockingReason: null,
        actions: { save: vi.fn().mockResolvedValue(true), discard: cleanDiscard },
      },
      {
        owner: "data",
        dirty: true,
        pending: false,
        blockingReason: "data-unsaved",
      },
    ]);

    discardDirtySettingsEntries(snapshot);

    expect(dirtyDiscard).toHaveBeenCalledTimes(1);
    expect(cleanDiscard).not.toHaveBeenCalled();
  });

  it("keeps registered actions calling the latest callbacks without re-notifying the snapshot", async () => {
    const saveCalls: string[] = [];
    const discardCalls: string[] = [];
    const { result, rerender } = renderHook(
      ({ callbackId }: { callbackId: string }) => {
        const snapshot = useSettingsDirtyStateRegistrySnapshot();
        const snapshotChangesRef = useRef(0);
        const lastSnapshotRef = useRef<unknown>(null);
        useLayoutEffect(() => {
          if (lastSnapshotRef.current !== snapshot) {
            lastSnapshotRef.current = snapshot;
            snapshotChangesRef.current += 1;
          }
        });
        useRegisterSettingsDirtyState(
          {
            owner: "account",
            dirty: true,
            pending: false,
            blockingReason: "account-credentials-dirty",
          },
          {
            save: async () => {
              saveCalls.push(callbackId);
              return true;
            },
            discard: () => {
              discardCalls.push(callbackId);
            },
          },
        );
        return { snapshot, snapshotChangesRef };
      },
      { initialProps: { callbackId: "first" }, wrapper },
    );

    expect(result.current.snapshot.entries).toHaveLength(1);
    const registeredSnapshot = result.current.snapshot;
    const changesBeforeRerender = result.current.snapshotChangesRef.current;

    rerender({ callbackId: "second" });

    expect(result.current.snapshotChangesRef.current).toBe(changesBeforeRerender);
    expect(result.current.snapshot).toBe(registeredSnapshot);
    const registeredEntry = result.current.snapshot.entries[0];
    expect(registeredEntry?.actions).toBeDefined();
    await registeredEntry?.actions?.save();
    registeredEntry?.actions?.discard();
    expect(saveCalls).toEqual(["second"]);
    expect(discardCalls).toEqual(["second"]);
  });
});
