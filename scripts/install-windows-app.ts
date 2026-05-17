import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type InstallerCandidate = {
  path: string;
  mtimeMs: number;
};

async function findNewestInstaller(directory: string, extension: ".exe" | ".msi"): Promise<InstallerCandidate | null> {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return null;
  }

  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.toLowerCase().endsWith(extension))
      .map(async (entry): Promise<InstallerCandidate> => {
        const installerPath = path.join(directory, entry);
        const fileStat = await stat(installerPath);
        return { path: installerPath, mtimeMs: fileStat.mtimeMs };
      }),
  );

  return candidates.toSorted((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null;
}

function runInstaller(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`installer exited by signal ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

async function main(): Promise<void> {
  const nsisInstaller = await findNewestInstaller(
    path.join("src-tauri", "target", "release", "bundle", "nsis"),
    ".exe",
  );
  if (nsisInstaller) {
    process.exitCode = await runInstaller(nsisInstaller.path, ["/S"]);
    return;
  }

  const msiInstaller = await findNewestInstaller(path.join("src-tauri", "target", "release", "bundle", "msi"), ".msi");
  if (msiInstaller) {
    process.exitCode = await runInstaller("msiexec.exe", ["/i", msiInstaller.path, "/qn", "/norestart"]);
    return;
  }

  console.error("No Windows installer found under src-tauri/target/release/bundle.");
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
