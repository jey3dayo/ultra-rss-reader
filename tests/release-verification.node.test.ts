import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeConfiguredUpdaterPublicKey, verifyMinisignSignature } from "../scripts/release/minisign-verification.ts";
import { expectedReleaseAssetNames } from "../scripts/release/release-artifact-contract.ts";
import {
  type ReleaseVerificationIdentity,
  type ReleaseVerificationRelease,
  type ReleaseVerificationRun,
  verifyReleaseEvidence,
} from "../scripts/release/release-verification.ts";

const TAG = "v0.66.0";
const VERSION = "0.66.0";
const SOURCE_SHA = "4a11ce85afec51ea8eda4f7f47b1c7b45ce25230";
const RUN_ID = "38123539831";
const ATTEMPT = 1;
const RELEASE_ID = 409523579;
const RUN_URL = `https://github.com/jey3dayo/ultra-rss-reader/actions/runs/${RUN_ID}`;
const DRAFT_ALIAS = "untagged-2e97d1b316e7d3ef9e81";
const RUN_ID_BYTES = Buffer.from("keyid001");
const KEYS = generateKeyPairSync("ed25519");
const PUBLIC_RAW = KEYS.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const UPDATER_PUBLIC_KEY = `untrusted comment: fixture key\n${Buffer.concat([Buffer.from("Ed"), RUN_ID_BYTES, PUBLIC_RAW]).toString("base64")}`;

type Fixture = {
  files: Map<string, Uint8Array>;
  identity: ReleaseVerificationIdentity;
  manifestPlatforms: Record<string, unknown>;
  release: ReleaseVerificationRelease;
  run: ReleaseVerificationRun;
  updaterPublicKey: string;
};

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const bytesOf = (files: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array => {
  const bytes = files.get(name);
  if (!bytes) {
    throw new Error(`missing fixture bytes for ${name}`);
  }
  return bytes;
};

const minisign = (bytes: Uint8Array, algorithm = "ED"): string => {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseRecord = (bytes: Uint8Array): Record<string, unknown> => {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (!isRecord(value)) {
    throw new Error("fixture JSON must be an object");
  }
  return value;
};

const writeLatest = (fixture: Fixture): void => {
  fixture.files.set(
    "latest.json",
    Buffer.from(JSON.stringify({ version: VERSION, platforms: fixture.manifestPlatforms })),
  );
};

const refreshRelease = (fixture: Fixture): void => {
  fixture.release = {
    ...fixture.release,
    assets: expectedReleaseAssetNames(TAG).map((name) => {
      const bytes = bytesOf(fixture.files, name);
      return {
        browserDownloadUrl: releaseAssetUrl(name),
        digest: `sha256:${sha256(bytes)}`,
        name,
        size: bytes.byteLength,
      };
    }),
  };
};

const applyDraftDownloadAlias = (fixture: Fixture): void => {
  fixture.release = {
    ...fixture.release,
    url: `https://github.com/jey3dayo/ultra-rss-reader/releases/tag/${DRAFT_ALIAS}`,
    assets: fixture.release.assets.map((asset) => ({
      ...asset,
      browserDownloadUrl: `https://github.com/jey3dayo/ultra-rss-reader/releases/download/${DRAFT_ALIAS}/${encodeURIComponent(asset.name)}`,
    })),
  };
};

const setProvenanceValue = (
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

const createFixture = (): Fixture => {
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

const verify = (fixture: Fixture) =>
  verifyReleaseEvidence({
    files: fixture.files,
    identity: fixture.identity,
    release: fixture.release,
    run: fixture.run,
    tagTargetSha: SOURCE_SHA,
    updaterPublicKey: fixture.updaterPublicKey,
  });

describe("release artifact verification", () => {
  it("validates all 16 assets, producer-name checksums and the current platform aliases", () => {
    const fixture = createFixture();
    expect(expectedReleaseAssetNames(TAG)).toHaveLength(16);
    expect(Buffer.from(bytesOf(fixture.files, "Ultra.RSS.Reader.app.tar.gz.sha256")).toString()).toContain(
      "  Ultra RSS Reader.app.tar.gz",
    );
    expect(verify(fixture)).toEqual({ assetCount: 16, signatureCount: 3, version: VERSION });
  });

  it("maps the API untagged draft URL to the same release's canonical tag URL", () => {
    const fixture = createFixture();
    applyDraftDownloadAlias(fixture);
    expect(verify(fixture)).toEqual({ assetCount: 16, signatureCount: 3, version: VERSION });
  });

  it("rejects draft aliases with another origin, repository, slug, or filename", () => {
    const wrongUrls = [
      (name: string) => `https://example.test/jey3dayo/ultra-rss-reader/releases/download/${DRAFT_ALIAS}/${name}`,
      (name: string) => `https://github.com/other/repository/releases/download/${DRAFT_ALIAS}/${name}`,
      (name: string) => `https://github.com/jey3dayo/ultra-rss-reader/releases/download/untagged-deadbeef/${name}`,
      () => `https://github.com/jey3dayo/ultra-rss-reader/releases/download/${DRAFT_ALIAS}/wrong-asset.tar.gz`,
    ];
    for (const makeUrl of wrongUrls) {
      const fixture = createFixture();
      applyDraftDownloadAlias(fixture);
      const name = "Ultra.RSS.Reader_aarch64.app.tar.gz";
      fixture.release = {
        ...fixture.release,
        assets: fixture.release.assets.map((asset) =>
          asset.name === name ? { ...asset, browserDownloadUrl: makeUrl(name) } : asset,
        ),
      };
      expect(() => verify(fixture)).toThrow(
        `release asset ${name} URL does not match this draft release ID, tag, and filename`,
      );
    }
  });

  it("rejects latest manifest URLs outside the canonical tagged release path", () => {
    const wrongUrls = [
      `https://example.test/jey3dayo/ultra-rss-reader/releases/download/${TAG}/Ultra.RSS.Reader_aarch64.app.tar.gz`,
      `https://github.com/other/repository/releases/download/${TAG}/Ultra.RSS.Reader_aarch64.app.tar.gz`,
      "https://github.com/jey3dayo/ultra-rss-reader/releases/download/v0.66.1/Ultra.RSS.Reader_aarch64.app.tar.gz",
      `https://github.com/jey3dayo/ultra-rss-reader/releases/download/${TAG}/other-asset.tar.gz`,
    ];
    for (const url of wrongUrls) {
      const fixture = createFixture();
      const entry = fixture.manifestPlatforms["darwin-aarch64"];
      if (isRecord(entry)) {
        fixture.manifestPlatforms["darwin-aarch64"] = { ...entry, url };
      }
      writeLatest(fixture);
      refreshRelease(fixture);
      expect(() => verify(fixture)).toThrow("latest.json platform darwin-aarch64 points to the wrong release asset");
    }
  });

  it("accepts canonical manifest keys while still verifying the NSIS signature sidecar", () => {
    const fixture = createFixture();
    delete fixture.manifestPlatforms["darwin-aarch64-app"];
    delete fixture.manifestPlatforms["windows-x86_64-msi"];
    delete fixture.manifestPlatforms["windows-x86_64-nsis"];
    writeLatest(fixture);
    refreshRelease(fixture);
    expect(verify(fixture).signatureCount).toBe(3);

    const signatureName = `Ultra.RSS.Reader_${VERSION}_x64-setup.exe.sig`;
    fixture.files.set(signatureName, Buffer.from("malformed"));
    refreshRelease(fixture);
    expect(() => verify(fixture)).toThrow("canonical base64");
  });

  it("rejects an artifact signature tamper even when sidecar and GitHub digest metadata agree", () => {
    const fixture = createFixture();
    const signatureName = "Ultra.RSS.Reader_aarch64.app.tar.gz.sig";
    const encoded = Buffer.from(bytesOf(fixture.files, signatureName)).toString("utf8");
    const lines = Buffer.from(encoded, "base64").toString("utf8").trimEnd().split("\n");
    const signed = Buffer.from(lines[1] ?? "", "base64");
    signed[10] = (signed[10] ?? 0) ^ 1;
    lines[1] = signed.toString("base64");
    const tampered = Buffer.from(`${lines.join("\n")}\n`).toString("base64");
    fixture.files.set(signatureName, Buffer.from(tampered));
    for (const key of ["darwin-aarch64", "darwin-aarch64-app"]) {
      const entry = fixture.manifestPlatforms[key];
      if (isRecord(entry)) {
        fixture.manifestPlatforms[key] = { ...entry, signature: tampered };
      }
    }
    writeLatest(fixture);
    refreshRelease(fixture);
    expect(() => verify(fixture)).toThrow("Minisign artifact signature is invalid");
  });

  it("rejects malformed signatures and legacy Ed signatures", () => {
    const data = Buffer.from("fixture payload");
    expect(() => verifyMinisignSignature(data, "bad", UPDATER_PUBLIC_KEY)).toThrow();
    expect(() => verifyMinisignSignature(data, minisign(data, "Ed"), UPDATER_PUBLIC_KEY)).toThrow("prehashed ED");
    const encoded = Buffer.from(`${UPDATER_PUBLIC_KEY}\n`).toString("base64");
    expect(decodeConfiguredUpdaterPublicKey(encoded)).toBe(UPDATER_PUBLIC_KEY);
  });

  it("rejects tag, source, run and attempt mismatches in signed provenance", () => {
    for (const mismatch of [
      {
        platform: "darwin-aarch64",
        section: "source",
        key: "commitSha",
        value: "b".repeat(40),
        expectedError: "does not match the expected tag, source, run, attempt",
      },
      {
        platform: "darwin-aarch64",
        section: "workflow",
        key: "runId",
        value: "38123539832",
        expectedError: "workflow.runId does not match the expected build run",
      },
      {
        platform: "windows-x86_64",
        section: "workflow",
        key: "runAttempt",
        value: "2",
        expectedError: "workflow.runAttempt does not match the expected build attempt",
      },
      {
        platform: "windows-x86_64",
        section: "root",
        key: "releaseTag",
        value: "v0.66.1",
        expectedError: "does not match the expected tag, source, run, attempt",
      },
    ]) {
      const fixture = createFixture();
      if (mismatch.section === "root") {
        const name = `release-provenance-${mismatch.platform}.json`;
        const record = parseRecord(bytesOf(fixture.files, name));
        record[mismatch.key] = mismatch.value;
        fixture.files.set(name, Buffer.from(JSON.stringify(record)));
        refreshRelease(fixture);
      } else {
        setProvenanceValue(fixture, mismatch.platform, mismatch.section, mismatch.key, mismatch.value);
      }
      expect(() => verify(fixture)).toThrow(mismatch.expectedError);
    }
  });

  it("accepts a tag-ref workflow_dispatch build only when provenance names that same run", () => {
    const fixture = createFixture();
    fixture.run = { ...fixture.run, event: "workflow_dispatch" };
    for (const platform of ["darwin-aarch64", "windows-x86_64"]) {
      setProvenanceValue(fixture, platform, "workflow", "eventName", "workflow_dispatch");
    }
    expect(verify(fixture).assetCount).toBe(16);

    const dryRun = {
      ...fixture,
      identity: { ...fixture.identity, runId: "38123539832" },
      run: {
        ...fixture.run,
        databaseId: 38123539832,
        url: "https://github.com/jey3dayo/ultra-rss-reader/actions/runs/38123539832",
      },
    };
    expect(() => verify(dryRun)).toThrow("workflow.runId does not match the expected build run");
  });

  it("accepts gh's attempt-specific URL when provenance stores the canonical run URL", () => {
    const fixture = createFixture();
    fixture.run = { ...fixture.run, url: `${RUN_URL}/attempts/${ATTEMPT}` };
    expect(verify(fixture).assetCount).toBe(16);
  });

  it("rejects workflow run URLs with a different attempt, run ID, or origin", () => {
    const mismatches = [
      { label: "attempt", url: `${RUN_URL}/attempts/${ATTEMPT + 1}` },
      { label: "run ID", url: RUN_URL.replace(RUN_ID, "38123539832") },
      { label: "origin", url: RUN_URL.replace("https://github.com", "https://example.test") },
    ];
    for (const mismatch of mismatches) {
      const fixture = createFixture();
      setProvenanceValue(fixture, "darwin-aarch64", "workflow", "runUrl", mismatch.url);
      expect(() => verify(fixture), mismatch.label).toThrow(
        "release-provenance-darwin-aarch64.json.workflow.runUrl does not match this release's run ID and attempt",
      );
    }
    const wrongRunUrl = createFixture();
    wrongRunUrl.run = { ...wrongRunUrl.run, url: `${RUN_URL}/attempts/${ATTEMPT + 1}` };
    expect(() => verify(wrongRunUrl)).toThrow(
      "GitHub workflow run URL does not match this release's run ID and attempt",
    );
  });

  it("requires successful exact-source run metadata and GitHub digests", () => {
    const fixture = createFixture();
    expect(() => verifyReleaseEvidence({ ...fixture, tagTargetSha: "c".repeat(40) })).toThrow("tag target");
    expect(() =>
      verifyReleaseEvidence({ ...fixture, run: { ...fixture.run, conclusion: "failure" }, tagTargetSha: SOURCE_SHA }),
    ).toThrow("successful exact-tag build");
    fixture.release = {
      ...fixture.release,
      assets: fixture.release.assets.map((asset) =>
        asset.name === "latest.json" ? { ...asset, digest: `sha256:${"0".repeat(64)}` } : asset,
      ),
    };
    expect(() => verify(fixture)).toThrow("downloaded bytes do not match GitHub digest");
  });
});
