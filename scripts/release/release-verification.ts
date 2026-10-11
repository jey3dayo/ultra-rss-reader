import { createHash } from "node:crypto";
import * as v from "valibot";
import { verifyMinisignSignature } from "./minisign-verification.ts";
import {
  LINUX_PROVENANCE_ASSET_NAME,
  LINUX_PROVENANCE_GENERATION_STEP,
  linuxReleaseBinaryNames,
  optionalLinuxReleaseAssetNames,
  releaseVersion,
  validateReleaseAssetInventory,
} from "./release-artifact-contract.ts";
import { parseUpdaterChecksum } from "./updater-checksum.ts";

export type ReleaseVerificationAsset = {
  browserDownloadUrl: string;
  digest: string;
  name: string;
  size: number;
};

export type ReleaseVerificationRelease = {
  assets: readonly ReleaseVerificationAsset[];
  id: number;
  isDraft: boolean;
  isPrerelease: boolean;
  tagName: string;
  url: string;
};

export type ReleaseVerificationRun = {
  attempt: number;
  conclusion: string;
  databaseId: number;
  event: string;
  headBranch: string;
  headSha: string;
  jobs?: readonly {
    conclusion: string;
    steps: readonly { name: string; conclusion: string }[];
  }[];
  status: string;
  url: string;
  workflowName: string;
};

export type ReleaseVerificationIdentity = {
  attempt: number;
  runId: string;
  sourceSha: string;
  tag: string;
};

export type ReleaseVerificationInput = {
  files: ReadonlyMap<string, Uint8Array>;
  identity: ReleaseVerificationIdentity;
  release: ReleaseVerificationRelease;
  run: ReleaseVerificationRun;
  tagTargetSha: string;
  updaterPublicKey: string;
};

const fail = (message: string): never => {
  throw new Error(message);
};

const recordSchema = v.record(v.string(), v.unknown());

const recordOf = (value: unknown, label: string): Record<string, unknown> => {
  if (!v.is(recordSchema, value)) {
    return fail(`${label} must be an object`);
  }
  return value;
};

const stringAt = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  return typeof value === "string" ? value : fail(`${label}.${key} must be a string`);
};

const publicUrl = (value: string, label: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    return fail(`${label} must be an HTTPS URL without credentials, query, or fragment`);
  }
  return url;
};

const releaseRoute = (
  release: ReleaseVerificationRelease,
  tag: string,
): { origin: string; repositoryPath: string; slug: string } => {
  if (!Number.isSafeInteger(release.id) || release.id < 1) {
    fail("draft release ID is invalid");
  }
  const url = publicUrl(release.url, "draft release URL");
  const match = /^(.*)\/releases\/tag\/([^/]+)$/.exec(url.pathname);
  const repositoryPath = match?.[1] ?? fail("draft release URL does not identify a release tag route");
  const encodedSlug = match?.[2] ?? fail("draft release URL does not identify a release tag route");
  const slug = (() => {
    try {
      return decodeURIComponent(encodedSlug);
    } catch {
      return fail("draft release URL has an invalid alias");
    }
  })();
  if (slug !== tag && (!release.isDraft || !/^untagged-[a-f0-9]+$/i.test(slug))) {
    fail("draft release URL alias does not match the expected tag");
  }
  return { origin: url.origin, repositoryPath, slug };
};

const publicAssetUrl = (release: ReleaseVerificationRelease, tag: string, asset: ReleaseVerificationAsset): string => {
  const route = releaseRoute(release, tag);
  const metadataUrl = publicUrl(asset.browserDownloadUrl, `release asset ${asset.name} URL`);
  const aliasPath = `${route.repositoryPath}/releases/download/${encodeURIComponent(route.slug)}/${encodeURIComponent(asset.name)}`;
  if (metadataUrl.origin !== route.origin || metadataUrl.pathname !== aliasPath) {
    fail(`release asset ${asset.name} URL does not match this draft release ID, tag, and filename`);
  }
  return `${route.origin}${route.repositoryPath}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
};

const parseJsonRecord = (bytes: Uint8Array, label: string): Record<string, unknown> => {
  try {
    return recordOf(JSON.parse(Buffer.from(bytes).toString("utf8")), label);
  } catch {
    return fail(`${label} is not valid JSON`);
  }
};

const validateReleaseAssets = (
  release: ReleaseVerificationRelease,
  tag: string,
): Map<string, ReleaseVerificationAsset> => {
  const expectedNames = validateReleaseAssetInventory(
    tag,
    release.assets.map((asset) => asset.name),
  );
  const expected = new Set(expectedNames);
  const assets = new Map<string, ReleaseVerificationAsset>();
  for (const asset of release.assets) {
    if (!expected.has(asset.name) || assets.has(asset.name)) {
      fail(`unexpected or duplicate release asset ${asset.name}`);
    }
    if (!/^sha256:[a-f0-9]{64}$/i.test(asset.digest) || !Number.isSafeInteger(asset.size) || asset.size < 0) {
      fail(`release asset ${asset.name} has invalid digest or size metadata`);
    }
    publicAssetUrl(release, tag, asset);
    assets.set(asset.name, asset);
  }
  for (const name of expectedNames) {
    if (!assets.has(name)) {
      fail(`release ${tag} is missing asset ${name}`);
    }
  }
  return assets;
};

const normalizeWorkflowRunUrl = (
  value: string,
  releaseUrlValue: string,
  identity: ReleaseVerificationIdentity,
  field: string,
): string => {
  const parseUrl = (url: string): URL => {
    try {
      return new URL(url);
    } catch {
      return fail(`${field} is not a valid workflow run URL`);
    }
  };
  const releaseUrl = parseUrl(releaseUrlValue);
  const runUrl = parseUrl(value);
  const marker = "/releases/";
  const markerIndex = releaseUrl.pathname.lastIndexOf(marker);
  const repositoryPath = releaseUrl.pathname.slice(0, markerIndex);
  const basePath = `${repositoryPath}/actions/runs/${identity.runId}`;
  const attemptPath = `${basePath}/attempts/${identity.attempt}`;
  if (
    releaseUrl.protocol !== "https:" ||
    runUrl.protocol !== "https:" ||
    markerIndex < 1 ||
    releaseUrl.username ||
    releaseUrl.password ||
    releaseUrl.search ||
    releaseUrl.hash ||
    runUrl.origin !== releaseUrl.origin ||
    runUrl.username ||
    runUrl.password ||
    runUrl.search ||
    runUrl.hash ||
    (runUrl.pathname !== basePath && runUrl.pathname !== attemptPath)
  ) {
    fail(`${field} does not match this release's run ID and attempt`);
  }
  return `${runUrl.origin}${basePath}`;
};

export const verifyReleaseIdentity = (
  identity: ReleaseVerificationIdentity,
  tagTargetSha: string,
  release: ReleaseVerificationRelease,
  run: ReleaseVerificationRun,
): string => {
  const version = releaseVersion(identity.tag);
  if (!/^[a-f0-9]{40}$/.test(identity.sourceSha) || tagTargetSha !== identity.sourceSha) {
    fail("remote annotated tag target does not match the expected source SHA");
  }
  if (
    release.tagName !== identity.tag ||
    !release.isDraft ||
    release.isPrerelease !== version.split("+")[0].includes("-")
  ) {
    fail(`release ${identity.tag} does not match the expected draft tag policy`);
  }
  const assets = validateReleaseAssets(release, identity.tag);
  if (
    String(run.databaseId) !== identity.runId ||
    run.attempt !== identity.attempt ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    !["push", "workflow_dispatch"].includes(run.event) ||
    run.headBranch !== identity.tag ||
    run.headSha !== identity.sourceSha ||
    run.workflowName !== "Release"
  ) {
    fail("the selected Release run attempt is not the successful exact-tag build");
  }
  const linuxNames = optionalLinuxReleaseAssetNames(identity.tag);
  if (assets.has(linuxNames[0])) {
    if (run.event !== "workflow_dispatch") {
      fail("optional Linux release assets require the selected workflow_dispatch build run");
    }
    if (
      !run.jobs?.some(
        (job) =>
          job.conclusion === "success" &&
          job.steps.some((step) => step.name === LINUX_PROVENANCE_GENERATION_STEP && step.conclusion === "success"),
      )
    ) {
      fail(
        "optional Linux release assets require a successful Linux provenance generation step in the selected run attempt",
      );
    }
  }
  normalizeWorkflowRunUrl(run.url, release.url, identity, "GitHub workflow run URL");
  return version;
};

const bytesOf = (files: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array => {
  const bytes = files.get(name);
  return bytes ?? fail(`downloaded release is missing ${name}`);
};

const requiredAsset = (assets: ReadonlyMap<string, ReleaseVerificationAsset>, name: string): ReleaseVerificationAsset =>
  assets.get(name) ?? fail(`release inventory is missing target asset ${name}`);

const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const textOf = (files: ReadonlyMap<string, Uint8Array>, name: string): string =>
  Buffer.from(bytesOf(files, name)).toString("utf8");

const assertChecksum = (
  files: ReadonlyMap<string, Uint8Array>,
  sidecarName: string,
  artifactName: string,
  digest: string,
): void => {
  const parsed = parseUpdaterChecksum(textOf(files, sidecarName));
  if (!parsed.ok || parsed.value.sha256.toLowerCase() !== digest || parsed.value.artifactName !== artifactName) {
    fail(`updater checksum ${sidecarName} does not match its provenance artifact and downloaded bytes`);
  }
};

const verifyProvenance = (
  files: ReadonlyMap<string, Uint8Array>,
  identity: ReleaseVerificationIdentity,
  version: string,
  platform: "darwin-aarch64" | "windows-x86_64",
  assetName: string,
  sourceArtifactName: string,
  checksumAssetName: string,
  releaseUrl: string,
  expectedRunUrl?: string,
  expectedRunEvent?: string,
): string => {
  const provenanceName = `release-provenance-${platform}.json`;
  const record = parseJsonRecord(bytesOf(files, provenanceName), provenanceName);
  const artifact = recordOf(record.artifact, `${provenanceName}.artifact`);
  const source = recordOf(record.source, `${provenanceName}.source`);
  const workflow = recordOf(record.workflow, `${provenanceName}.workflow`);
  const runner = recordOf(record.runner, `${provenanceName}.runner`);
  const artifactBytes = bytesOf(files, assetName);
  const digest = sha256Of(artifactBytes);
  const provenanceRunId = stringAt(workflow, "runId", provenanceName);
  if (provenanceRunId !== identity.runId) {
    fail(`${provenanceName}.workflow.runId does not match the expected build run`);
  }
  const provenanceAttempt = stringAt(workflow, "runAttempt", provenanceName);
  if (provenanceAttempt !== String(identity.attempt)) {
    fail(`${provenanceName}.workflow.runAttempt does not match the expected build attempt`);
  }
  const provenanceRunUrl = stringAt(workflow, "runUrl", provenanceName);
  const normalizedProvenanceRunUrl = normalizeWorkflowRunUrl(
    provenanceRunUrl,
    releaseUrl,
    identity,
    `${provenanceName}.workflow.runUrl`,
  );
  if (
    expectedRunUrl !== undefined &&
    normalizedProvenanceRunUrl !==
      normalizeWorkflowRunUrl(expectedRunUrl, releaseUrl, identity, "GitHub workflow run URL")
  ) {
    fail(`${provenanceName}.workflow.runUrl does not match the selected GitHub run URL`);
  }
  if (
    record.releaseTag !== identity.tag ||
    record.packageVersion !== version ||
    runner.assetPlatform !== platform ||
    stringAt(artifact, "name", provenanceName) !== sourceArtifactName ||
    stringAt(artifact, "checksumAssetName", provenanceName) !== checksumAssetName ||
    stringAt(artifact, "sha256", provenanceName).toLowerCase() !== digest ||
    stringAt(source, "commitSha", provenanceName) !== identity.sourceSha ||
    stringAt(source, "tagTargetSha", provenanceName) !== identity.sourceSha ||
    stringAt(workflow, "ref", provenanceName) !== `refs/tags/${identity.tag}` ||
    stringAt(workflow, "refName", provenanceName) !== identity.tag ||
    !["push", "workflow_dispatch"].includes(stringAt(workflow, "eventName", provenanceName)) ||
    stringAt(workflow, "workflow", provenanceName) !== "Release" ||
    (expectedRunEvent !== undefined && stringAt(workflow, "eventName", provenanceName) !== expectedRunEvent)
  ) {
    fail(`${provenanceName} does not match the expected tag, source, run, attempt, platform, and artifact`);
  }
  const dependencyAssets = record.dependencyProvenanceAssets;
  const expectedDependencyAssets = [`pnpm-licenses-${platform}.json`, `cargo-licenses-${platform}.json`];
  if (
    !Array.isArray(dependencyAssets) ||
    dependencyAssets.length !== 2 ||
    !expectedDependencyAssets.every((name) => dependencyAssets.includes(name))
  ) {
    fail(`${provenanceName} dependency assets do not match the release inventory`);
  }
  return digest;
};

const verifyLinuxProvenance = (
  files: ReadonlyMap<string, Uint8Array>,
  identity: ReleaseVerificationIdentity,
  release: ReleaseVerificationRelease,
  runUrl: string,
  runEvent: string,
): void => {
  const label = LINUX_PROVENANCE_ASSET_NAME;
  const record = parseJsonRecord(bytesOf(files, label), label);
  const source = recordOf(record.source, `${label}.source`);
  const workflow = recordOf(record.workflow, `${label}.workflow`);
  const runner = recordOf(record.runner, `${label}.runner`);
  if (record.releaseId !== release.id) {
    fail(`${label}.releaseId does not match the selected release ID`);
  }
  if (
    record.releaseTag !== identity.tag ||
    record.packageVersion !== releaseVersion(identity.tag) ||
    source.commitSha !== identity.sourceSha ||
    source.tagTargetSha !== identity.sourceSha ||
    workflow.runId !== identity.runId ||
    workflow.runAttempt !== String(identity.attempt) ||
    workflow.ref !== `refs/tags/${identity.tag}` ||
    workflow.refName !== identity.tag ||
    workflow.eventName !== runEvent ||
    workflow.eventName !== "workflow_dispatch" ||
    workflow.workflow !== "Release" ||
    runner.assetPlatform !== "linux-x86_64" ||
    runner.os !== "Linux" ||
    runner.matrixPlatform !== "ubuntu-24.04"
  ) {
    fail(`${label} does not match the expected tag, source, run, attempt, ref, and Linux platform`);
  }
  if (
    normalizeWorkflowRunUrl(stringAt(workflow, "runUrl", label), release.url, identity, `${label}.workflow.runUrl`) !==
    normalizeWorkflowRunUrl(runUrl, release.url, identity, "GitHub workflow run URL")
  ) {
    fail(`${label}.workflow.runUrl does not match the selected GitHub run URL`);
  }
  const artifacts = v.parse(v.array(v.object({ name: v.string(), sha256: v.string() })), record.artifacts);
  const names = linuxReleaseBinaryNames(identity.tag);
  if (
    artifacts.length !== names.length ||
    new Set(artifacts.map((artifact) => artifact.name)).size !== names.length ||
    artifacts.some((artifact) => !names.includes(artifact.name))
  ) {
    fail(`${label} must name both unique canonical Linux release binaries`);
  }
  for (const artifact of artifacts) {
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || artifact.sha256 !== sha256Of(bytesOf(files, artifact.name))) {
      fail(`${label} hash does not match downloaded bytes for ${artifact.name}`);
    }
  }
};

const normalizeSignatureText = (text: string): string => text.replace(/\r\n/g, "\n").replace(/\n+$/, "");

const verifySignatureSidecar = (
  files: ReadonlyMap<string, Uint8Array>,
  assetName: string,
  signatureAssetName: string,
  publicKey: string,
): string => {
  const signature = textOf(files, signatureAssetName);
  verifyMinisignSignature(bytesOf(files, assetName), signature, publicKey);
  return signature;
};

const verifyManifestTarget = (
  platforms: Record<string, unknown>,
  key: string,
  assetUrl: string,
  verifiedSignature: string,
): void => {
  const entry = recordOf(platforms[key], `latest.json.platforms.${key}`);
  const signature = stringAt(entry, "signature", `latest.json.platforms.${key}`);
  if (stringAt(entry, "url", `latest.json.platforms.${key}`) !== assetUrl) {
    fail(`latest.json platform ${key} points to the wrong release asset`);
  }
  if (normalizeSignatureText(signature) !== normalizeSignatureText(verifiedSignature)) {
    fail(`latest.json platform ${key} signature does not match its release sidecar`);
  }
};

const verifyReleaseArtifacts = (
  input: Pick<ReleaseVerificationInput, "files" | "identity" | "release" | "updaterPublicKey"> & {
    runEvent: string;
    runUrl: string;
  },
): { assetCount: number; signatureCount: number; version: string } => {
  const { files, identity, release, updaterPublicKey } = input;
  const version = releaseVersion(identity.tag);
  if (
    release.tagName !== identity.tag ||
    !release.isDraft ||
    release.isPrerelease !== version.split("+")[0].includes("-")
  ) {
    fail(`release ${identity.tag} does not match the expected draft tag policy`);
  }
  const assets = validateReleaseAssets(release, identity.tag);
  const expectedNames = validateReleaseAssetInventory(identity.tag, [...files.keys()]);
  const downloadedNames = new Set(expectedNames);
  if (assets.size !== downloadedNames.size || [...assets.keys()].some((name) => !downloadedNames.has(name))) {
    fail("GitHub asset metadata and downloaded filenames do not match exactly");
  }
  const linuxNames = optionalLinuxReleaseAssetNames(identity.tag);
  if (assets.has(linuxNames[0]) && input.runEvent !== "workflow_dispatch") {
    fail("optional Linux release assets require the selected workflow_dispatch build run");
  }
  for (const asset of assets.values()) {
    const bytes = bytesOf(files, asset.name);
    if (bytes.byteLength !== asset.size || sha256Of(bytes) !== asset.digest.slice("sha256:".length).toLowerCase()) {
      fail(`downloaded bytes do not match GitHub digest and size for ${asset.name}`);
    }
  }

  if (assets.has(linuxNames[0])) {
    verifyLinuxProvenance(files, identity, release, input.runUrl, input.runEvent);
  }

  const macArtifactName = "Ultra RSS Reader.app.tar.gz";
  const windowsArtifactName = `Ultra RSS Reader_${version}_x64-setup.exe`;
  const macProvenance = verifyProvenance(
    files,
    identity,
    version,
    "darwin-aarch64",
    "Ultra.RSS.Reader_aarch64.app.tar.gz",
    macArtifactName,
    `${macArtifactName}.sha256`,
    release.url,
    input.runUrl,
    input.runEvent,
  );
  const windowsProvenance = verifyProvenance(
    files,
    identity,
    version,
    "windows-x86_64",
    `Ultra.RSS.Reader_${version}_x64-setup.exe`,
    windowsArtifactName,
    `${windowsArtifactName}.sha256`,
    release.url,
    input.runUrl,
    input.runEvent,
  );
  assertChecksum(files, "Ultra.RSS.Reader.app.tar.gz.sha256", macArtifactName, macProvenance);
  assertChecksum(files, `Ultra.RSS.Reader_${version}_x64-setup.exe.sha256`, windowsArtifactName, windowsProvenance);

  const latest = parseJsonRecord(bytesOf(files, "latest.json"), "latest.json");
  if (latest.version !== version) {
    fail("latest.json version does not match the release tag");
  }
  const platforms = recordOf(latest.platforms, "latest.json.platforms");
  const expectedKeys = ["darwin-aarch64", "windows-x86_64"];
  const aliasKeys = [...expectedKeys, "darwin-aarch64-app", "windows-x86_64-msi", "windows-x86_64-nsis"];
  const actualKeys = Object.keys(platforms).sort();
  if (![expectedKeys.sort().join(","), aliasKeys.sort().join(",")].includes(actualKeys.join(","))) {
    fail("latest.json must use a supported canonical or compatibility-alias platform set");
  }
  const macAsset = requiredAsset(assets, "Ultra.RSS.Reader_aarch64.app.tar.gz");
  const msiAsset = requiredAsset(assets, `Ultra.RSS.Reader_${version}_x64_en-US.msi`);
  const nsisAsset = requiredAsset(assets, `Ultra.RSS.Reader_${version}_x64-setup.exe`);
  const macSignature = "Ultra.RSS.Reader_aarch64.app.tar.gz.sig";
  const msiSignature = `Ultra.RSS.Reader_${version}_x64_en-US.msi.sig`;
  const nsisSignature = `Ultra.RSS.Reader_${version}_x64-setup.exe.sig`;
  const publicKey = updaterPublicKey;
  const macSignatureText = verifySignatureSidecar(files, macAsset.name, macSignature, publicKey);
  const msiSignatureText = verifySignatureSidecar(files, msiAsset.name, msiSignature, publicKey);
  const nsisSignatureText = verifySignatureSidecar(files, nsisAsset.name, nsisSignature, publicKey);
  const macDownloadUrl = publicAssetUrl(release, identity.tag, macAsset);
  const msiDownloadUrl = publicAssetUrl(release, identity.tag, msiAsset);
  const nsisDownloadUrl = publicAssetUrl(release, identity.tag, nsisAsset);
  verifyManifestTarget(platforms, "darwin-aarch64", macDownloadUrl, macSignatureText);
  verifyManifestTarget(platforms, "windows-x86_64", msiDownloadUrl, msiSignatureText);
  const aliasSet = actualKeys.length === 5;
  if (aliasSet) {
    verifyManifestTarget(platforms, "darwin-aarch64-app", macDownloadUrl, macSignatureText);
    verifyManifestTarget(platforms, "windows-x86_64-msi", msiDownloadUrl, msiSignatureText);
    verifyManifestTarget(platforms, "windows-x86_64-nsis", nsisDownloadUrl, nsisSignatureText);
  }
  return { assetCount: expectedNames.length, signatureCount: 3, version };
};

export const verifyReleaseEvidence = (
  input: ReleaseVerificationInput,
): { assetCount: number; signatureCount: number; version: string } => {
  verifyReleaseIdentity(input.identity, input.tagTargetSha, input.release, input.run);
  return verifyReleaseArtifacts({
    files: input.files,
    identity: input.identity,
    release: input.release,
    runEvent: input.run.event,
    runUrl: input.run.url,
    updaterPublicKey: input.updaterPublicKey,
  });
};
