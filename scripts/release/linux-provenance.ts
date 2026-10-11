import { runLinuxProvenanceCli } from "./lib/linux-release-provenance-cli.ts";

try {
  runLinuxProvenanceCli(process.argv.slice(2));
} catch (error) {
  console.error(`::error::${error instanceof Error ? error.message : "Linux provenance failed"}`);
  process.exitCode = 1;
}
