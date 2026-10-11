import { Result } from "@praha/byethrow";
import { verifyReleaseEvidence, verifyReleaseIdentity } from "./release-verification.ts";
import {
  type DraftVerificationArguments,
  parseDraftVerificationArguments,
  parseRun,
  remoteTagTarget,
  resolveDraftReleaseFromResponse,
  updaterKeyAtSourceFromConfig,
} from "./release-verification-helpers.ts";
import {
  createOutputRoot,
  downloadFiles,
  downloadRelease,
  ghJson,
  gitShow,
  resolveOutputRoot,
} from "./release-verification-io.ts";

type DraftVerificationStage =
  | "arguments"
  | "output path"
  | "GitHub metadata"
  | "release identity"
  | "source updater key"
  | "download"
  | "artifact verification";

export class DraftVerificationStageError extends Error {
  readonly stage: DraftVerificationStage;

  constructor(stage: DraftVerificationStage, cause: unknown) {
    super(cause instanceof Error ? cause.message : "draft release verification failed", { cause });
    this.stage = stage;
    this.name = "DraftVerificationStageError";
  }
}

export type DraftVerificationDependencies = {
  requestJson: (args: readonly string[]) => unknown;
  readGitShow: (args: readonly string[]) => string;
  resolveOutputRoot: (requestedRoot: string) => string;
  createOutputRoot: (requestedRoot: string) => string;
  downloadRelease: (tag: string, outputRoot: string) => void;
  downloadFiles: (outputRoot: string, tag: string) => Map<string, Uint8Array>;
};

export type DraftVerificationSuccess = {
  args: DraftVerificationArguments;
  verification: ReturnType<typeof verifyReleaseEvidence>;
};

const productionDependencies: DraftVerificationDependencies = {
  requestJson: ghJson,
  readGitShow: gitShow,
  resolveOutputRoot,
  createOutputRoot,
  downloadRelease,
  downloadFiles,
};

const captureStage = <T>(
  stage: DraftVerificationStage,
  operation: () => T,
): Result.Result<T, DraftVerificationStageError> =>
  Result.try({
    try: operation,
    catch: (cause) => new DraftVerificationStageError(stage, cause),
  });

type ReleaseMetadata = {
  args: DraftVerificationArguments;
  outputRoot: string;
  identity: { attempt: number; runId: string; sourceSha: string; tag: string };
  release: ReturnType<typeof resolveDraftReleaseFromResponse>;
  run: ReturnType<typeof parseRun>;
  tagTargetSha: string;
};

const loadReleaseMetadata = (
  args: DraftVerificationArguments,
  dependencies: DraftVerificationDependencies,
): Result.Result<ReleaseMetadata, DraftVerificationStageError> =>
  Result.pipe(
    captureStage("output path", () => dependencies.resolveOutputRoot(args.outputRoot)),
    Result.andThen((outputRoot) =>
      captureStage("GitHub metadata", () => {
        const release = resolveDraftReleaseFromResponse(args.tag, dependencies.requestJson);
        const run = parseRun(
          dependencies.requestJson([
            "run",
            "view",
            args.runId,
            "--attempt",
            String(args.attempt),
            "--json",
            "attempt,conclusion,databaseId,event,headBranch,headSha,status,url,workflowName",
          ]),
        );
        const tagTargetSha = remoteTagTarget(args.tag, dependencies.requestJson);
        return {
          args,
          outputRoot,
          identity: { attempt: args.attempt, runId: args.runId, sourceSha: args.sourceSha, tag: args.tag },
          release,
          run,
          tagTargetSha,
        };
      }),
    ),
  );

const verifyMetadataAndArtifacts = (
  metadata: ReleaseMetadata,
  dependencies: DraftVerificationDependencies,
): Result.Result<DraftVerificationSuccess, DraftVerificationStageError> =>
  Result.pipe(
    captureStage("release identity", () => {
      verifyReleaseIdentity(metadata.identity, metadata.tagTargetSha, metadata.release, metadata.run);
      return metadata;
    }),
    Result.andThen((verifiedMetadata) =>
      captureStage("source updater key", () => ({
        ...verifiedMetadata,
        updaterPublicKey: updaterKeyAtSourceFromConfig(verifiedMetadata.args.sourceSha, dependencies.readGitShow),
      })),
    ),
    Result.andThen((verifiedSource) =>
      captureStage("download", () => {
        const downloadRoot = dependencies.createOutputRoot(verifiedSource.outputRoot);
        dependencies.downloadRelease(verifiedSource.args.tag, downloadRoot);
        const files = dependencies.downloadFiles(downloadRoot, verifiedSource.args.tag);
        return { ...verifiedSource, files };
      }),
    ),
    Result.andThen((downloaded) =>
      captureStage("artifact verification", () => ({
        args: downloaded.args,
        verification: verifyReleaseEvidence({
          files: downloaded.files,
          identity: downloaded.identity,
          release: downloaded.release,
          run: downloaded.run,
          tagTargetSha: downloaded.tagTargetSha,
          updaterPublicKey: downloaded.updaterPublicKey,
        }),
      })),
    ),
  );

export const runDraftReleaseVerificationWorkflow = (
  argv: readonly string[],
  dependencies: DraftVerificationDependencies = productionDependencies,
): Result.Result<DraftVerificationSuccess, DraftVerificationStageError> =>
  Result.pipe(
    captureStage("arguments", () => parseDraftVerificationArguments(argv)),
    Result.andThen((args) => loadReleaseMetadata(args, dependencies)),
    Result.andThen((metadata) => verifyMetadataAndArtifacts(metadata, dependencies)),
  );
