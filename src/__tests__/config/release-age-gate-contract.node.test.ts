import { describe, expect, it } from "vitest";
import miseSetupTasks from "../../../mise/setup.toml?raw";
import pnpmWorkspaceConfig from "../../../pnpm-workspace.yaml?raw";
import guardedPnpmUpdateRunner from "../../../scripts/run-guarded-pnpm-update.ts?raw";

/**
 * Pins the release-age gate so it cannot be weakened back into an advisory default.
 *
 * The gate has two halves and each half fails differently when removed. The config half decides
 * whether pnpm enforces the cooldown at all; the task half decides whether a human at a terminal
 * can waive it. `minimumReleaseAgeStrict: true` alone does not close the second one: measured
 * against pnpm 11.26.0, an exact request for an immature version prompts in a TTY and, once
 * approved, writes the version into `minimumReleaseAgeExclude` and continues with exit 0. The
 * written exception carries no reason, owner, or date, and the rest of `deps:update` accepts it.
 *
 * These assertions are structural. They cannot prove pnpm's runtime behaviour, only that the
 * repository still asks for the configuration and the invocation path that were verified.
 */
describe("release-age gate contract", () => {
  const depsUpdateTask = miseSetupTasks.slice(miseSetupTasks.indexOf('["deps:update"]'));

  it("configures the cooldown explicitly rather than relying on the built-in default", () => {
    // pnpm 11 ships minimumReleaseAge: 1440 already, but its built-in default is non-strict for
    // backward compatibility. Writing the same number by hand is what turns strict mode on.
    expect(pnpmWorkspaceConfig).toMatch(/^minimumReleaseAge: 1440$/m);
    expect(pnpmWorkspaceConfig).toMatch(/^minimumReleaseAgeStrict: true$/m);
    expect(pnpmWorkspaceConfig).toMatch(/^minimumReleaseAgeExcludePrune: true$/m);
  });

  it("keeps no blanket cooldown exceptions", () => {
    // A version-scoped entry added through review is fine; the list existing as a standing waiver
    // is what this pins against. Every entry the gate replaced had been appended automatically by
    // an ordinary dependency update, not agreed as a hotfix.
    expect(pnpmWorkspaceConfig).not.toMatch(/^minimumReleaseAgeExclude:/m);
  });

  it("routes the dependency update through the guarded runner instead of calling pnpm update directly", () => {
    expect(depsUpdateTask).toContain("node ./scripts/run-guarded-pnpm-update.ts");
    expect(depsUpdateTask).not.toMatch(/^pnpm update/m);
  });

  it("does not export CI to the whole update task", () => {
    // The runner sets CI on its own child only. Exporting it across the task would also change the
    // `mise run ci` step that follows, which should keep its normal local semantics.
    expect(depsUpdateTask).not.toContain("CI=true");
    expect(depsUpdateTask).toContain("mise run ci");
  });

  it("removes the approval prompt in the runner rather than answering it", () => {
    expect(guardedPnpmUpdateRunner).toContain('CI: "true"');
    // Ignoring stdin is the half that survives a caller who unsets CI.
    expect(guardedPnpmUpdateRunner).toMatch(/stdio:\s*\[\s*"ignore"/);
    // Auto-approving would write the exception instead of preventing it. Match the spawned
    // argument list rather than the file, so the doc comment can name the flags it rules out.
    const spawnedArguments = guardedPnpmUpdateRunner.match(/spawnSync\("pnpm",\s*(\[[^\]]*\])/)?.[1];
    expect(spawnedArguments).toBe('["update", "--include-github-actions"]');
  });

  it("propagates the update's exit code instead of masking it", () => {
    expect(guardedPnpmUpdateRunner).toContain("process.exit(result.status ?? 1)");
  });
});
