import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import * as v from "valibot";
import { decodeConfiguredUpdaterPublicKey } from "./minisign-verification.ts";
import { expectedReleaseAssetNames } from "./release-artifact-contract.ts";
import {
  type ReleaseVerificationRelease,
  type ReleaseVerificationRun,
  verifyReleaseEvidence,
  verifyReleaseIdentity,
} from "./release-verification.ts";

type DraftVerificationArguments = {
  attempt: number;
  outputRoot: string;
  runId: string;
  sourceSha: string;
  tag: string;
};

const parseArguments = (args: readonly string[]): DraftVerificationArguments => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--") || values.has(key)) {
      throw new Error("expected each verification option once with a value");
    }
    values.set(key, value);
  }
  const required = (key: string): string =>
    values.get(key) ??
    (() => {
      throw new Error(`missing ${key}`);
    })();
  const allowed = ["--expected-tag", "--source-sha", "--run-id", "--attempt", "--output-root"];
  if ([...values.keys()].some((key) => !allowed.includes(key))) {
    throw new Error("unknown draft verification option");
  }
  const tag = required("--expected-tag");
  const sourceSha = required("--source-sha");
  const runId = required("--run-id");
  const attemptText = required("--attempt");
  const outputRoot = required("--output-root");
  const attempt = Number(attemptText);
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error("expected-tag must be a version tag such as v1.2.3");
  }
  expectedReleaseAssetNames(tag);
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error("source-sha must be a full lowercase commit SHA");
  }
  if (!/^\d+$/.test(runId) || !Number.isSafeInteger(attempt) || attempt < 1 || String(attempt) !== attemptText) {
    throw new Error("run-id and attempt must be positive integers");
  }
  if (!outputRoot.trim()) {
    throw new Error("output-root must be explicit");
  }
  return { attempt, outputRoot, runId, sourceSha, tag };
};

const ghOutput = (args: readonly string[]): string => {
  const result = spawnSync("gh", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.error || result.status !== 0) {
    throw new Error(`gh ${args[0] ?? "command"} failed (exit ${result.status ?? "unavailable"})`);
  }
  return result.stdout ?? "";
};

const ghJson = (args: readonly string[]): unknown => {
  try {
    return JSON.parse(ghOutput(args));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("gh ")) {
      throw error;
    }
    throw new Error(`gh ${args[0] ?? "command"} returned invalid JSON`);
  }
};

const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const releaseApiSchema = v.object({
  assets: v.array(
    v.object({
      browser_download_url: v.string(),
      digest: v.string(),
      name: v.string(),
      size: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
    }),
  ),
  draft: v.boolean(),
  html_url: v.string(),
  id: positiveInteger,
  prerelease: v.boolean(),
  tag_name: v.string(),
});
const releaseViewSchema = v.object({
  databaseId: positiveInteger,
  isDraft: v.boolean(),
  isPrerelease: v.boolean(),
  tagName: v.string(),
  url: v.string(),
});
const runSchema = v.object({
  attempt: positiveInteger,
  conclusion: v.string(),
  databaseId: positiveInteger,
  event: v.string(),
  headBranch: v.string(),
  headSha: v.string(),
  status: v.string(),
  url: v.string(),
  workflowName: v.string(),
});

const parseRelease = (value: unknown): { id: number; release: ReleaseVerificationRelease } => {
  const parsed = v.parse(releaseApiSchema, value);
  return {
    id: parsed.id,
    release: {
      assets: parsed.assets.map((asset) => ({
        browserDownloadUrl: asset.browser_download_url,
        digest: asset.digest,
        name: asset.name,
        size: asset.size,
      })),
      id: parsed.id,
      isDraft: parsed.draft,
      isPrerelease: parsed.prerelease,
      tagName: parsed.tag_name,
      url: parsed.html_url,
    },
  };
};

const parseReleaseView = (
  value: unknown,
  expectedTag: string,
): { databaseId: number; isPrerelease: boolean; url: string } => {
  const release = v.parse(releaseViewSchema, value);
  if (release.tagName !== expectedTag || !release.isDraft) {
    throw new Error(`GitHub release ${expectedTag} is missing or is not a draft`);
  }
  return release;
};

export const resolveDraftRelease = (
  tag: string,
  requestJson: (args: readonly string[]) => unknown = ghJson,
): ReleaseVerificationRelease => {
  const view = parseReleaseView(
    requestJson(["release", "view", tag, "--json", "databaseId,isDraft,isPrerelease,tagName,url"]),
    tag,
  );
  const { id, release } = parseRelease(requestJson(["api", `repos/{owner}/{repo}/releases/${view.databaseId}`]));
  if (id !== view.databaseId) {
    throw new Error("GitHub release API id changed during draft verification");
  }
  if (
    release.tagName !== tag ||
    !release.isDraft ||
    release.isPrerelease !== view.isPrerelease ||
    release.url !== view.url
  ) {
    throw new Error(`GitHub release ${tag} changed during draft verification`);
  }
  return release;
};

const parseRun = (value: unknown): ReleaseVerificationRun => {
  return v.parse(runSchema, value);
};

const remoteTagTarget = (tag: string): string => {
  const ref = v.parse(
    v.object({ object: v.object({ sha: v.string(), type: v.string() }) }),
    ghJson(["api", `repos/{owner}/{repo}/git/ref/tags/${tag}`]),
  );
  const refObject = ref.object;
  if (refObject.type !== "tag") {
    throw new Error(`GitHub tag ${tag} is not annotated`);
  }
  const tagObjectSha = refObject.sha;
  const tagObject = v.parse(
    v.object({ tag: v.string(), object: v.object({ sha: v.string(), type: v.string() }) }),
    ghJson(["api", `repos/{owner}/{repo}/git/tags/${tagObjectSha}`]),
  );
  const target = tagObject.object;
  if (tagObject.tag !== tag || target.type !== "commit") {
    throw new Error(`GitHub annotated tag ${tag} does not point directly to a commit`);
  }
  return target.sha;
};

export const updaterKeyAtSource = (
  sourceSha: string,
  readGitShow: (args: readonly string[]) => string = gitShow,
): string => {
  const source = readGitShow(["show", `${sourceSha}:src-tauri/tauri.conf.json`]);
  const config: unknown = JSON.parse(source);
  const parsed = v.parse(v.object({ plugins: v.object({ updater: v.object({ pubkey: v.string() }) }) }), config);
  return decodeConfiguredUpdaterPublicKey(parsed.plugins.updater.pubkey);
};

const gitShow = (args: readonly string[]): string => {
  const result = spawnSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.error || result.status !== 0) {
    throw new Error("could not read the updater key from the expected source commit");
  }
  return result.stdout ?? "";
};

export const resolveOutputRoot = (requestedRoot: string, workingDirectory = process.cwd()): string => {
  const repositoryRoot = realpathSync(workingDirectory);
  const outputRoot = path.resolve(repositoryRoot, requestedRoot);
  const relativeOutput = path.relative(path.join(repositoryRoot, "tmp"), outputRoot);
  if (
    !relativeOutput ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeOutput)
  ) {
    throw new Error("output-root must be a new child directory under the repository tmp directory");
  }
  let cursor = repositoryRoot;
  for (const segment of path.relative(repositoryRoot, outputRoot).split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error("output-root cannot pass through a symbolic link");
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
  if (existsSync(outputRoot)) {
    throw new Error(`output-root already exists: ${outputRoot}`);
  }
  return outputRoot;
};

export const createOutputRoot = (requestedRoot: string, workingDirectory = process.cwd()): string => {
  const repositoryRoot = realpathSync(workingDirectory);
  const preflight = resolveOutputRoot(requestedRoot, repositoryRoot);
  let cursor = repositoryRoot;
  for (const segment of path.relative(repositoryRoot, path.dirname(preflight)).split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const status = lstatSync(cursor);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error("output-root ancestors must be real directories");
      }
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      mkdirSync(cursor);
      const created = lstatSync(cursor);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new Error("output-root ancestors must be real directories");
      }
    }
  }
  const verified = resolveOutputRoot(preflight, repositoryRoot);
  mkdirSync(verified);
  return verified;
};

const downloadFiles = (outputRoot: string, tag: string): Map<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isFile()) {
      throw new Error(`download output contains a non-file entry ${entry.name}`);
    }
    files.set(entry.name, readFileSync(path.join(outputRoot, entry.name)));
  }
  const expected = expectedReleaseAssetNames(tag);
  if (files.size !== expected.length || expected.some((name) => !files.has(name))) {
    throw new Error("downloaded release files do not match the exact expected asset inventory");
  }
  return files;
};

export const runDraftReleaseVerification = (argv: readonly string[]): void => {
  const args = parseArguments(argv);
  const outputRoot = resolveOutputRoot(args.outputRoot);
  const identity = { attempt: args.attempt, runId: args.runId, sourceSha: args.sourceSha, tag: args.tag };
  const release = resolveDraftRelease(args.tag);
  const run = parseRun(
    ghJson([
      "run",
      "view",
      args.runId,
      "--attempt",
      String(args.attempt),
      "--json",
      "attempt,conclusion,databaseId,event,headBranch,headSha,status,url,workflowName",
    ]),
  );
  const tagTargetSha = remoteTagTarget(args.tag);
  verifyReleaseIdentity(identity, tagTargetSha, release, run);
  const updaterPublicKey = updaterKeyAtSource(args.sourceSha);
  const downloadRoot = createOutputRoot(outputRoot);
  const download = spawnSync("gh", ["release", "download", args.tag, "--dir", downloadRoot], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (download.error || download.status !== 0) {
    throw new Error(`gh release download failed (exit ${download.status ?? "unavailable"})`);
  }

  const result = verifyReleaseEvidence({
    files: downloadFiles(downloadRoot, args.tag),
    identity,
    release,
    run,
    tagTargetSha,
    updaterPublicKey,
  });
  console.log(
    `verified draft release tag=${args.tag} source=${args.sourceSha} run=${args.runId} attempt=${args.attempt} assets=${result.assetCount} updater_signatures=${result.signatureCount}`,
  );
};

export const printDraftReleaseVerificationHelp = (): void => {
  console.log(
    [
      "Usage: node scripts/release/artifacts.ts verify-draft-release --expected-tag <vX.Y.Z> --source-sha <sha> --run-id <id> --attempt <n> --output-root tmp/release-verification/<unique-dir>",
      "Read-only: checks the remote annotated tag, exact successful Release run attempt, draft inventory and GitHub digests; downloads assets only into the new output-root and verifies updater signatures, checksums, manifest aliases and provenance.",
      "The output-root must be a new child directory under repository tmp. GitHub CLI authentication comes from the existing gh configuration.",
    ].join("\n"),
  );
};
