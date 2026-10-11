import { describe, expect, it } from "vitest";
import {
  classifySignatureDiffs,
  compareSnapshots,
  type MacosKeychainSignatureSnapshot,
  parseCodesignDetails,
  parseMacosKeychainSignatureSnapshot,
} from "../scripts/release/lib/macos-signature-diagnostics.ts";
import {
  type MacosSignatureDiagnosticsDependencies,
  recordSnapshot,
} from "../scripts/release/workflows/macos-signature-diagnostics.ts";

const createSnapshot = (
  overrides: {
    authorityChain?: string[];
    bundleIdentifier?: string | null;
    cdHash?: string | null;
    designatedRequirement?: string | null;
    identifier?: string | null;
    signature?: string | null;
    teamIdentifier?: string | null;
  } = {},
): MacosKeychainSignatureSnapshot =>
  parseMacosKeychainSignatureSnapshot({
    appPath: "/Applications/Example.app",
    bundleIdentifier: "bundleIdentifier" in overrides ? overrides.bundleIdentifier : "com.example.app",
    codesign: {
      authorityChain: overrides.authorityChain ?? ["Developer ID Application: Example (TEAM1)"],
      cdHash: "cdHash" in overrides ? overrides.cdHash : "hash-a",
      designatedRequirement:
        "designatedRequirement" in overrides ? overrides.designatedRequirement : 'identifier "com.example.app"',
      identifier: "identifier" in overrides ? overrides.identifier : "com.example.app",
      signature: "signature" in overrides ? overrides.signature : "Developer ID Application",
      teamIdentifier: "teamIdentifier" in overrides ? overrides.teamIdentifier : "TEAM1",
    },
    comparisonPolicy: {
      ignoredFields: ["cdHash"],
      requiredStableFields: [
        "bundleIdentifier",
        "codesignIdentifier",
        "teamIdentifier",
        "authorityChain",
        "designatedRequirement",
      ],
    },
    createdAt: "2026-10-12T00:00:00.000Z",
    keychainScope: {
      accountIdSource: "Ultra RSS Reader account id",
      service: "ultra-rss-reader",
    },
    label: "snapshot",
    schemaVersion: 1,
    verification: [
      {
        command: ["codesign", "--verify"],
        ok: false,
        status: null,
        stderr: "verification unavailable",
        stdout: "",
      },
    ],
  });

describe("macOS Keychain signature diagnostics", () => {
  it("parses the stable signature details and the ignored CDHash", () => {
    expect(
      parseCodesignDetails(
        [
          "Authority=Developer ID Application: Example (TEAM1)",
          "CDHash=abc123",
          "Identifier=com.example.app",
          "Signature=Developer ID Application",
          "TeamIdentifier=TEAM1",
          'designated => identifier "com.example.app"',
        ].join("\n"),
      ),
    ).toEqual({
      authorityChain: ["Developer ID Application: Example (TEAM1)"],
      cdHash: "abc123",
      designatedRequirement: 'identifier "com.example.app"',
      identifier: "com.example.app",
      signature: "Developer ID Application",
      teamIdentifier: "TEAM1",
    });
  });

  it("validates snapshot v1 fields and retains nullable signature and verification values", () => {
    const snapshot = createSnapshot({
      authorityChain: [],
      bundleIdentifier: null,
      cdHash: null,
      designatedRequirement: null,
      identifier: null,
      signature: "adhoc",
      teamIdentifier: null,
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.codesign).toEqual({
      authorityChain: [],
      cdHash: null,
      designatedRequirement: null,
      identifier: null,
      signature: "adhoc",
      teamIdentifier: null,
    });
    expect(snapshot.bundleIdentifier).toBeNull();
    expect(snapshot.verification[0]?.status).toBeNull();
    expect(snapshot.comparisonPolicy.ignoredFields).toEqual(["cdHash"]);
    expect(() =>
      parseMacosKeychainSignatureSnapshot({
        ...snapshot,
        schemaVersion: 2,
      }),
    ).toThrow();
    expect(() =>
      parseMacosKeychainSignatureSnapshot({
        ...snapshot,
        codesign: {
          authorityChain: [],
          designatedRequirement: null,
          identifier: null,
          signature: "adhoc",
          teamIdentifier: null,
        },
      }),
    ).toThrow();
  });

  it("ignores CDHash while comparing stable fields and retains ad-hoc classification", () => {
    const before = createSnapshot({ cdHash: "hash-before" });
    const after = createSnapshot({ cdHash: "hash-after" });
    const sameSignature = compareSnapshots(before, after);
    expect(sameSignature).toEqual({ diffs: [], ok: true });

    const adHoc = createSnapshot({
      authorityChain: [],
      identifier: "com.example.local",
      signature: "adhoc",
      teamIdentifier: null,
    });
    const changed = compareSnapshots(before, adHoc);
    expect(changed.ok).toBe(false);
    expect(classifySignatureDiffs(before, adHoc, changed)).toEqual([
      "local ad-hoc re-signed app is involved; do not use this Keychain item as published-update evidence",
    ]);
  });

  it("records through injected macOS command and file boundaries", () => {
    const commands: Array<{ args: string[]; command: string }> = [];
    const dependencies: MacosSignatureDiagnosticsDependencies = {
      platform: "darwin",
      exists: () => true,
      runCommand: (command, args) => {
        commands.push({ args, command });
        const output =
          command === "codesign" && args[0] === "-dvvv"
            ? [
                "Authority=Developer ID Application: Example (TEAM1)",
                "CDHash=abc123",
                "Identifier=com.example.app",
                "Signature=Developer ID Application",
                "TeamIdentifier=TEAM1",
                'designated => identifier "com.example.app"',
              ].join("\n")
            : command === "defaults"
              ? "com.example.app"
              : "";
        return { command: [command, ...args], ok: true, status: 0, stderr: "", stdout: output };
      },
      now: () => "2026-10-12T00:00:00.000Z",
      readTextFile: () => "",
      writeTextFile: () => undefined,
    };

    const snapshot = recordSnapshot(
      { appPath: "/fixture/Example.app", label: "fixture", version: "1.2.3" },
      dependencies,
    );

    expect(snapshot.bundleIdentifier).toBe("com.example.app");
    expect(snapshot.codesign.cdHash).toBe("abc123");
    expect(snapshot.comparisonPolicy.requiredStableFields).toHaveLength(5);
    expect(commands.map(({ command }) => command)).toEqual(["codesign", "codesign", "spctl", "defaults"]);
  });
});
