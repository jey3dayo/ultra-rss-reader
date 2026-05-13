import { describe, expect, it } from "vitest";
import {
  classifySignatureDiffs,
  compareSnapshots,
  type MacosKeychainSignatureSnapshot,
  parseCodesignDetails,
} from "../../../scripts/release/macos-keychain-signature-diagnostics";

const baseSnapshot = (overrides: Partial<MacosKeychainSignatureSnapshot> = {}): MacosKeychainSignatureSnapshot => ({
  appPath: "/Applications/Ultra RSS Reader.app",
  artifactUrl: "https://example.com/Ultra_RSS_Reader.app.tar.gz",
  bundleIdentifier: "com.jey3dayo.ultra-rss-reader",
  codesign: {
    authorityChain: ["Developer ID Application: Example (TEAMID1234)", "Developer ID Certification Authority"],
    cdHash: "old-cdhash",
    designatedRequirement:
      'anchor apple generic and identifier "com.jey3dayo.ultra-rss-reader" and certificate leaf[subject.OU] = TEAMID1234',
    identifier: "com.jey3dayo.ultra-rss-reader",
    signature: null,
    teamIdentifier: "TEAMID1234",
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
  createdAt: "2026-05-14T00:00:00.000Z",
  keychainScope: {
    accountIdSource: "Ultra RSS Reader account id",
    service: "ultra-rss-reader",
  },
  label: "before-update",
  schemaVersion: 1,
  verification: [],
  version: "0.35.0",
  ...overrides,
});

describe("macOS Keychain signature diagnostics", () => {
  it("parses stable codesign fields without treating CDHash as the app identity", () => {
    const parsed = parseCodesignDetails(`
Executable=/Applications/Ultra RSS Reader.app/Contents/MacOS/ultra-rss-reader
Identifier=com.jey3dayo.ultra-rss-reader
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20500 size=123 flags=0x10000(runtime) hashes=1+7 location=embedded
Signature size=9000
Authority=Developer ID Application: Example (TEAMID1234)
Authority=Developer ID Certification Authority
TeamIdentifier=TEAMID1234
CDHash=version-specific-hash
designated => anchor apple generic and identifier "com.jey3dayo.ultra-rss-reader" and certificate leaf[subject.OU] = TEAMID1234
`);

    expect(parsed).toEqual({
      authorityChain: ["Developer ID Application: Example (TEAMID1234)", "Developer ID Certification Authority"],
      cdHash: "version-specific-hash",
      designatedRequirement:
        'anchor apple generic and identifier "com.jey3dayo.ultra-rss-reader" and certificate leaf[subject.OU] = TEAMID1234',
      identifier: "com.jey3dayo.ultra-rss-reader",
      signature: null,
      teamIdentifier: "TEAMID1234",
    });
  });

  it("allows CDHash to change while requiring signing identity fields to stay stable", () => {
    const before = baseSnapshot();
    const after = baseSnapshot({
      codesign: {
        ...baseSnapshot().codesign,
        cdHash: "new-cdhash",
      },
      label: "after-update",
      version: "0.36.0",
    });

    expect(compareSnapshots(before, after)).toEqual({ diffs: [], ok: true });
  });

  it("classifies ad-hoc signatures as local contamination instead of published update evidence", () => {
    const before = baseSnapshot({
      codesign: {
        ...baseSnapshot().codesign,
        authorityChain: [],
        signature: "adhoc",
        teamIdentifier: null,
      },
    });
    const after = baseSnapshot({ label: "after-update" });
    const comparison = compareSnapshots(before, after);

    expect(comparison.ok).toBe(false);
    expect(classifySignatureDiffs(before, after, comparison)).toEqual([
      "local ad-hoc re-signed app is involved; do not use this Keychain item as published-update evidence",
    ]);
  });
});
