import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type UsesEntry = {
  workflowPath: string;
  line: number;
  ownerRepo: string;
  ref: string;
  claimedTag: string | null;
};

const workflowsDir = ".github/workflows";
const workflowPaths = readdirSync(workflowsDir)
  .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
  .map((fileName) => path.join(workflowsDir, fileName))
  .sort();

function splitValueAndComment(rest: string): { value: string; comment: string | null } {
  const trimmed = rest.trim();
  const match = trimmed.match(/^(\S+)(?:\s+#\s*(.*))?$/);
  if (!match) {
    return { value: trimmed, comment: null };
  }
  return { value: match[1] ?? "", comment: match[2]?.trim() ?? null };
}

function extractClaimedTag(comment: string | null): string | null {
  if (!comment) {
    return null;
  }
  const match = comment.match(/^(v?\d+(?:\.\d+)*)$/);
  return match ? match[1] : null;
}

function extractWorkflowUses(workflowPath: string, workflow: string): UsesEntry[] {
  return workflow.split(/\r?\n/).flatMap((line, index) => {
    const rest = line.match(/^\s*(?:-\s+)?uses:\s*(?<rest>.+)$/)?.groups?.rest;
    if (!rest) {
      return [];
    }
    const { value, comment } = splitValueAndComment(rest);
    if (value.startsWith("./") || value.startsWith("../")) {
      return [];
    }
    const atIndex = value.lastIndexOf("@");
    if (atIndex === -1) {
      return [];
    }
    const actionPath = value.slice(0, atIndex);
    const ref = value.slice(atIndex + 1);
    const segments = actionPath.split("/");
    const ownerRepo = segments.length >= 2 ? `${segments[0]}/${segments[1]}` : actionPath;
    return [
      {
        workflowPath,
        line: index + 1,
        ownerRepo,
        ref,
        claimedTag: extractClaimedTag(comment),
      },
    ];
  });
}

function ghApi(endpoint: string): { ok: true; data: unknown } | { ok: false; status: string; stderr: string } {
  try {
    const output = execFileSync("gh", ["api", endpoint], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, data: JSON.parse(output) };
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "";
    return { ok: false, status: stderr, stderr };
  }
}

const entries = workflowPaths.flatMap((workflowPath) =>
  extractWorkflowUses(workflowPath, readFileSync(workflowPath, "utf8")),
);

const errors: string[] = [];
const notes: string[] = [];

for (const entry of entries) {
  const label = `${entry.workflowPath}:${entry.line}: ${entry.ownerRepo}@${entry.ref}`;

  // Checked for every pin, including comment-free ones: a pin whose SHA is an
  // annotated tag object still resolves at runtime, so CI stays green while
  // pnpm silently skips it and the version drifts. The commits endpoint only
  // resolves commit SHAs and answers 422 for tag objects.
  const commitCheck = ghApi(`repos/${entry.ownerRepo}/commits/${entry.ref}`);
  if (!commitCheck.ok && /No commit found for SHA/i.test(commitCheck.stderr)) {
    errors.push(
      `${label}: pinned SHA is a tag object, not a commit. Use the commit SHA (pnpm cannot update tag-object pins).`,
    );
    continue;
  }

  if (!entry.claimedTag) {
    notes.push(`${label}: no version comment, informational only`);
    continue;
  }

  const tagRef = ghApi(`repos/${entry.ownerRepo}/git/ref/tags/${entry.claimedTag}`);
  if (!tagRef.ok) {
    errors.push(`${label}: failed to fetch tag ref for ${entry.claimedTag}: ${tagRef.stderr.trim()}`);
    continue;
  }

  const tagObject = (tagRef.data as { object?: { sha?: string; type?: string } }).object;
  if (!tagObject?.sha || !tagObject.type) {
    errors.push(`${label}: unexpected tag ref response for ${entry.claimedTag}`);
    continue;
  }

  let commitSha = tagObject.sha;
  if (tagObject.type === "tag") {
    const derefed = ghApi(`repos/${entry.ownerRepo}/git/tags/${tagObject.sha}`);
    if (!derefed.ok) {
      errors.push(`${label}: failed to dereference annotated tag object ${tagObject.sha}: ${derefed.stderr.trim()}`);
      continue;
    }
    const derefedObject = (derefed.data as { object?: { sha?: string } }).object;
    if (!derefedObject?.sha) {
      errors.push(`${label}: unexpected annotated tag response for ${tagObject.sha}`);
      continue;
    }
    commitSha = derefedObject.sha;
  }

  if (commitSha.toLowerCase() !== entry.ref.toLowerCase()) {
    errors.push(`${label}: tag ${entry.claimedTag} resolves to commit ${commitSha}, but the pin uses ${entry.ref}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

for (const note of notes) {
  console.log(`note: ${note}`);
}
console.log(`action pins ok: ${entries.length} pins checked, ${notes.length} informational`);
