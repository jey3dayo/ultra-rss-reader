import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LINUX_PROVENANCE_ASSET_NAME } from "../release-artifact-contract.ts";
import { buildLinuxReleaseProvenance, type LinuxProvenanceDependencies } from "./linux-release-provenance.ts";

export type LinuxProvenanceCliDependencies = LinuxProvenanceDependencies & {
  writeProof: (filePath: string, contents: string) => void;
  gh: (args: readonly string[]) => string;
};

const commandOutput = (command: string, args: readonly string[]): string => {
  const result = spawnSync(command, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? "command"} failed (exit ${result.status ?? "unavailable"})`);
  }
  return result.stdout.trim();
};

const dependencies: LinuxProvenanceCliDependencies = {
  git: (args) => commandOutput("git", args),
  gh: (args) => commandOutput("gh", args),
  readFile: readFileSync,
  resolveArtifact: (filePath) => {
    const absolute = path.resolve(filePath);
    if (!lstatSync(absolute).isFile()) {
      throw new Error("Linux artifact path must identify a regular file");
    }
    return realpathSync(absolute);
  },
  writeProof: (filePath, contents) => {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, { flag: "wx" });
  },
};

export const runLinuxProvenanceCli = (
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  io: LinuxProvenanceCliDependencies = dependencies,
): void => {
  if (args.length !== 1 || (args[0] !== "generate" && args[0] !== "upload")) {
    throw new Error("usage: node scripts/release/linux-provenance.ts <generate|upload>");
  }
  const proof = buildLinuxReleaseProvenance(env, io);
  const proofPath = path.resolve("src-tauri/target/release-provenance", LINUX_PROVENANCE_ASSET_NAME);
  const contents = `${JSON.stringify(proof, null, 2)}\n`;
  if (args[0] === "generate") {
    io.writeProof(proofPath, contents);
    return;
  }
  if (Buffer.from(io.readFile(proofPath)).toString("utf8") !== contents) {
    throw new Error("Linux provenance file must match the checked-out source and actual build artifacts before upload");
  }
  const repository = env.GITHUB_REPOSITORY ?? "";
  const server = new URL(env.GITHUB_SERVER_URL ?? "");
  const releaseEndpoint = `repos/${repository}/releases/${proof.releaseId}`;
  const view: unknown = JSON.parse(io.gh(["api", releaseEndpoint, "--hostname", server.hostname, "--method", "GET"]));
  if (
    typeof view !== "object" ||
    view === null ||
    !("id" in view) ||
    view.id !== proof.releaseId ||
    !("draft" in view) ||
    view.draft !== true ||
    !("tag_name" in view) ||
    view.tag_name !== proof.releaseTag ||
    !("assets" in view) ||
    !Array.isArray(view.assets)
  ) {
    throw new Error("Linux provenance upload requires the expected draft release ID and tag");
  }
  for (const asset of view.assets) {
    if (typeof asset !== "object" || asset === null || !("name" in asset) || typeof asset.name !== "string") {
      throw new Error("Linux provenance upload requires valid release asset metadata");
    }
    if (asset.name === LINUX_PROVENANCE_ASSET_NAME) {
      throw new Error("Linux provenance already exists; inspect the draft assets before manual recovery");
    }
  }
  if (!("upload_url" in view) || typeof view.upload_url !== "string") {
    throw new Error("Linux provenance upload requires the fixed release upload URL");
  }
  const uploadUrl = new URL(view.upload_url.replace(/\{\?name,label\}$/, ""));
  const uploadOrigin = server.hostname === "github.com" ? "https://uploads.github.com" : server.origin;
  const uploadPath =
    server.hostname === "github.com" ? `/${releaseEndpoint}/assets` : `/api/uploads/${releaseEndpoint}/assets`;
  if (
    uploadUrl.origin !== uploadOrigin ||
    uploadUrl.pathname !== uploadPath ||
    uploadUrl.username ||
    uploadUrl.password ||
    uploadUrl.search ||
    uploadUrl.hash
  ) {
    throw new Error("Linux provenance upload URL does not match the fixed release ID and repository");
  }
  uploadUrl.searchParams.set("name", LINUX_PROVENANCE_ASSET_NAME);
  io.gh([
    "api",
    uploadUrl.href,
    "--hostname",
    server.hostname,
    "--method",
    "POST",
    "--header",
    "Content-Type: application/json",
    "--header",
    `Content-Length: ${Buffer.byteLength(contents)}`,
    "--input",
    proofPath,
  ]);
};
