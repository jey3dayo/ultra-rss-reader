import * as v from "valibot";
import { decodeConfiguredUpdaterPublicKey } from "../minisign-verification.ts";
import { expectedReleaseAssetNames } from "../release-artifact-contract.ts";
import type { ReleaseVerificationRelease, ReleaseVerificationRun } from "../release-verification.ts";

export type DraftVerificationArguments = {
  attempt: number;
  outputRoot: string;
  runId: string;
  sourceSha: string;
  tag: string;
};

export const parseDraftVerificationArguments = (args: readonly string[]): DraftVerificationArguments => {
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
  jobs: v.optional(
    v.array(
      v.object({
        conclusion: v.string(),
        steps: v.array(v.object({ name: v.string(), conclusion: v.string() })),
      }),
    ),
  ),
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

export const parseRun = (value: unknown): ReleaseVerificationRun => v.parse(runSchema, value);

export const resolveDraftReleaseFromResponse = (
  tag: string,
  requestJson: (args: readonly string[]) => unknown,
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

export const remoteTagTarget = (tag: string, requestJson: (args: readonly string[]) => unknown): string => {
  const ref = v.parse(
    v.object({ object: v.object({ sha: v.string(), type: v.string() }) }),
    requestJson(["api", `repos/{owner}/{repo}/git/ref/tags/${tag}`]),
  );
  const refObject = ref.object;
  if (refObject.type !== "tag") {
    throw new Error(`GitHub tag ${tag} is not annotated`);
  }
  const tagObjectSha = refObject.sha;
  const tagObject = v.parse(
    v.object({ tag: v.string(), object: v.object({ sha: v.string(), type: v.string() }) }),
    requestJson(["api", `repos/{owner}/{repo}/git/tags/${tagObjectSha}`]),
  );
  const target = tagObject.object;
  if (tagObject.tag !== tag || target.type !== "commit") {
    throw new Error(`GitHub annotated tag ${tag} does not point directly to a commit`);
  }
  return target.sha;
};

export const updaterKeyAtSourceFromConfig = (
  sourceSha: string,
  readGitShow: (args: readonly string[]) => string,
): string => {
  const source = readGitShow(["show", `${sourceSha}:src-tauri/tauri.conf.json`]);
  const config: unknown = JSON.parse(source);
  const parsed = v.parse(v.object({ plugins: v.object({ updater: v.object({ pubkey: v.string() }) }) }), config);
  return decodeConfiguredUpdaterPublicKey(parsed.plugins.updater.pubkey);
};
