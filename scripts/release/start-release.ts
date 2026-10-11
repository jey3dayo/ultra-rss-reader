import { pathToFileURL } from "node:url";
import { runStartReleaseWorkflow } from "./workflows/start-release.ts";

export {
  extractReleaseNotes,
  requireAnnotatedTag,
  requireExpectedMain,
  requireSuccessfulCi,
  validateStartInputs,
} from "./lib/release-start-policy.ts";

export const startRelease = async (): Promise<void> => {
  await runStartReleaseWorkflow(process.env);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startRelease().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
