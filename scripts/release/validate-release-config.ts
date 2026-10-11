import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ReleaseConfigSources, validateReleaseConfigSources } from "./lib/config-validation.ts";

const readSources = (root: string): ReleaseConfigSources => ({
  packageJson: readFileSync(join(root, "package.json"), "utf8"),
  tauriConfig: readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  releaseTauriConfig: readFileSync(join(root, "src-tauri/tauri.release.conf.json"), "utf8"),
  devTauriConfig: readFileSync(join(root, "src-tauri/tauri.dev.conf.json"), "utf8"),
  defaultCapability: readFileSync(join(root, "src-tauri/capabilities/default.json"), "utf8"),
  cargoToml: readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8"),
  cargoLock: readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8"),
  releaseWorkflow: readFileSync(join(root, ".github/workflows/release.yml"), "utf8"),
  msixManifest: readFileSync(join(root, "msix/Package.appxmanifest"), "utf8"),
});

export const validateReleaseConfig = ({
  root,
  releaseTag,
}: {
  root: string;
  releaseTag: string | undefined;
}): string[] => validateReleaseConfigSources({ releaseTag, sources: readSources(root) });

const isMainModule =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (isMainModule) {
  const errors = validateReleaseConfig({ root: ".", releaseTag: process.env.RELEASE_TAG });
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`::error::${error}`);
    }
    process.exit(1);
  }
}
