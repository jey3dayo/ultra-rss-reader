import { Result } from "@praha/byethrow";
import { resolveDraftReleaseFromResponse, updaterKeyAtSourceFromConfig } from "./lib/verification-helpers.ts";
import { createOutputRoot, ghJson, gitShow, resolveOutputRoot } from "./lib/verification-io.ts";
import type { ReleaseVerificationRelease } from "./release-verification.ts";
import { runDraftReleaseVerificationWorkflow } from "./workflows/verify-draft-release.ts";

export { createOutputRoot, resolveOutputRoot };

export const resolveDraftRelease = (
  tag: string,
  requestJson: (args: readonly string[]) => unknown = ghJson,
): ReleaseVerificationRelease => resolveDraftReleaseFromResponse(tag, requestJson);

export const updaterKeyAtSource = (
  sourceSha: string,
  readGitShow: (args: readonly string[]) => string = gitShow,
): string => updaterKeyAtSourceFromConfig(sourceSha, readGitShow);

export const runDraftReleaseVerification = (argv: readonly string[]): void => {
  const result = runDraftReleaseVerificationWorkflow(argv);
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }
  const { args, verification } = Result.unwrap(result);
  console.log(
    `verified draft release tag=${args.tag} source=${args.sourceSha} run=${args.runId} attempt=${args.attempt} assets=${verification.assetCount} updater_signatures=${verification.signatureCount}`,
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
