import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";
import {
  createSettingsDirtyStateSnapshot,
  getSettingsDirtyStateSnapshot,
  type SettingsDirtyStateEntry,
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
});
