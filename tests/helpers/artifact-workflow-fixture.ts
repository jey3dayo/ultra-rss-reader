import type { ArtifactWorkflowIO } from "../../scripts/release/workflows/artifacts.ts";

type CommandResult = {
  status: number | null;
  stderr: string | null;
  stdout: string | null;
};

class ArtifactProcessExit extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`artifact process exited with status ${status}`);
    this.status = status;
  }
}

export const createFakeArtifactWorkflowIO = () => {
  const files = new Map<string, Uint8Array>();
  const directories = new Map<string, Array<{ isDirectory: boolean; name: string }>>();
  const logs: string[] = [];
  const errors: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const events: string[] = [];
  const verifications: Array<{ args: string[]; command: string }> = [];
  const uploads: Array<{ assets: string[]; tag: string }> = [];
  const releaseViews: CommandResult[] = [];
  const uploadResults: Array<{ status: number | null }> = [];
  const verificationResults: CommandResult[] = [];
  const gitOutputs = new Map<string, string>();
  const defaultReleaseView = JSON.stringify({
    assets: [],
    isDraft: true,
    isPrerelease: false,
    tagName: "v1.2.3",
    url: "https://github.com/fixture/ultra-rss-reader/releases/tag/v1.2.3",
  });

  const io: ArtifactWorkflowIO = {
    copyFile: (source, destination) => {
      const bytes = files.get(source);
      if (!bytes) {
        throw new Error(`unexpected copy source ${source}`);
      }
      files.set(destination, Buffer.from(bytes));
    },
    error: (message) => errors.push(message),
    exists: (filePath) => files.has(filePath) || directories.has(filePath),
    exit: (status) => {
      throw new ArtifactProcessExit(status);
    },
    git: (args) => {
      const key = args.join(" ");
      const output = gitOutputs.get(key);
      if (output === undefined) {
        throw new Error(`unexpected git invocation ${key}`);
      }
      return output;
    },
    listDirectory: (directory) => {
      const entries = directories.get(directory);
      if (!entries) {
        throw new Error(`unexpected directory read ${directory}`);
      }
      return entries;
    },
    log: (message) => logs.push(message),
    makeDirectory: (directory) => {
      if (!directories.has(directory)) {
        directories.set(directory, []);
      }
    },
    readFile: (filePath) => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error(`unexpected file read ${filePath}`);
      }
      return bytes;
    },
    readTextFile: (filePath) => {
      const bytes = files.get(filePath);
      if (!bytes) {
        throw new Error(`unexpected text file read ${filePath}`);
      }
      return Buffer.from(bytes).toString("utf8");
    },
    stderr: (output) => stderr.push(output),
    stdout: (output) => stdout.push(output),
    uploadReleaseAssetsWithClobber: (tag, assets) => {
      events.push(`upload:${tag}`);
      uploads.push({ assets: [...assets], tag });
      return uploadResults.shift() ?? { status: 0 };
    },
    verifyCommand: (command, args) => {
      verifications.push({ args: [...args], command });
      return verificationResults.shift() ?? { status: 0, stderr: "", stdout: "" };
    },
    viewRelease: (tag) => {
      events.push(`view:${tag}`);
      return releaseViews.shift() ?? { status: 0, stderr: "", stdout: defaultReleaseView };
    },
    writeFile: (filePath, content) => {
      files.set(filePath, typeof content === "string" ? Buffer.from(content) : Buffer.from(content));
    },
  };

  return {
    directories,
    errors,
    events,
    files,
    gitOutputs,
    io,
    logs,
    releaseViews,
    stderr,
    stdout,
    uploadResults,
    uploads,
    verifications,
    verificationResults,
  };
};

export const addDirectory = (
  fake: ReturnType<typeof createFakeArtifactWorkflowIO>,
  directory: string,
  entries: Array<{ isDirectory: boolean; name: string }> = [],
): void => {
  fake.directories.set(directory, entries);
};

export const addFile = (
  fake: ReturnType<typeof createFakeArtifactWorkflowIO>,
  filePath: string,
  content: string,
): void => {
  fake.files.set(filePath, Buffer.from(content));
};

export const expectProcessExit = (operation: () => void): number => {
  try {
    operation();
  } catch (error) {
    if (error instanceof ArtifactProcessExit) {
      return error.status;
    }
    throw error;
  }
  throw new Error("expected artifact process exit");
};
