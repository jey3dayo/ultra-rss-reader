import { parse, safeParse } from "valibot";
import { describe, expect, it } from "vitest";
import {
  DevRuntimeOptionsSchema,
  PlatformPermissionDeniedRecoveryListSchema,
  PlatformPermissionDeniedRecoverySchema,
} from "@/api/schemas/platform-info";

describe("platform-info schemas", () => {
  it("keeps dev runtime options strict so future options are explicit", () => {
    const validOptions = {
      dev_intent: "browser",
      dev_web_url: "http://localhost:1420",
      dev_window_width: 1280,
      dev_window_height: null,
    };

    expect(parse(DevRuntimeOptionsSchema, validOptions)).toEqual(validOptions);
    expect(
      safeParse(DevRuntimeOptionsSchema, {
        ...validOptions,
        future_dev_option: true,
      }).success,
    ).toBe(false);
  });

  it("rejects malformed dev runtime option values at the IPC boundary", () => {
    expect(
      safeParse(DevRuntimeOptionsSchema, {
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: 10_001,
        dev_window_height: 800,
      }).success,
    ).toBe(false);
  });

  it("contracts permission denied recovery copy for each platform runtime surface", () => {
    const recoveries = [
      {
        surface: "file",
        user_action_copy: "File access was denied. Choose a user-accessible folder and check OS privacy settings.",
      },
      {
        surface: "dialog",
        user_action_copy:
          "File dialog access was denied. Allow file dialog access in OS privacy settings and try again.",
      },
      {
        surface: "keyring",
        user_action_copy:
          "Credential storage access was denied. Unlock the OS keyring or allow Ultra RSS Reader access.",
      },
      {
        surface: "clipboard",
        user_action_copy: "Clipboard access was denied. Allow clipboard access for Ultra RSS Reader and try again.",
      },
    ];

    expect(parse(PlatformPermissionDeniedRecoveryListSchema, recoveries)).toEqual(recoveries);
    expect(recoveries.map((recovery) => recovery.surface)).toEqual(["file", "dialog", "keyring", "clipboard"]);
  });

  it("keeps permission denied recovery entries narrow and non-empty", () => {
    expect(
      safeParse(PlatformPermissionDeniedRecoverySchema, {
        surface: "network",
        user_action_copy: "Network access denied.",
      }).success,
    ).toBe(false);
    expect(
      safeParse(PlatformPermissionDeniedRecoverySchema, {
        surface: "file",
        user_action_copy: "   ",
      }).success,
    ).toBe(false);
    expect(
      safeParse(PlatformPermissionDeniedRecoverySchema, {
        surface: "file",
        user_action_copy: "File access was denied.",
        diagnostics: "permission denied",
      }).success,
    ).toBe(false);
  });
});
