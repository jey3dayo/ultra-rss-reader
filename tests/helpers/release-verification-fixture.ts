import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  expectedReleaseAssetNames,
  LINUX_PROVENANCE_ASSET_NAME,
  LINUX_PROVENANCE_GENERATION_STEP,
  linuxReleaseBinaryNames,
  optionalLinuxReleaseAssetNames,
} from "../../scripts/release/release-artifact-contract.ts";
import type {
  ReleaseVerificationIdentity,
  ReleaseVerificationRelease,
  ReleaseVerificationRun,
} from "../../scripts/release/release-verification.ts";

export const TAG = "v0.66.0";
export const VERSION = "0.66.0";
export const SOURCE_SHA = "4a11ce85afec51ea8eda4f7f47b1c7b45ce25230";
export const RUN_ID = "38123539831";
export const ATTEMPT = 1;
export const RELEASE_ID = 409523579;
export const RUN_URL = `https://github.com/jey3dayo/ultra-rss-reader/actions/runs/${RUN_ID}`;
export const DRAFT_ALIAS = "untagged-2e97d1b316e7d3ef9e81";
const RUN_ID_BYTES = Buffer.from("keyid001");
const KEYS = generateKeyPairSync("ed25519");
const PUBLIC_RAW = KEYS.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
export const UPDATER_PUBLIC_KEY = `untrusted comment: fixture key\n${Buffer.concat([Buffer.from("Ed"), RUN_ID_BYTES, PUBLIC_RAW]).toString("base64")}`;

export type Fixture = {
  files: Map<string, Uint8Array>;
  identity: ReleaseVerificationIdentity;
  manifestPlatforms: Record<string, unknown>;
  release: ReleaseVerificationRelease;
  run: ReleaseVerificationRun;
  updaterPublicKey: string;
};

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const bytesOf = (files: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array => {
  const bytes = files.get(name);
  if (!bytes) {
    throw new Error(`missing fixture bytes for ${name}`);
  }
  return bytes;
};

export const minisign = (bytes: Uint8Array, algorithm = "ED"): string => {
  const message = algorithm === "ED" ? createHash("blake2b512").update(bytes).digest() : bytes;
  const primary = sign(null, message, KEYS.privateKey);
  const trustedComment = "fixture timestamp:1";
  const global = sign(null, Buffer.concat([primary, Buffer.from(trustedComment)]), KEYS.privateKey);
  const signature = Buffer.concat([Buffer.from(algorithm), RUN_ID_BYTES, primary]);
  return Buffer.from(
    `untrusted comment: fixture signature\n${signature.toString("base64")}\ntrusted comment: ${trustedComment}\n${global.toString("base64")}\n`,
  ).toString("base64");
};

const releaseAssetUrl = (name: string): string =>
  `https://github.com/jey3dayo/ultra-rss-reader/releases/download/${TAG}/${encodeURIComponent(name)}`;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseRecord = (bytes: Uint8Array): Record<string, unknown> => {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (!isRecord(value)) {
    throw new Error("fixture JSON must be an object");
  }
  return value;
};

export const writeLatest = (fixture: Fixture): void => {
  fixture.files.set(
    "latest.json",
    Buffer.from(JSON.stringify({ version: VERSION, platforms: fixture.manifestPlatforms })),
  );
};

export const refreshRelease = (fixture: Fixture): void => {
  fixture.release = {
    ...fixture.release,
    assets: [...fixture.files].map(([name, bytes]) => ({
      browserDownloadUrl: releaseAssetUrl(name),
      digest: `sha256:${sha256(bytes)}`,
      name,
      size: bytes.byteLength,
    })),
  };
};

export const applyDraftDownloadAlias = (fixture: Fixture): void => {
  fixture.release = {
    ...fixture.release,
    url: `https://github.com/jey3dayo/ultra-rss-reader/releases/tag/${DRAFT_ALIAS}`,
    assets: fixture.release.assets.map((asset) => ({
      ...asset,
      browserDownloadUrl: `https://github.com/jey3dayo/ultra-rss-reader/releases/download/${DRAFT_ALIAS}/${encodeURIComponent(asset.name)}`,
    })),
  };
};

export const setProvenanceValue = (
  fixture: Fixture,
  platform: string,
  sectionName: string,
  key: string,
  value: string,
): void => {
  const name = `release-provenance-${platform}.json`;
  const record = parseRecord(bytesOf(fixture.files, name));
  const section = record[sectionName];
  if (!isRecord(section)) {
    throw new Error(`fixture ${sectionName} must be an object`);
  }
  section[key] = value;
  fixture.files.set(name, Buffer.from(JSON.stringify(record)));
  refreshRelease(fixture);
};

export const addOptionalLinuxReleaseAssets = (fixture: Fixture, names = optionalLinuxReleaseAssetNames(TAG)): void => {
  for (const name of names) {
    fixture.files.set(name, Buffer.from(`linux fixture ${name}\n`));
  }
  fixture.run = {
    ...fixture.run,
    event: "workflow_dispatch",
    jobs: [{ conclusion: "success", steps: [{ name: LINUX_PROVENANCE_GENERATION_STEP, conclusion: "success" }] }],
  };
  if (names.includes(LINUX_PROVENANCE_ASSET_NAME)) {
    fixture.files.set(
      LINUX_PROVENANCE_ASSET_NAME,
      Buffer.from(
        JSON.stringify({
          artifacts: linuxReleaseBinaryNames(TAG).map((name) => ({
            name,
            sha256: sha256(bytesOf(fixture.files, name)),
          })),
          packageVersion: VERSION,
          releaseTag: TAG,
          releaseId: fixture.release.id,
          runner: { assetPlatform: "linux-x86_64", matrixPlatform: "ubuntu-24.04", os: "Linux" },
          source: { commitSha: SOURCE_SHA, tagTargetSha: SOURCE_SHA },
          workflow: {
            eventName: "workflow_dispatch",
            ref: `refs/tags/${TAG}`,
            refName: TAG,
            runAttempt: String(ATTEMPT),
            runId: RUN_ID,
            runUrl: RUN_URL,
            workflow: "Release",
          },
        }),
      ),
    );
  }
  for (const platform of ["darwin-aarch64", "windows-x86_64"]) {
    setProvenanceValue(fixture, platform, "workflow", "eventName", "workflow_dispatch");
  }
  refreshRelease(fixture);
};

export const createFixture = (): Fixture => {
  const files = new Map<string, Uint8Array>();
  const identity = { attempt: ATTEMPT, runId: RUN_ID, sourceSha: SOURCE_SHA, tag: TAG };
  const run: ReleaseVerificationRun = {
    attempt: ATTEMPT,
    conclusion: "success",
    databaseId: Number(RUN_ID),
    event: "push",
    headBranch: TAG,
    headSha: SOURCE_SHA,
    status: "completed",
    url: RUN_URL,
    workflowName: "Release",
  };
  const fixture: Fixture = {
    files,
    identity,
    manifestPlatforms: {},
    release: {
      assets: [],
      id: RELEASE_ID,
      isDraft: true,
      isPrerelease: false,
      tagName: TAG,
      url: `https://github.com/jey3dayo/ultra-rss-reader/releases/tag/${TAG}`,
    },
    run,
    updaterPublicKey: UPDATER_PUBLIC_KEY,
  };
  for (const name of expectedReleaseAssetNames(TAG)) {
    files.set(name, Buffer.from(`fixture asset ${name}\n`));
  }

  const signedTargets = [
    { asset: "Ultra.RSS.Reader_aarch64.app.tar.gz", signature: "Ultra.RSS.Reader_aarch64.app.tar.gz.sig" },
    { asset: `Ultra.RSS.Reader_${VERSION}_x64-setup.exe`, signature: `Ultra.RSS.Reader_${VERSION}_x64-setup.exe.sig` },
    { asset: `Ultra.RSS.Reader_${VERSION}_x64_en-US.msi`, signature: `Ultra.RSS.Reader_${VERSION}_x64_en-US.msi.sig` },
  ];
  const signatures = new Map<string, string>();
  for (const target of signedTargets) {
    const signature = minisign(bytesOf(files, target.asset));
    signatures.set(target.asset, signature.trimEnd());
    files.set(target.signature, Buffer.from(signature));
  }
  const manifestTargets = [
    ["darwin-aarch64", signedTargets[0]],
    ["darwin-aarch64-app", signedTargets[0]],
    ["windows-x86_64", signedTargets[2]],
    ["windows-x86_64-msi", signedTargets[2]],
    ["windows-x86_64-nsis", signedTargets[1]],
  ] as const;
  for (const [key, target] of manifestTargets) {
    if (!target) {
      throw new Error("missing fixture signature target");
    }
    fixture.manifestPlatforms[key] = {
      signature: signatures.get(target.asset),
      url: releaseAssetUrl(target.asset),
    };
  }
  writeLatest(fixture);

  const provenanceTargets = [
    {
      artifactName: "Ultra RSS Reader.app.tar.gz",
      assetName: "Ultra.RSS.Reader_aarch64.app.tar.gz",
      platform: "darwin-aarch64",
    },
    {
      artifactName: `Ultra RSS Reader_${VERSION}_x64-setup.exe`,
      assetName: `Ultra.RSS.Reader_${VERSION}_x64-setup.exe`,
      platform: "windows-x86_64",
    },
  ];
  for (const target of provenanceTargets) {
    const checksumAssetName = `${target.artifactName}.sha256`;
    const assetBytes = bytesOf(files, target.assetName);
    const sidecarName =
      target.platform === "darwin-aarch64"
        ? "Ultra.RSS.Reader.app.tar.gz.sha256"
        : `Ultra.RSS.Reader_${VERSION}_x64-setup.exe.sha256`;
    files.set(sidecarName, Buffer.from(`${sha256(assetBytes)}  ${target.artifactName}\n`));
    const record = {
      artifact: { checksumAssetName, name: target.artifactName, sha256: sha256(assetBytes) },
      dependencyProvenanceAssets: [`pnpm-licenses-${target.platform}.json`, `cargo-licenses-${target.platform}.json`],
      packageVersion: VERSION,
      releaseTag: TAG,
      runner: { assetPlatform: target.platform },
      source: { commitSha: SOURCE_SHA, tagTargetSha: SOURCE_SHA },
      workflow: {
        eventName: "push",
        ref: `refs/tags/${TAG}`,
        refName: TAG,
        runAttempt: String(ATTEMPT),
        runId: RUN_ID,
        runUrl: RUN_URL,
        workflow: "Release",
      },
    };
    files.set(`release-provenance-${target.platform}.json`, Buffer.from(JSON.stringify(record)));
  }
  refreshRelease(fixture);
  return fixture;
};
