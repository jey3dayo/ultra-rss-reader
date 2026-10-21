import { describe, expect, it } from "vitest";
import { getCredentialFailure, resolveCredentialStoreKind } from "@/lib/account/credential-failure";

describe("resolveCredentialStoreKind", () => {
  it.each([
    { platform: "macos", storage: "os_keychain", dev: false, expected: "keychain" },
    { platform: "windows", storage: "os_keychain", dev: false, expected: "credential_manager" },
    { platform: "linux", storage: "os_keychain", dev: false, expected: "os_store" },
    { platform: "unknown", storage: null, dev: false, expected: "os_store" },
    { platform: "macos", storage: "local_file", dev: false, expected: "local_file" },
    { platform: "windows", storage: "local_file", dev: false, expected: "local_file" },
    { platform: "macos", storage: null, dev: true, expected: "local_file" },
  ] as const)("maps $platform / $storage / dev file $dev to $expected", ({ platform, storage, dev, expected }) => {
    expect(resolveCredentialStoreKind({ platform, storage, usesDevFileCredentials: dev })).toBe(expected);
  });
});

describe("getCredentialFailure", () => {
  it("reads the structured failure and ignores the display message", () => {
    expect(
      getCredentialFailure({
        type: "UserVisible",
        message: "Keychain error: user canceled",
        credential_failure: { target: "password", cause: "write_failed" },
      }),
    ).toEqual({ target: "password", cause: "write_failed" });
  });

  it("does not infer a cause from message text or from other error types", () => {
    expect(getCredentialFailure({ type: "UserVisible", message: "Keychain error: user canceled" })).toBeNull();
    expect(getCredentialFailure({ type: "Retryable", message: "Keychain error: user canceled" })).toBeNull();
  });
});
