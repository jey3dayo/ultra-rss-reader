import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateStaticAssetContract } from "./lib/artifact-contract.ts";
import { productionArtifactWorkflowIO, runArtifactWorkflow } from "./workflows/artifacts.ts";

export { RELEASE_UPDATER_ASSET_CONTRACT, UNSUPPORTED_UPDATER_PLATFORM_KEYS } from "./lib/artifact-contract.ts";
export { buildReleaseProvenanceRecord, ReleaseProvenanceError } from "./lib/release-provenance.ts";

const fail = (message: string): never => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const main = async (): Promise<void> => {
  const command = process.argv[2];
  if (command === "--help" || command === "help") {
    const { printDraftReleaseVerificationHelp } = await import("./release-verification-cli.ts");
    printDraftReleaseVerificationHelp();
    return;
  }
  validateStaticAssetContract();

  if (command === "verify-draft-release") {
    try {
      const { runDraftReleaseVerification } = await import("./release-verification-cli.ts");
      runDraftReleaseVerification(process.argv.slice(3));
    } catch (error) {
      fail(error instanceof Error ? error.message : "draft release verification failed");
    }
    return;
  }

  runArtifactWorkflow(command, process.env, productionArtifactWorkflowIO);
};

const isMainModule =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (isMainModule) {
  void main().catch((error: unknown) =>
    fail(error instanceof Error ? error.message : "release artifacts command failed"),
  );
}
