import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createOutputRoot,
  resolveDraftRelease,
  resolveOutputRoot,
  updaterKeyAtSource,
} from "../scripts/release/release-verification-cli.ts";

const TAG = "v0.66.0";
const SOURCE_SHA = "4a11ce85afec51ea8eda4f7f47b1c7b45ce25230";
const releaseId = 409523579;
const publicKeyText = "untrusted comment: tagged key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";

describe("release verification CLI transport", () => {
  it("resolves a draft by gh release view identity before reading REST digest metadata", () => {
    const calls: string[][] = [];
    const requestJson = (args: readonly string[]): unknown => {
      calls.push([...args]);
      if (args[0] === "release") {
        return {
          databaseId: releaseId,
          isDraft: true,
          isPrerelease: false,
          tagName: TAG,
          url: "https://github.com/example/release",
        };
      }
      return {
        assets: [
          {
            browser_download_url: "https://github.com/example/release/download/file",
            digest: `sha256:${"a".repeat(64)}`,
            name: "file",
            size: 4,
          },
        ],
        draft: true,
        html_url: "https://github.com/example/release",
        id: releaseId,
        prerelease: false,
        tag_name: TAG,
      };
    };

    const release = resolveDraftRelease(TAG, requestJson);
    expect(release.id).toBe(releaseId);
    expect(release.assets[0]?.digest).toBe(`sha256:${"a".repeat(64)}`);
    const releaseView = calls.find((args) => args[0] === "release" && args[1] === "view");
    expect(releaseView).toContain(TAG);
    const fields = new Set(releaseView?.find((arg) => arg.includes("databaseId"))?.split(","));
    expect(fields).toEqual(new Set(["databaseId", "isDraft", "isPrerelease", "tagName", "url"]));
    expect(calls.some((args) => args.includes(`repos/{owner}/{repo}/releases/${releaseId}`))).toBe(true);
  });

  it("reads the updater key from the expected source commit", () => {
    const encodedKey = Buffer.from(`${publicKeyText}\n`).toString("base64");
    const taggedConfig = JSON.stringify({ plugins: { updater: { pubkey: encodedKey } } });
    const calls: string[][] = [];
    const key = updaterKeyAtSource(SOURCE_SHA, (args) => {
      calls.push([...args]);
      return taggedConfig;
    });
    expect(key).toBe(publicKeyText);
    expect(calls).toContainEqual(["show", `${SOURCE_SHA}:src-tauri/tauri.conf.json`]);
  });

  it("keeps download output under repository tmp and rejects symlink escapes or existing paths", () => {
    const temporaryRoot = path.resolve("tmp/release-cli-refactor");
    mkdirSync(temporaryRoot, { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(temporaryRoot, "release-verification-cli-"));
    const repositoryRoot = path.join(fixtureRoot, "repo");
    const repoTmp = path.join(repositoryRoot, "tmp");
    const outsideRoot = path.join(fixtureRoot, "outside");
    mkdirSync(repoTmp, { recursive: true });
    mkdirSync(outsideRoot);
    try {
      const output = createOutputRoot("tmp/release-verification/result", repositoryRoot);
      expect(output).toBe(path.join(repoTmp, "release-verification/result"));
      expect(() => resolveOutputRoot(path.join(outsideRoot, "result"), repositoryRoot)).toThrow("repository tmp");
      mkdirSync(path.join(repoTmp, "existing"));
      expect(() => resolveOutputRoot("tmp/existing", repositoryRoot)).toThrow("already exists");

      const preflightOutput = resolveOutputRoot("tmp/contested/result", repositoryRoot);
      mkdirSync(path.dirname(preflightOutput), { recursive: true });
      mkdirSync(preflightOutput);
      expect(() => createOutputRoot(preflightOutput, repositoryRoot)).toThrow("already exists");

      const symlinkOutput = resolveOutputRoot("tmp/linked/result", repositoryRoot);
      symlinkSync(outsideRoot, path.join(repoTmp, "linked"), process.platform === "win32" ? "junction" : "dir");
      expect(() => createOutputRoot(symlinkOutput, repositoryRoot)).toThrow("symbolic link");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
