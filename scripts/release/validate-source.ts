import { pathToFileURL } from "node:url";
import { ReleaseSourceValidationError } from "./lib/release-source-policy.ts";
import { runReleaseSourceValidationWorkflow } from "./workflows/validate-source.ts";

export const validateReleaseSource = (): void => {
  runReleaseSourceValidationWorkflow(process.env);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateReleaseSource();
  } catch (error) {
    console.error(error instanceof ReleaseSourceValidationError ? `::error::${error.message}` : error);
    process.exitCode = 1;
  }
}
