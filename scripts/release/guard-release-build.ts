import { pathToFileURL } from "node:url";
import { runReleaseBuildGuardWorkflow } from "./workflows/guard-release-build.ts";

export { requireBuildSlot } from "./lib/release-start-policy.ts";

export const guardReleaseBuild = async (): Promise<void> => {
  await runReleaseBuildGuardWorkflow(process.env);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  guardReleaseBuild().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
