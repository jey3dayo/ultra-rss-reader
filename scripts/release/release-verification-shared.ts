import * as v from "valibot";

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

export const fail = (message: string): never => {
  throw new Error(message);
};

export const recordSchema = v.record(v.string(), v.unknown());

export const recordOf = (value: unknown, label: string): Record<string, unknown> => {
  if (!v.is(recordSchema, value)) {
    return fail(`${label} must be an object`);
  }
  return value;
};

export const stringAt = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  return typeof value === "string" ? value : fail(`${label}.${key} must be a string`);
};

export const publicUrl = (value: string, label: string): URL => {
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

export const releaseRoute = (
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

export const publicAssetUrl = (
  release: ReleaseVerificationRelease,
  tag: string,
  asset: ReleaseVerificationAsset,
): string => {
  const route = releaseRoute(release, tag);
  const metadataUrl = publicUrl(asset.browserDownloadUrl, `release asset ${asset.name} URL`);
  const aliasPath = `${route.repositoryPath}/releases/download/${encodeURIComponent(route.slug)}/${encodeURIComponent(asset.name)}`;
  if (metadataUrl.origin !== route.origin || metadataUrl.pathname !== aliasPath) {
    fail(`release asset ${asset.name} URL does not match this draft release ID, tag, and filename`);
  }
  return `${route.origin}${route.repositoryPath}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
};

export const parseJsonRecord = (bytes: Uint8Array, label: string): Record<string, unknown> => {
  try {
    return recordOf(JSON.parse(Buffer.from(bytes).toString("utf8")), label);
  } catch {
    return fail(`${label} is not valid JSON`);
  }
};
