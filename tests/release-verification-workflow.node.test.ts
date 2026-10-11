import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  type DraftVerificationDependencies,
  type DraftVerificationStageError,
  type DraftVerificationSuccess,
  runDraftReleaseVerificationWorkflow,
} from "../scripts/release/release-verification-workflow.ts";
import {
  addOptionalLinuxReleaseAssets,
  createFixture,
  isRecord,
  refreshRelease,
  writeLatest,
} from "./helpers/release-verification-fixture.ts";

const argsFor = (fixture: ReturnType<typeof createFixture>): string[] => [
  "--expected-tag",
  fixture.identity.tag,
  "--source-sha",
  fixture.identity.sourceSha,
  "--run-id",
  fixture.identity.runId,
  "--attempt",
  String(fixture.identity.attempt),
  "--output-root",
  "tmp/release-verification-workflow/result",
];

const createDependencies = (fixture: ReturnType<typeof createFixture>) => {
  const runRequests: string[][] = [];
  const state = {
    createOutputRootCalls: 0,
    downloadCalls: 0,
    fileReads: 0,
    keyReads: 0,
    malformedReleaseView: false,
    failDownload: false,
    failRunRequest: false,
    malformedSourceKey: false,
    failSourceKeyRead: false,
    remoteTagTargetSha: fixture.identity.sourceSha,
    runRequests,
  };

  const requestJson: DraftVerificationDependencies["requestJson"] = (args) => {
    if (args[0] === "release" && args[1] === "view") {
      if (state.malformedReleaseView) {
        return { databaseId: "invalid" };
      }
      return {
        databaseId: fixture.release.id,
        isDraft: fixture.release.isDraft,
        isPrerelease: fixture.release.isPrerelease,
        tagName: fixture.release.tagName,
        url: fixture.release.url,
      };
    }
    if (args[0] === "api" && args[1]?.includes("/releases/")) {
      return {
        assets: fixture.release.assets.map((asset) => ({
          browser_download_url: asset.browserDownloadUrl,
          digest: asset.digest,
          name: asset.name,
          size: asset.size,
        })),
        draft: fixture.release.isDraft,
        html_url: fixture.release.url,
        id: fixture.release.id,
        prerelease: fixture.release.isPrerelease,
        tag_name: fixture.release.tagName,
      };
    }
    if (args[0] === "run") {
      runRequests.push([...args]);
      if (state.failRunRequest) {
        throw new Error("gh run view failed (exit 1)");
      }
      return fixture.run;
    }
    if (args[0] === "api" && args[1]?.includes("/git/ref/tags/")) {
      return { object: { sha: "annotated-tag-object", type: "tag" } };
    }
    if (args[0] === "api" && args[1]?.includes("/git/tags/")) {
      return {
        tag: fixture.identity.tag,
        object: { sha: state.remoteTagTargetSha, type: "commit" },
      };
    }
    throw new Error(`unexpected request ${args.join(" ")}`);
  };

  const dependencies: DraftVerificationDependencies = {
    requestJson,
    readGitShow: () => {
      state.keyReads += 1;
      if (state.failSourceKeyRead) {
        throw new Error("could not read the updater key from the expected source commit");
      }
      const encodedKey = Buffer.from(`${fixture.updaterPublicKey}\n`).toString("base64");
      const pubkey = state.malformedSourceKey ? "not a configured updater key" : encodedKey;
      return JSON.stringify({ plugins: { updater: { pubkey } } });
    },
    resolveOutputRoot: (requestedRoot) => `/repo/${requestedRoot}`,
    createOutputRoot: (requestedRoot) => {
      state.createOutputRootCalls += 1;
      return requestedRoot;
    },
    downloadRelease: () => {
      state.downloadCalls += 1;
      if (state.failDownload) {
        throw new Error("gh release download failed (exit 1)");
      }
    },
    downloadFiles: () => {
      state.fileReads += 1;
      return fixture.files;
    },
  };

  return { dependencies, state };
};

const unwrapFailure = (result: ReturnType<typeof runDraftReleaseVerificationWorkflow>): DraftVerificationStageError => {
  if (Result.isFailure(result)) {
    return Result.unwrapError(result);
  }
  throw new Error("expected workflow failure");
};

const unwrapSuccess = (result: ReturnType<typeof runDraftReleaseVerificationWorkflow>): DraftVerificationSuccess => {
  if (Result.isSuccess(result)) {
    return Result.unwrap(result);
  }
  throw new Error("expected workflow success");
};

describe("draft release verification workflow", () => {
  it("verifies signed release evidence through the complete workflow", () => {
    const fixture = createFixture();
    const { dependencies } = createDependencies(fixture);

    const result = runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies);

    expect(unwrapSuccess(result).verification).toEqual({ assetCount: 16, signatureCount: 3, version: "0.66.0" });
  });

  it("loads jobs from the selected run attempt and verifies the complete Linux family", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    const { dependencies, state } = createDependencies(fixture);
    expect(
      unwrapSuccess(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies)).verification.assetCount,
    ).toBe(19);
    const request = state.runRequests[0];
    expect(request?.slice(0, 5)).toEqual([
      "run",
      "view",
      fixture.identity.runId,
      "--attempt",
      String(fixture.identity.attempt),
    ]);
    expect(request?.[6].split(",")).toContain("jobs");
  });

  it("rejects skipped Linux generation before downloading fabricated matching Linux evidence", () => {
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    fixture.run = { ...fixture.run, jobs: [] };
    const { dependencies, state } = createDependencies(fixture);
    const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies));
    expect(failure.stage).toBe("release identity");
    expect(failure.message).toContain("successful Linux provenance generation step");
    expect(state.downloadCalls).toBe(0);
  });

  it("rejects malformed arguments before repository or release side effects", () => {
    const fixture = createFixture();
    const { dependencies, state } = createDependencies(fixture);
    const args = argsFor(fixture);
    args[7] = "01";

    const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(args, dependencies));

    expect(failure.stage).toBe("arguments");
    expect(failure.message).toBe("run-id and attempt must be positive integers");
    expect(state.createOutputRootCalls).toBe(0);
    expect(state.downloadCalls).toBe(0);
  });

  it("preserves transport and schema failures as staged errors", () => {
    const transportFixture = createFixture();
    const transport = createDependencies(transportFixture);
    transport.state.failRunRequest = true;
    const transportFailure = unwrapFailure(
      runDraftReleaseVerificationWorkflow(argsFor(transportFixture), transport.dependencies),
    );

    expect(transportFailure.stage).toBe("GitHub metadata");
    expect(transportFailure.message).toBe("gh run view failed (exit 1)");

    const schemaFixture = createFixture();
    const schema = createDependencies(schemaFixture);
    schema.state.malformedReleaseView = true;
    const schemaFailure = unwrapFailure(
      runDraftReleaseVerificationWorkflow(argsFor(schemaFixture), schema.dependencies),
    );

    expect(schemaFailure.stage).toBe("GitHub metadata");
    expect(schemaFailure.message).toContain("Invalid type");
    expect(schema.state.downloadCalls).toBe(0);
  });

  it("stops before creating or downloading when release identity does not match", () => {
    const fixture = createFixture();
    const { dependencies, state } = createDependencies(fixture);
    state.remoteTagTargetSha = "b".repeat(40);

    const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies));

    expect(failure.stage).toBe("release identity");
    expect(state.keyReads).toBe(0);
    expect(state.createOutputRootCalls).toBe(0);
    expect(state.downloadCalls).toBe(0);
  });

  it("stops before creating or downloading when the source updater key is invalid or unreadable", () => {
    for (const failureMode of ["malformed", "unreadable"] as const) {
      const fixture = createFixture();
      const { dependencies, state } = createDependencies(fixture);
      if (failureMode === "malformed") {
        state.malformedSourceKey = true;
      } else {
        state.failSourceKeyRead = true;
      }

      const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies));

      expect(failure.stage).toBe("source updater key");
      expect(state.createOutputRootCalls).toBe(0);
      expect(state.downloadCalls).toBe(0);
    }
  });

  it("stops before reading or verifying assets when download fails", () => {
    const fixture = createFixture();
    const { dependencies, state } = createDependencies(fixture);
    state.failDownload = true;

    const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies));

    expect(failure.stage).toBe("download");
    expect(failure.message).toBe("gh release download failed (exit 1)");
    expect(state.fileReads).toBe(0);
  });

  it("rejects a tampered downloaded signature through the release verifier", () => {
    const fixture = createFixture();
    const signatureName = "Ultra.RSS.Reader_aarch64.app.tar.gz.sig";
    fixture.files.set(signatureName, Buffer.from("malformed"));
    for (const key of ["darwin-aarch64", "darwin-aarch64-app"]) {
      const entry = fixture.manifestPlatforms[key];
      if (!isRecord(entry)) {
        throw new Error(`missing fixture manifest entry ${key}`);
      }
      entry.signature = "malformed";
    }
    writeLatest(fixture);
    refreshRelease(fixture);
    const { dependencies } = createDependencies(fixture);

    const failure = unwrapFailure(runDraftReleaseVerificationWorkflow(argsFor(fixture), dependencies));

    expect(failure.stage).toBe("artifact verification");
    expect(failure.message).toContain("canonical base64");
  });
});
