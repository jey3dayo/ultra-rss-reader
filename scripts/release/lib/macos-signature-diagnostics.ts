import * as v from "valibot";

export const KEYCHAIN_SERVICE = "ultra-rss-reader";
export const SNAPSHOT_SCHEMA_VERSION = 1;

export const STABLE_COMPARISON_FIELDS = [
  "bundleIdentifier",
  "codesignIdentifier",
  "teamIdentifier",
  "authorityChain",
  "designatedRequirement",
] as const;

type StableComparisonField = (typeof STABLE_COMPARISON_FIELDS)[number];

const commandResultSchema = v.object({
  command: v.array(v.string()),
  ok: v.boolean(),
  status: v.nullable(v.number()),
  stderr: v.string(),
  stdout: v.string(),
});

const codesignDetailsSchema = v.object({
  authorityChain: v.array(v.string()),
  cdHash: v.nullable(v.string()),
  designatedRequirement: v.nullable(v.string()),
  identifier: v.nullable(v.string()),
  signature: v.nullable(v.string()),
  teamIdentifier: v.nullable(v.string()),
});

const snapshotSchema = v.object({
  appPath: v.string(),
  artifactUrl: v.optional(v.string()),
  bundleIdentifier: v.nullable(v.string()),
  codesign: codesignDetailsSchema,
  comparisonPolicy: v.object({
    ignoredFields: v.tuple([v.literal("cdHash")]),
    requiredStableFields: v.array(v.picklist(STABLE_COMPARISON_FIELDS)),
  }),
  createdAt: v.string(),
  keychainScope: v.object({
    accountIdSource: v.literal("Ultra RSS Reader account id"),
    service: v.literal(KEYCHAIN_SERVICE),
  }),
  label: v.string(),
  schemaVersion: v.literal(SNAPSHOT_SCHEMA_VERSION),
  version: v.optional(v.string()),
  verification: v.array(commandResultSchema),
});

export type CommandResult = v.InferOutput<typeof commandResultSchema>;
type CodesignDetails = v.InferOutput<typeof codesignDetailsSchema>;
export type MacosKeychainSignatureSnapshot = v.InferOutput<typeof snapshotSchema>;

export type SnapshotComparison = {
  diffs: Array<{
    after: string | string[] | null;
    before: string | string[] | null;
    field: StableComparisonField;
  }>;
  ok: boolean;
};

const firstMatch = (value: string, pattern: RegExp): string | null => value.match(pattern)?.[1]?.trim() ?? null;

export const parseCodesignDetails = (codesignOutput: string): CodesignDetails => ({
  authorityChain: [...codesignOutput.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1]?.trim() ?? ""),
  cdHash: firstMatch(codesignOutput, /^CDHash=(.+)$/m),
  designatedRequirement: firstMatch(codesignOutput, /^designated => (.+)$/m),
  identifier: firstMatch(codesignOutput, /^Identifier=(.+)$/m),
  signature: firstMatch(codesignOutput, /^Signature=(.+)$/m),
  teamIdentifier: firstMatch(codesignOutput, /^TeamIdentifier=(.+)$/m),
});

export const parseMacosKeychainSignatureSnapshot = (value: unknown): MacosKeychainSignatureSnapshot =>
  v.parse(snapshotSchema, value);

const stableValue = (
  snapshot: MacosKeychainSignatureSnapshot,
  field: StableComparisonField,
): string | string[] | null => {
  switch (field) {
    case "authorityChain":
      return snapshot.codesign.authorityChain;
    case "bundleIdentifier":
      return snapshot.bundleIdentifier;
    case "codesignIdentifier":
      return snapshot.codesign.identifier;
    case "designatedRequirement":
      return snapshot.codesign.designatedRequirement;
    case "teamIdentifier":
      return snapshot.codesign.teamIdentifier;
  }
};

const stableEquals = (left: string | string[] | null, right: string | string[] | null): boolean =>
  Array.isArray(left) || Array.isArray(right)
    ? Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    : left === right;

export const compareSnapshots = (
  before: MacosKeychainSignatureSnapshot,
  after: MacosKeychainSignatureSnapshot,
): SnapshotComparison => {
  const diffs = STABLE_COMPARISON_FIELDS.flatMap((field) => {
    const beforeValue = stableValue(before, field);
    const afterValue = stableValue(after, field);
    return stableEquals(beforeValue, afterValue) ? [] : [{ after: afterValue, before: beforeValue, field }];
  });

  return { diffs, ok: diffs.length === 0 };
};

const isAdHocSnapshot = (snapshot: MacosKeychainSignatureSnapshot): boolean =>
  snapshot.codesign.signature === "adhoc" ||
  (snapshot.codesign.authorityChain.length === 0 && snapshot.codesign.teamIdentifier === null);

export const classifySignatureDiffs = (
  before: MacosKeychainSignatureSnapshot,
  after: MacosKeychainSignatureSnapshot,
  comparison: SnapshotComparison,
): string[] => {
  if (comparison.ok) {
    return [
      "signature requirement is stable; investigate legacy Keychain ACL or a one-time item re-save if prompts persist",
    ];
  }
  if (isAdHocSnapshot(before) || isAdHocSnapshot(after)) {
    return ["local ad-hoc re-signed app is involved; do not use this Keychain item as published-update evidence"];
  }

  return [
    "release artifact signature requirement changed, or the updater installed a different signed app than the published artifact",
  ];
};
