import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLinuxReleaseProvenance } from "../scripts/release/lib/linux-release-provenance.ts";
import { runLinuxProvenanceCli } from "../scripts/release/lib/linux-release-provenance-cli.ts";
import { LINUX_PROVENANCE_ASSET_NAME } from "../scripts/release/release-artifact-contract.ts";
import { verifyReleaseEvidence } from "../scripts/release/release-verification.ts";
import {
  ATTEMPT,
  addOptionalLinuxReleaseAssets,
  createFixture,
  parseRecord,
  RELEASE_ID,
  RUN_ID,
  RUN_URL,
  refreshRelease,
  SOURCE_SHA,
  TAG,
  VERSION,
} from "./helpers/release-verification-fixture.ts";

const debPath = `/build/Ultra RSS Reader_${VERSION}_amd64.deb`;
const imagePath = `/build/Ultra RSS Reader_${VERSION}_amd64.AppImage`;
const uploadUrl = `https://uploads.github.com/repos/jey3dayo/ultra-rss-reader/releases/${RELEASE_ID}/assets?name=${LINUX_PROVENANCE_ASSET_NAME}`;
const releaseView = {
  id: RELEASE_ID,
  draft: true,
  tag_name: TAG,
  assets: [],
  upload_url: `${uploadUrl.split("?")[0]}{?name,label}`,
};
const proofPath = path.resolve("src-tauri/target/release-provenance", LINUX_PROVENANCE_ASSET_NAME);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const createProducerFixture = () => {
  const env = {
    RELEASE_TAG: TAG,
    LINUX_RELEASE_ID: String(RELEASE_ID),
    GITHUB_SHA: SOURCE_SHA,
    GITHUB_RUN_ID: RUN_ID,
    GITHUB_RUN_ATTEMPT: String(ATTEMPT),
    GITHUB_REPOSITORY: "jey3dayo/ultra-rss-reader",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_WORKFLOW: "Release",
    GITHUB_REF: `refs/tags/${TAG}`,
    GITHUB_REF_NAME: TAG,
    RUNNER_OS: "Linux",
    LINUX_ARTIFACT_PATHS: JSON.stringify([debPath, imagePath]),
  };
  const files = new Map<string, Uint8Array>([
    [debPath, Buffer.from("deb bytes")],
    [imagePath, Buffer.from("AppImage bytes")],
  ]);
  const ghCalls: string[][] = [];
  const io = {
    git: (args: readonly string[]) => (args[0] === "cat-file" ? "tag" : SOURCE_SHA),
    readFile: (filePath: string): Uint8Array => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error("could not read fixture file");
      }
      return bytes;
    },
    resolveArtifact: (filePath: string) => filePath,
    writeProof: (filePath: string, contents: string) => {
      files.set(filePath, Buffer.from(contents));
    },
    gh: (args: readonly string[]): string => {
      ghCalls.push([...args]);
      return JSON.stringify(releaseView);
    },
  };
  return { env, files, ghCalls, io };
};

describe("Linux release provenance producer", () => {
  it("records actual binary hashes with canonical GitHub names and the original build identity", () => {
    const { env, files, io } = createProducerFixture();
    const proof = buildLinuxReleaseProvenance(env, io);
    expect(proof).toMatchObject({
      packageVersion: VERSION,
      releaseTag: TAG,
      releaseId: RELEASE_ID,
      source: { commitSha: SOURCE_SHA, tagTargetSha: SOURCE_SHA },
      runner: { os: "Linux", assetPlatform: "linux-x86_64", matrixPlatform: "ubuntu-24.04" },
      workflow: {
        eventName: "workflow_dispatch",
        ref: `refs/tags/${TAG}`,
        refName: TAG,
        runAttempt: String(ATTEMPT),
        runId: RUN_ID,
        runUrl: RUN_URL,
      },
    });
    expect(proof.artifacts).toEqual(
      [debPath, imagePath].map((filePath) => ({
        name: path.basename(filePath).replaceAll(" ", "."),
        sha256: sha256(io.readFile(filePath)),
      })),
    );
    expect(files.has(proofPath)).toBe(false);
  });

  it("produces the Linux proof consumed by the complete 19-asset verifier", () => {
    const { env, io } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const fixture = createFixture();
    addOptionalLinuxReleaseAssets(fixture);
    for (const filePath of [debPath, imagePath]) {
      fixture.files.set(path.basename(filePath).replaceAll(" ", "."), io.readFile(filePath));
    }
    fixture.files.set(LINUX_PROVENANCE_ASSET_NAME, io.readFile(proofPath));
    refreshRelease(fixture);
    expect(verifyReleaseEvidence({ ...fixture, tagTargetSha: SOURCE_SHA }).assetCount).toBe(19);
  });

  it("rejects wrong source, tag target, tag kind, workflow identity and artifact paths before producing", () => {
    for (const envChange of [
      { LINUX_RELEASE_ID: "" },
      { LINUX_RELEASE_ID: "0" },
      { LINUX_RELEASE_ID: "01" },
      { LINUX_RELEASE_ID: "9007199254740992" },
      { GITHUB_SHA: "b".repeat(40) },
      { GITHUB_REF: "refs/heads/main" },
      { GITHUB_REF_NAME: "main" },
      { GITHUB_EVENT_NAME: "push" },
      { GITHUB_RUN_ATTEMPT: "01" },
      { RUNNER_OS: "macOS" },
      { LINUX_ARTIFACT_PATHS: JSON.stringify([debPath]) },
      { LINUX_ARTIFACT_PATHS: JSON.stringify([debPath, debPath]) },
      { LINUX_ARTIFACT_PATHS: JSON.stringify([debPath, "/build/other.AppImage"]) },
    ]) {
      const { env, files, io, ghCalls } = createProducerFixture();
      expect(() => runLinuxProvenanceCli(["generate"], { ...env, ...envChange }, io)).toThrow();
      expect(files.has(proofPath)).toBe(false);
      expect(ghCalls).toEqual([]);
    }
    for (const failure of ["HEAD", `refs/tags/${TAG}^{commit}`, "tag kind"]) {
      const { env, files, io } = createProducerFixture();
      const git = (args: readonly string[]) => {
        if (failure === "tag kind" && args[0] === "cat-file") return "commit";
        if (args[1] === failure) return "b".repeat(40);
        return io.git(args);
      };
      expect(() => runLinuxProvenanceCli(["generate"], env, { ...io, git })).toThrow(
        "checkout and annotated tag target",
      );
      expect(files.has(proofPath)).toBe(false);
    }
  });

  it("rejects path aliases, duplicate canonical names, empty files and unreadable bytes", () => {
    const { env, files, io } = createProducerFixture();
    expect(() => buildLinuxReleaseProvenance(env, { ...io, resolveArtifact: () => debPath })).toThrow(
      "unique artifact paths",
    );
    expect(() =>
      buildLinuxReleaseProvenance(
        { ...env, LINUX_ARTIFACT_PATHS: JSON.stringify([debPath, `/other/${path.basename(debPath)}`]) },
        {
          ...io,
          readFile: () => Buffer.from("fixture"),
        },
      ),
    ).toThrow("both the .deb and AppImage");
    files.set(imagePath, Buffer.from(""));
    expect(() => buildLinuxReleaseProvenance(env, io)).toThrow("must not be empty");
    files.delete(imagePath);
    expect(() => buildLinuxReleaseProvenance(env, io)).toThrow("could not read fixture file");
  });

  it("uploads only the unchanged generated proof to its draft release and propagates transport failures", () => {
    const { env, files, ghCalls, io } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    runLinuxProvenanceCli(["upload"], env, io);
    expect(ghCalls).toContainEqual([
      "api",
      `repos/${env.GITHUB_REPOSITORY}/releases/${RELEASE_ID}`,
      "--hostname",
      "github.com",
      "--method",
      "GET",
    ]);
    const post = ghCalls.find((args) => args.includes("POST"));
    expect(post?.slice(0, 6)).toEqual(["api", uploadUrl, "--hostname", "github.com", "--method", "POST"]);
    expect(post).toContain(proofPath);
    expect(post).toContain("--input");
    expect(() =>
      runLinuxProvenanceCli(["upload"], env, { ...io, gh: () => JSON.stringify({ ...releaseView, draft: false }) }),
    ).toThrow("expected draft release");
    expect(() =>
      runLinuxProvenanceCli(["upload"], env, {
        ...io,
        gh: (args) => {
          if (args.includes("POST")) throw new Error("gh upload fixture failure");
          return io.gh(args);
        },
      }),
    ).toThrow("gh upload fixture failure");
    files.set(debPath, Buffer.from("changed bytes"));
    ghCalls.length = 0;
    expect(() => runLinuxProvenanceCli(["upload"], env, io)).toThrow("actual build artifacts before upload");
    expect(ghCalls).toEqual([]);
  });

  it("rejects a stored proof whose release ID differs from the build output before API access", () => {
    const { env, files, io, ghCalls } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const proof = parseRecord(io.readFile(proofPath));
    proof.releaseId = RELEASE_ID + 1;
    files.set(proofPath, Buffer.from(`${JSON.stringify(proof, null, 2)}\n`));
    expect(() => runLinuxProvenanceCli(["upload"], env, io)).toThrow("Linux provenance file must match");
    expect(ghCalls).toEqual([]);
  });

  it("rejects a recreated tag's different release ID before any POST", () => {
    const { env, io, ghCalls } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const gh = (args: readonly string[]) => {
      ghCalls.push([...args]);
      return JSON.stringify({ ...releaseView, id: RELEASE_ID + 1 });
    };
    expect(() => runLinuxProvenanceCli(["upload"], env, { ...io, gh })).toThrow("expected draft release ID and tag");
    expect(
      ghCalls.every(
        (args) => args.includes("GET") && args[1] === `repos/${env.GITHUB_REPOSITORY}/releases/${RELEASE_ID}`,
      ),
    ).toBe(true);
  });

  it("does not look up a recreated tag when the original fixed release ID no longer exists", () => {
    const { env, io, ghCalls } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const gh = (args: readonly string[]) => {
      ghCalls.push([...args]);
      if (args[0] === "api" && args.includes("GET")) throw new Error("original fixed release ID: HTTP 404");
      return JSON.stringify({ ...releaseView, id: RELEASE_ID + 1, isDraft: true, tagName: TAG });
    };
    expect(() => runLinuxProvenanceCli(["upload"], env, { ...io, gh })).toThrow("original fixed release ID");
    expect(ghCalls).toEqual([
      ["api", `repos/${env.GITHUB_REPOSITORY}/releases/${RELEASE_ID}`, "--hostname", "github.com", "--method", "GET"],
    ]);
  });

  it("fails if the fixed release is deleted before upload instead of looking up the recreated tag", () => {
    const { env, io, ghCalls } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const gh = (args: readonly string[]) => {
      ghCalls.push([...args]);
      if (args.includes("POST")) throw new Error("fixed release ID deleted: HTTP 404");
      return JSON.stringify(releaseView);
    };
    expect(() => runLinuxProvenanceCli(["upload"], env, { ...io, gh })).toThrow("fixed release ID deleted");
    expect(ghCalls.filter((args) => args.includes("POST")).map((args) => args[1])).toEqual([uploadUrl]);
    expect(ghCalls.every((args) => args[0] === "api" && args[1].includes(`/releases/${RELEASE_ID}`))).toBe(true);
  });

  it("rejects a regenerated proof for a different release ID, changed tags and retargeted upload URLs", () => {
    for (const change of [
      { id: RELEASE_ID + 1 },
      { tag_name: "v0.66.1" },
      { upload_url: releaseView.upload_url.replace(String(RELEASE_ID), String(RELEASE_ID + 1)) },
      { upload_url: releaseView.upload_url.replace("uploads.github.com", "example.test") },
    ]) {
      const { env, io, ghCalls } = createProducerFixture();
      runLinuxProvenanceCli(["generate"], env, io);
      const gh = (args: readonly string[]) => {
        ghCalls.push([...args]);
        return JSON.stringify({ ...releaseView, ...change });
      };
      expect(() => runLinuxProvenanceCli(["upload"], env, { ...io, gh })).toThrow();
      expect(ghCalls.some((args) => args.includes("POST"))).toBe(false);
    }
    const { env, io, ghCalls } = createProducerFixture();
    const recreated = { ...env, LINUX_RELEASE_ID: String(RELEASE_ID + 1) };
    runLinuxProvenanceCli(["generate"], recreated, io);
    expect(() => runLinuxProvenanceCli(["upload"], recreated, io)).toThrow("expected draft release ID and tag");
    expect(ghCalls.some((args) => args.includes("POST"))).toBe(false);
  });

  it("preserves existing proof assets for manual recovery without DELETE, POST or retries", () => {
    const { env, io, ghCalls } = createProducerFixture();
    runLinuxProvenanceCli(["generate"], env, io);
    const gh = (args: readonly string[]) => {
      ghCalls.push([...args]);
      return JSON.stringify({ ...releaseView, assets: [{ name: LINUX_PROVENANCE_ASSET_NAME }] });
    };
    expect(() => runLinuxProvenanceCli(["upload"], env, { ...io, gh })).toThrow("before manual recovery");
    expect(ghCalls.map((args) => args[args.indexOf("--method") + 1])).toEqual(["GET"]);
  });
});

describe("Linux provenance entry point", () => {
  it("generates and uploads through the Node entry point and default filesystem adapters", () => {
    const temporaryRoot = path.resolve("tmp/linux-provenance-fixture");
    mkdirSync(temporaryRoot, { recursive: true });
    const root = mkdtempSync(path.join(temporaryRoot, "entrypoint-"));
    try {
      const bundle = path.join(root, "src-tauri/target/release/bundle");
      mkdirSync(bundle, { recursive: true });
      const paths = [debPath, imagePath].map((filePath) => path.join(bundle, path.basename(filePath)));
      for (const filePath of paths) writeFileSync(filePath, `fixture bytes ${path.basename(filePath)}`);

      const hookPath = path.join(root, "fixture-hook.mjs");
      writeFileSync(
        hookPath,
        [
          'import { createRequire, syncBuiltinESMExports } from "node:module";',
          'const childProcess = createRequire(import.meta.url)("node:child_process");',
          'globalThis.fetch = () => Promise.reject(new Error("network disabled in fixture"));',
          "childProcess.spawnSync = (file, args = []) => {",
          "  const command = String(file).toLowerCase();",
          '  if (command === "git" && args[0] === "cat-file" && args[1] === "-t") {',
          '    return { status: 0, stdout: "tag" };',
          "  }",
          '  if (command === "git" && args[0] === "rev-parse") {',
          "    return { status: 0, stdout: process.env.GITHUB_SHA };",
          "  }",
          '  if (command === "gh" && args[0] === "api") {',
          '    const methodIndex = args.indexOf("--method");',
          '    if (methodIndex >= 0 && args[methodIndex + 1] === "GET") {',
          "      return { status: 0, stdout: process.env.LINUX_RELEASE_VIEW };",
          "    }",
          '    if (methodIndex >= 0 && args[methodIndex + 1] === "POST") {',
          '      return { status: 0, stdout: "" };',
          "    }",
          "  }",
          '  throw new Error("unexpected child process: " + String(file));',
          "};",
          "syncBuiltinESMExports();",
          "",
        ].join("\n"),
      );

      const env = {
        ...createProducerFixture().env,
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
        LINUX_ARTIFACT_PATHS: JSON.stringify(paths),
        LINUX_RELEASE_VIEW: JSON.stringify(releaseView),
      };
      const entryPoint = path.resolve("scripts/release/linux-provenance.ts");
      const run = (command: string) =>
        spawnSync(process.execPath, ["--import", pathToFileURL(hookPath).href, entryPoint, command], {
          cwd: root,
          env,
          encoding: "utf8",
          timeout: 10_000,
        });
      const generated = run("generate");
      expect(generated.error).toBeUndefined();
      expect(generated.status).toBe(0);
      expect(generated.stderr).toBe("");

      const uploaded = run("upload");
      expect(uploaded.error).toBeUndefined();
      expect(uploaded.status).toBe(0);
      expect(uploaded.stderr).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("wires Linux generation and upload after successful Tauri builds with actual artifact paths", () => {
    const workflow = readFileSync(path.resolve(".github/workflows/release.yml"), "utf8");
    const build = workflow.indexOf("id: tauri-build");
    for (const [name, command] of [
      ["Generate Linux release provenance", "generate"],
      ["Upload Linux release provenance", "upload"],
    ]) {
      const start = workflow.indexOf(`      - name: ${name}\n`);
      expect(start).toBeGreaterThan(build);
      const step = workflow.slice(start, workflow.indexOf("\n      - ", start + 1));
      expect(step).toContain("if: runner.os == 'Linux' && steps.tauri-build.outcome == 'success'");
      expect(step).toContain(`LINUX_ARTIFACT_PATHS: \${{ steps.tauri-build.outputs.artifactPaths }}`);
      expect(step).toContain(`LINUX_RELEASE_ID: \${{ steps.tauri-build.outputs.releaseId }}`);
      expect(step).toContain(`run: node ./scripts/release/linux-provenance.ts ${command}`);
    }
  });
});
