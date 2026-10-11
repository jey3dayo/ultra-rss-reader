import { describe, expect, it } from "vitest";
import { decodeConfiguredUpdaterPublicKey, verifyMinisignSignature } from "../scripts/release/minisign-verification.ts";
import {
  expectedReleaseAssetNames,
  optionalLinuxReleaseAssetNames,
} from "../scripts/release/release-artifact-contract.ts";
import { verifyReleaseEvidence } from "../scripts/release/release-verification.ts";
import {
  ATTEMPT,
  addOptionalLinuxReleaseAssets,
  applyDraftDownloadAlias,
  bytesOf,
  createFixture,
  DRAFT_ALIAS,
  type Fixture,
  isRecord,
  minisign,
  parseRecord,
  RUN_ID,
  RUN_URL,
  refreshRelease,
  SOURCE_SHA,
  setProvenanceValue,
  TAG,
  UPDATER_PUBLIC_KEY,
  VERSION,
  writeLatest,
} from "./helpers/release-verification-fixture.ts";

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
  it("accepts the 16 core assets when the optional Linux pair is absent", () => {
    const fixture = createFixture();
    expect(expectedReleaseAssetNames(TAG)).toHaveLength(16);
    expect(Buffer.from(bytesOf(fixture.files, "Ultra.RSS.Reader.app.tar.gz.sha256")).toString()).toContain(
      "  Ultra RSS Reader.app.tar.gz",
    );
    expect(verify(fixture)).toEqual({ assetCount: 16, signatureCount: 3, version: VERSION });
  });

  it("accepts the optional versioned Linux .deb and AppImage pair from the exact dispatch run", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    expect(verify(fixture)).toEqual({ assetCount: 18, signatureCount: 3, version: VERSION });
    expect(Object.keys(fixture.manifestPlatforms)).not.toContain("linux-x86_64");
  });

  it("rejects optional downloaded files absent from GitHub release metadata", () => {
    const fixture = createFixture();
    for (const name of optionalLinuxReleaseAssetNames(TAG)) {
      fixture.files.set(name, Buffer.from(`unlisted fixture ${name}\n`));
    }
    expect(() => verify(fixture)).toThrow("GitHub asset metadata and downloaded filenames do not match exactly");
  });

  it("rejects GitHub assets missing from the downloaded file set", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    for (const name of optionalLinuxReleaseAssetNames(TAG)) {
      fixture.files.delete(name);
    }
    expect(() => verify(fixture)).toThrow("GitHub asset metadata and downloaded filenames do not match exactly");
  });

  it("rejects a missing half of the optional Linux asset pair", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture, optionalLinuxReleaseAssetNames(TAG).slice(0, 1));
    expect(() => verify(fixture)).toThrow("optional Linux release assets must include both the .deb and AppImage");
  });

  it("rejects Linux assets not bound to a workflow_dispatch build run", () => {
    const fixture = createFixture();
    fixture.files.set(optionalLinuxReleaseAssetNames(TAG)[0] ?? "", Buffer.from("linux package\n"));
    fixture.files.set(optionalLinuxReleaseAssetNames(TAG)[1] ?? "", Buffer.from("linux image\n"));
    refreshRelease(fixture);
    expect(() => verify(fixture)).toThrow(
      "optional Linux release assets require the selected workflow_dispatch build run",
    );
  });

  it("checks downloaded optional Linux bytes against GitHub digest and size metadata", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    const linuxName = optionalLinuxReleaseAssetNames(TAG)[0];
    if (!linuxName) {
      throw new Error("missing optional Linux package name");
    }
    fixture.release = {
      ...fixture.release,
      assets: fixture.release.assets.map((asset) =>
        asset.name === linuxName ? { ...asset, digest: `sha256:${"0".repeat(64)}` } : asset,
      ),
    };
    expect(() => verify(fixture)).toThrow(`downloaded bytes do not match GitHub digest and size for ${linuxName}`);
  });

  it("rejects unsupported Linux RPM assets", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    fixture.files.set(`Ultra RSS Reader_${VERSION}_amd64.rpm`, Buffer.from("unsupported rpm\n"));
    refreshRelease(fixture);
    expect(() => verify(fixture)).toThrow("release asset inventory must contain the 16 core assets");
  });

  it("rejects duplicate release asset names", () => {
    const fixture = createFixture();
    const duplicate = fixture.release.assets[0];
    if (!duplicate) {
      throw new Error("missing fixture release asset");
    }
    fixture.release = { ...fixture.release, assets: [...fixture.release.assets, duplicate] };
    expect(() => verify(fixture)).toThrow("release asset inventory contains duplicate names");
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

  it("rejects trusted-comment and global signature tampering with the primary signature unchanged", () => {
    const data = Buffer.from("fixture payload");
    const lines = Buffer.from(minisign(data), "base64").toString("utf8").trimEnd().split("\n");
    const originalPrimary = lines[1];
    const tamperedComment = [...lines];
    tamperedComment[2] = "trusted comment: changed";
    expect(tamperedComment[1]).toBe(originalPrimary);
    expect(() =>
      verifyMinisignSignature(
        data,
        Buffer.from(`${tamperedComment.join("\n")}\n`).toString("base64"),
        UPDATER_PUBLIC_KEY,
      ),
    ).toThrow("Minisign trusted-comment signature is invalid");

    const tamperedGlobal = [...lines];
    const globalSignature = Buffer.from(tamperedGlobal[3] ?? "", "base64");
    globalSignature[0] = (globalSignature[0] ?? 0) ^ 1;
    tamperedGlobal[3] = globalSignature.toString("base64");
    expect(tamperedGlobal[1]).toBe(originalPrimary);
    expect(() =>
      verifyMinisignSignature(
        data,
        Buffer.from(`${tamperedGlobal.join("\n")}\n`).toString("base64"),
        UPDATER_PUBLIC_KEY,
      ),
    ).toThrow("Minisign trusted-comment signature is invalid");
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
