import { pathToFileURL } from "node:url";
import { run } from "./workflows/bump-version.ts";

export { run, writeChanges } from "./workflows/bump-version.ts";

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  try {
    for (const line of run(process.argv.slice(2))) {
      console.log(line);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
