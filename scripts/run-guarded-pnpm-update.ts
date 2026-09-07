import { spawnSync } from "node:child_process";

/**
 * Runs the dependency update step of `deps:update` so the release-age gate can only fail, never be
 * waived interactively.
 *
 * `minimumReleaseAgeStrict: true` does not abort unconditionally. Measured against pnpm 11.26.0 in
 * a disposable scratch project, an exact request for an immature version behaves as follows:
 *
 * | stdin        | CI env | prompt | exit | effect                                                |
 * | ------------ | ------ | ------ | ---- | ----------------------------------------------------- |
 * | not a TTY    | unset  | no     | 1    | ERR_PNPM_NO_MATURE_MATCHING_VERSION                   |
 * | TTY, `N`     | unset  | yes    | 1    | ERR_PNPM_MINIMUM_RELEASE_AGE_DENIED                   |
 * | TTY, `y`     | unset  | yes    | 0    | writes the version to minimumReleaseAgeExclude        |
 * | TTY          | `true` | no     | 1    | ERR_PNPM_NO_MATURE_MATCHING_VERSION                   |
 *
 * The `y` row is the problem: approving turns a gate failure into a config change with no reason,
 * owner, or date, and the rest of the task then passes over it. So this runner forces the two
 * conditions that remove the prompt entirely, and propagates pnpm's exit code unchanged.
 *
 * Scope is deliberately narrow. `CI` is set on this child process only, never exported to the
 * `mise run ci` step that follows, because that step should keep its normal local semantics.
 * Auto-answering the prompt (`--yes` and friends) is not an alternative: it approves the bypass
 * instead of preventing it.
 *
 * A legitimate exception is still possible, but it goes through review: add the exact
 * package@version to `minimumReleaseAgeExclude` in a commit that records the reason, owner, date,
 * and expiry, and have someone else review it. This runner does not decide that; it only stops the
 * exception from being written as a side effect of running an update.
 */
const result = spawnSync("pnpm", ["update", "--include-github-actions"], {
  env: { ...process.env, CI: "true" },
  // Detach stdin so pnpm cannot see a TTY even when the task is launched from an interactive
  // terminal. Both this and CI are needed: CI alone is an env var a caller can drop, and a
  // non-TTY stdin alone is what a normal terminal invocation does not give us.
  stdio: ["ignore", "inherit", "inherit"],
});

if (result.error) {
  console.error(`Failed to run pnpm update: ${result.error.message}`);
  process.exit(1);
}

if (result.signal !== null) {
  console.error(`pnpm update terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
