import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type TodoPriority = "P0" | "P1" | "P2" | "P3";

export type TodoWorkType =
  | "implementation"
  | "contract-test"
  | "rule-update"
  | "manual-verification"
  | "tooling"
  | "type-placement-cleanup";

export type TodoItem = {
  id: string;
  title: string;
  priority: TodoPriority;
  code: string | null;
  sectionPath: string[];
  domainBucket: string;
  implementationOrder: number;
  explicitShard: string | null;
  workTypes: TodoWorkType[];
  workerPrompt: string | null;
  targetFiles: string[];
  focusedVerification: string[];
  manualVerification: string[];
  parallelSafeHint: string | null;
  dependencyHints: string[];
  defer: string | null;
  createdBatch: string | null;
  lastReviewed: string | null;
  supersedes: string[];
  supersededBy: string[];
  completedBy: string[];
  rawDetails: Record<string, string[]>;
};

export type DuplicateTodoGroup = {
  id: string;
  reason: string;
  items: TodoItem[];
  mergeNotes: string[];
};

export type TodoShardPlan = {
  domainBucket: string;
  owner: string;
  items: TodoItem[];
  writeScopes: string[];
  focusedVerification: string[];
  manualVerification: string[];
  parallelSafety: string[];
  blockingDependencies: string[];
};

export type TodoMergeWorkflow = {
  groupId: string;
  closeStrategy: "superseded-by" | "completed-by" | "merge-review";
  mergeTarget: string | null;
  checklist: string[];
  evidence: string[];
};

export type WorkerIssueExport = {
  id: string;
  title: string;
  priority: TodoPriority;
  domainBucket: string;
  workerPrompt: string | null;
  targetFiles: string[];
  prohibitedScope: string[];
  verificationCommands: string[];
  focusedVerification: string[];
  parallelSafeHint: string | null;
  supersedes: string[];
};

export type TodoAgingAction = "escalate" | "review" | "archive-candidate" | "changelog-candidate" | "none";

export type TodoAgingEntry = {
  id: string;
  title: string;
  priority: TodoPriority;
  createdBatch: string | null;
  lastReviewed: string | null;
  action: TodoAgingAction;
  reason: string;
};

export type TodoAgingReport = {
  entries: TodoAgingEntry[];
  policy: {
    staleP1Days: number;
    staleP2Days: number;
    staleP3Days: number;
  };
};

const todoItemPattern = /^- \[[ xX]\] (?<title>P[0-3](?:-[A-Z0-9]+)?\b.*)$/;
const headingPattern = /^(?<marks>#{2,6}) (?<title>.+)$/;
const detailPattern = /^\s{2}- (?<key>[^:：]+)[:：]\s*(?<value>.*)$/;
const priorityPattern = /^(?<priority>P[0-3])(?:-(?<code>[A-Z0-9]+))?\b/;
const inlineCodePattern = /`([^`]+)`/g;

const domainRules = [
  { bucket: "quality-tooling", pattern: /quality|todo|tooling|parser|similarity|worker prompt|issue export|baseline/i },
  { bucket: "security-privacy", pattern: /security|privacy|sanitizer|private host|token|backup|export privacy/i },
  { bucket: "provider-sync", pattern: /provider|auth|credential|capability|sync|mutation/i },
  { bucket: "release-native", pattern: /release|updater|artifact|manifest|sbom|provenance|native/i },
  { bucket: "db-recovery", pattern: /db|database|migration|rollback|restore|recovery|corruption/i },
  { bucket: "query-cache", pattern: /query|cache|invalidation/i },
  { bucket: "settings-state", pattern: /settings|preference|shortcut|tag|mute|dirty|form/i },
  { bucket: "reader-state", pattern: /reader|article|search|selection|focus|retained|auto-mark/i },
  { bucket: "a11y-keyboard", pattern: /a11y|keyboard|dialog|popover|aria|focus visible|ime|shortcut/i },
] as const;

const domainOwners: Record<string, string> = {
  "a11y-keyboard": "accessibility",
  "db-recovery": "data-recovery",
  "provider-sync": "provider",
  "quality-tooling": "quality",
  "query-cache": "query-cache",
  "reader-state": "reader",
  "release-native": "release",
  "security-privacy": "security/privacy",
  "settings-state": "settings",
  unclassified: "unclassified",
};

export function parseTodoMarkdown(markdown: string): TodoItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: TodoItem[] = [];
  const sectionPath: string[] = [];
  let current: MutableTodoItem | null = null;

  for (const line of lines) {
    const heading = line.match(headingPattern);
    if (heading?.groups) {
      const depth = heading.groups.marks.length - 2;
      sectionPath.splice(depth);
      sectionPath[depth] = heading.groups.title.trim();
      current = null;
      continue;
    }

    const todo = line.match(todoItemPattern);
    if (todo?.groups) {
      current = createTodoItem(todo.groups.title.trim(), sectionPath.filter(Boolean));
      items.push(current);
      continue;
    }

    if (current === null) {
      continue;
    }

    const detail = line.match(detailPattern);
    if (detail?.groups) {
      addDetail(current, detail.groups.key.trim(), detail.groups.value.trim());
    }
  }

  return items.map(finalizeTodoItem);
}

export function findDuplicateTodoGroups(items: readonly TodoItem[], threshold = 0.5): DuplicateTodoGroup[] {
  const groups = new Map<string, TodoItem[]>();

  for (const item of items) {
    const related = findRelatedItems(item, items, threshold);
    if (related.length === 0) {
      continue;
    }

    const members = [item, ...related].sort((first, second) => first.id.localeCompare(second.id));
    const groupId = members.map((member) => member.id).join("+");
    groups.set(groupId, members);
  }

  return [...groups.entries()]
    .map(([id, groupItems]) => ({
      id,
      reason: buildDuplicateReason(groupItems),
      items: groupItems,
      mergeNotes: groupItems.flatMap((item) =>
        item.supersedes.map((superseded) => `${item.id} supersedes ${superseded}`),
      ),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));
}

export function buildTodoShardPlans(items: readonly TodoItem[]): TodoShardPlan[] {
  const groups = new Map<string, TodoItem[]>();
  for (const item of items) {
    const bucket = item.explicitShard ?? item.domainBucket;
    groups.set(bucket, [...(groups.get(bucket) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([domainBucket, shardItems]) => {
      const orderedItems = sortByImplementationOrder(shardItems);
      return {
        domainBucket,
        owner: domainOwners[domainBucket] ?? domainBucket,
        items: orderedItems,
        writeScopes: uniqueSorted(orderedItems.flatMap((item) => item.targetFiles)),
        focusedVerification: uniqueSorted(orderedItems.flatMap((item) => item.focusedVerification)),
        manualVerification: uniqueSorted(orderedItems.flatMap((item) => item.manualVerification)),
        parallelSafety: uniqueSorted(orderedItems.map((item) => item.parallelSafeHint).filter(isNonEmptyString)),
        blockingDependencies: uniqueSorted(orderedItems.flatMap((item) => item.dependencyHints)),
      };
    })
    .sort((first, second) => first.domainBucket.localeCompare(second.domainBucket));
}

export function buildTodoMergeWorkflows(groups: readonly DuplicateTodoGroup[]): TodoMergeWorkflow[] {
  return groups.map((group) => {
    const mergeTarget = selectMergeTarget(group.items);
    const hasCompletedBy = group.items.some((item) => item.completedBy.length > 0);
    const hasSupersededBy = group.items.some((item) => item.supersededBy.length > 0 || item.supersedes.length > 0);
    return {
      groupId: group.id,
      closeStrategy: hasCompletedBy ? "completed-by" : hasSupersededBy ? "superseded-by" : "merge-review",
      mergeTarget,
      checklist: [
        "Move unique acceptance criteria and focused verification into the merge target before closing a leaf TODO.",
        "Record superseded by or completed by on the leaf task before deletion.",
        "Move completed user-visible work to CHANGELOG only after implementation lands.",
        "Keep issue links or worker export ids in the merge target handoff note.",
      ],
      evidence: [group.reason, ...group.mergeNotes],
    };
  });
}

export function exportWorkerIssues(
  items: readonly TodoItem[],
  options: { priorities?: readonly TodoPriority[] } = {},
): WorkerIssueExport[] {
  const priorities = new Set(options.priorities ?? ["P1", "P2"]);
  return items
    .filter((item) => priorities.has(item.priority))
    .sort((first, second) => first.implementationOrder - second.implementationOrder)
    .map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      domainBucket: item.domainBucket,
      workerPrompt: item.workerPrompt,
      targetFiles: item.targetFiles,
      prohibitedScope: item.defer === null ? [] : [item.defer],
      verificationCommands: item.focusedVerification.filter(isVerificationCommand),
      focusedVerification: item.focusedVerification,
      parallelSafeHint: item.parallelSafeHint,
      supersedes: item.supersedes,
    }));
}

export function formatWorkerIssuesMarkdown(issues: readonly WorkerIssueExport[]): string {
  return issues
    .map((issue) =>
      [
        `## ${formatIssueHeading(issue)}`,
        "",
        `- priority: ${issue.priority}`,
        `- domain: ${issue.domainBucket}`,
        issue.workerPrompt === null ? null : `- worker prompt: ${issue.workerPrompt}`,
        issue.targetFiles.length === 0 ? null : `- target files: ${issue.targetFiles.join(", ")}`,
        issue.prohibitedScope.length === 0 ? null : `- prohibited scope: ${issue.prohibitedScope.join("; ")}`,
        issue.focusedVerification.length === 0 ? null : `- verification: ${issue.focusedVerification.join("; ")}`,
        issue.parallelSafeHint === null ? null : `- parallel-safe hint: ${issue.parallelSafeHint}`,
        issue.supersedes.length === 0 ? null : `- supersedes: ${issue.supersedes.join("; ")}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n\n");
}

function formatIssueHeading(issue: WorkerIssueExport): string {
  return issue.title.startsWith(issue.id) ? issue.title : `${issue.id} ${issue.title}`;
}

export function runTodoTriage(args: readonly string[] = process.argv.slice(2)): void {
  const command = args[0] ?? "json";
  const todoPath = args[1] ?? "TODO.md";
  const items = parseTodoMarkdown(readFileSync(todoPath, "utf8"));

  if (command === "json") {
    process.stdout.write(`${JSON.stringify({ items }, null, 2)}\n`);
    return;
  }

  if (command === "duplicates") {
    const groups = findDuplicateTodoGroups(items);
    process.stdout.write(`${JSON.stringify({ groups, workflows: buildTodoMergeWorkflows(groups) }, null, 2)}\n`);
    return;
  }

  if (command === "shards") {
    process.stdout.write(`${JSON.stringify({ shards: buildTodoShardPlans(items) }, null, 2)}\n`);
    return;
  }

  if (command === "export-json") {
    process.stdout.write(`${JSON.stringify({ issues: exportWorkerIssues(items) }, null, 2)}\n`);
    return;
  }

  if (command === "export-md") {
    process.stdout.write(`${formatWorkerIssuesMarkdown(exportWorkerIssues(items))}\n`);
    return;
  }

  if (command === "aging") {
    process.stdout.write(`${JSON.stringify(buildTodoAgingReport(items), null, 2)}\n`);
    return;
  }

  process.stderr.write(
    "Usage: node scripts/todo-triage.ts [json|duplicates|shards|export-json|export-md|aging] [TODO.md]\n",
  );
  process.exit(2);
}

export function buildTodoAgingReport(
  items: readonly TodoItem[],
  options: { now?: Date; staleP1Days?: number; staleP2Days?: number; staleP3Days?: number } = {},
): TodoAgingReport {
  const policy = {
    staleP1Days: options.staleP1Days ?? 30,
    staleP2Days: options.staleP2Days ?? 60,
    staleP3Days: options.staleP3Days ?? 90,
  };
  const now = options.now ?? new Date();

  return {
    entries: items.map((item) => buildTodoAgingEntry(item, now, policy)),
    policy,
  };
}

function createTodoItem(title: string, sectionPath: string[]): MutableTodoItem {
  const priorityMatch = title.match(priorityPattern);
  if (priorityMatch?.groups === undefined) {
    throw new Error(`TODO title is missing priority: ${title}`);
  }

  const code = priorityMatch.groups.code ?? null;
  return {
    id: code === null ? title : `${priorityMatch.groups.priority}-${code}`,
    title,
    priority: priorityMatch.groups.priority as TodoPriority,
    code,
    sectionPath,
    domainBucket: "unclassified",
    implementationOrder: 0,
    explicitShard: null,
    workTypes: [],
    workerPrompt: null,
    targetFiles: [],
    focusedVerification: [],
    manualVerification: [],
    parallelSafeHint: null,
    dependencyHints: [],
    defer: null,
    createdBatch: null,
    lastReviewed: null,
    supersedes: [],
    supersededBy: [],
    completedBy: [],
    rawDetails: {},
  };
}

function addDetail(item: MutableTodoItem, rawKey: string, value: string): void {
  const key = normalizeDetailKey(rawKey);
  item.rawDetails[key] = [...(item.rawDetails[key] ?? []), value];

  if (key === "worker prompt") {
    item.workerPrompt = appendSentence(item.workerPrompt, value);
  } else if (key === "対象" || key === "target") {
    item.targetFiles.push(...readTargets(value));
  } else if (key === "検証" || key === "verification") {
    item.focusedVerification.push(...readList(value));
    item.manualVerification.push(...readManualVerification(value));
  } else if (key === "完了条件" || key === "acceptance") {
    item.dependencyHints.push(value);
  } else if (key === "親バッチ" || key === "背景" || key === "shard") {
    if (key === "shard") {
      item.explicitShard = normalizeShard(value);
    }
    item.dependencyHints.push(value);
  } else if (key === "domain shard") {
    item.explicitShard = normalizeShard(value);
    item.dependencyHints.push(value);
  } else if (key === "defer") {
    item.defer = value;
    item.dependencyHints.push(value);
  } else if (key === "created batch" || key === "created") {
    item.createdBatch = value;
  } else if (key === "last reviewed" || key === "reviewed") {
    item.lastReviewed = value;
  } else if (key === "supersedes") {
    item.supersedes.push(...readList(value));
  } else if (key === "superseded by") {
    item.supersededBy.push(...readList(value));
  } else if (key === "completed by") {
    item.completedBy.push(...readList(value));
  }
}

function isKnownDomainBucket(value: string | null): value is string {
  return value !== null && Object.hasOwn(domainOwners, value);
}

function finalizeTodoItem(item: MutableTodoItem): TodoItem {
  const domainSource = [
    item.title,
    item.sectionPath.join(" "),
    item.targetFiles.join(" "),
    item.focusedVerification.join(" "),
    item.workerPrompt ?? "",
  ].join(" ");
  // 明示された domain shard は heading / path からの推論より優先する。
  // 例: "Reader UI / Account Settings" 配下の reader-state 項目が settings-state に落ちるのを防ぐ。
  const inferredBucket = domainRules.find((rule) => rule.pattern.test(domainSource))?.bucket ?? "unclassified";
  const domainBucket = isKnownDomainBucket(item.explicitShard) ? item.explicitShard : inferredBucket;
  const workTypes = inferWorkTypes(item, domainSource);

  return {
    ...item,
    domainBucket,
    implementationOrder: inferImplementationOrder(item),
    workTypes,
    targetFiles: uniqueSorted(item.targetFiles),
    focusedVerification: uniqueSorted(item.focusedVerification),
    manualVerification: uniqueSorted(item.manualVerification),
    dependencyHints: uniqueSorted(item.dependencyHints),
    supersedes: uniqueSorted(item.supersedes),
    supersededBy: uniqueSorted(item.supersededBy),
    completedBy: uniqueSorted(item.completedBy),
    parallelSafeHint: inferParallelSafeHint(item, domainBucket),
  };
}

function inferImplementationOrder(item: MutableTodoItem): number {
  const priorityRank: Record<TodoPriority, number> = { P0: 0, P1: 1000, P2: 2000, P3: 3000 };
  const sectionBias = item.sectionPath.some((section) => /先行|first|wave 1|実行 tranche/i.test(section)) ? -100 : 0;
  const codeBias = item.code === null ? 900 : codeOrderBias(item.code);
  return priorityRank[item.priority] + sectionBias + codeBias;
}

function codeOrderBias(code: string): number {
  const numericParts = [...code.matchAll(/\d+/g)].map((match) => Number(match[0]));
  const numberBias = numericParts.reduce((total, value, index) => total + value * 10 ** Math.max(0, 2 - index), 0);
  const letterBias = code
    .replace(/\d+/g, "")
    .split("")
    .reduce((total, value) => total + value.charCodeAt(0), 0);
  return numberBias + letterBias;
}

function inferWorkTypes(item: MutableTodoItem, domainSource: string): TodoWorkType[] {
  const workTypes = new Set<TodoWorkType>();
  if (/tool|script|parser|export|report|baseline|similarity/i.test(domainSource)) {
    workTypes.add("tooling");
  }
  if (/test|fixture|contract|corpus/i.test(domainSource)) {
    workTypes.add("contract-test");
  }
  if (/manual|native verification/i.test(domainSource)) {
    workTypes.add("manual-verification");
  }
  if (/rule|policy|taxonomy/i.test(domainSource)) {
    workTypes.add("rule-update");
  }
  if (/type placement|\.types\.ts/i.test(domainSource)) {
    workTypes.add("type-placement-cleanup");
  }
  if (workTypes.size === 0 || item.targetFiles.length > 0) {
    workTypes.add("implementation");
  }
  return [...workTypes].sort();
}

function findRelatedItems(item: TodoItem, items: readonly TodoItem[], threshold: number): TodoItem[] {
  return items.filter((candidate) => {
    if (candidate.id === item.id) {
      return false;
    }
    if (item.supersedes.includes(candidate.title) || candidate.supersedes.includes(item.title)) {
      return true;
    }
    if (item.supersededBy.includes(candidate.title) || candidate.supersededBy.includes(item.title)) {
      return true;
    }
    if (item.completedBy.includes(candidate.title) || candidate.completedBy.includes(item.title)) {
      return true;
    }
    if (item.priority !== candidate.priority || item.domainBucket !== candidate.domainBucket) {
      return false;
    }
    const targetOverlap = item.targetFiles.some((target) => candidate.targetFiles.includes(target));
    return targetOverlap && titleSimilarity(item.title, candidate.title) >= threshold;
  });
}

function buildDuplicateReason(items: readonly TodoItem[]): string {
  const domains = uniqueSorted(items.map((item) => item.domainBucket));
  const priorities = uniqueSorted(items.map((item) => item.priority));
  const sharedTargets = intersectMany(items.map((item) => item.targetFiles));
  const explicitWorkflow = items.some(
    (item) => item.supersedes.length > 0 || item.supersededBy.length > 0 || item.completedBy.length > 0,
  );

  return [
    `priority=${priorities.join("/")}`,
    `domain=${domains.join("/")}`,
    sharedTargets.length === 0 ? null : `shared targets=${sharedTargets.join(", ")}`,
    explicitWorkflow ? "explicit supersedes workflow" : "normalized title and target overlap",
  ]
    .filter((part) => part !== null)
    .join("; ");
}

function buildTodoAgingEntry(item: TodoItem, now: Date, policy: TodoAgingReport["policy"]): TodoAgingEntry {
  if (item.completedBy.length > 0) {
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      createdBatch: item.createdBatch,
      lastReviewed: item.lastReviewed,
      action: "changelog-candidate",
      reason: "Completed TODOs should move to CHANGELOG after verifying the implementation landed.",
    };
  }

  const reviewedDate = parseTodoDate(item.lastReviewed ?? item.createdBatch);
  if (reviewedDate === null) {
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      createdBatch: item.createdBatch,
      lastReviewed: item.lastReviewed,
      action: "review",
      reason: "Missing created batch or last reviewed marker.",
    };
  }

  const ageDays = daysBetween(reviewedDate, now);
  if (item.priority === "P1" && ageDays >= policy.staleP1Days) {
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      createdBatch: item.createdBatch,
      lastReviewed: item.lastReviewed,
      action: "escalate",
      reason: `P1 has not been reviewed for ${ageDays} days.`,
    };
  }
  if (item.priority === "P2" && ageDays >= policy.staleP2Days) {
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      createdBatch: item.createdBatch,
      lastReviewed: item.lastReviewed,
      action: "review",
      reason: `P2 has not been reviewed for ${ageDays} days.`,
    };
  }
  if (item.priority === "P3" && ageDays >= policy.staleP3Days) {
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      createdBatch: item.createdBatch,
      lastReviewed: item.lastReviewed,
      action: "archive-candidate",
      reason: `P3 has not been reviewed for ${ageDays} days.`,
    };
  }

  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    createdBatch: item.createdBatch,
    lastReviewed: item.lastReviewed,
    action: "none",
    reason: "Within review window.",
  };
}

function parseTodoDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  if (match?.[0] === undefined) {
    return null;
  }
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: Date, end: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function selectMergeTarget(items: readonly TodoItem[]): string | null {
  const sortedItems = sortByImplementationOrder(items);
  const explicitTarget = sortedItems.find((item) => item.supersededBy.length > 0 || item.completedBy.length > 0);
  if (explicitTarget?.supersededBy[0] !== undefined) {
    return explicitTarget.supersededBy[0];
  }
  if (explicitTarget?.completedBy[0] !== undefined) {
    return explicitTarget.completedBy[0];
  }
  return sortedItems[0]?.id ?? null;
}

function sortByImplementationOrder(items: readonly TodoItem[]): TodoItem[] {
  return [...items].sort(
    (first, second) =>
      first.implementationOrder - second.implementationOrder ||
      first.priority.localeCompare(second.priority) ||
      first.id.localeCompare(second.id),
  );
}

function titleSimilarity(first: string, second: string): number {
  const firstTokens = tokenizeTitle(first);
  const secondTokens = tokenizeTitle(second);
  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function tokenizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/^p[0-3](?:-[a-z0-9]+)?\b/, "")
      .replace(/[`"'()[\]{}.,:/_-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2),
  );
}

function inferParallelSafeHint(item: MutableTodoItem, domainBucket: string): string | null {
  const target = item.rawDetails.対象?.join(" ") ?? item.rawDetails.target?.join(" ") ?? "";
  if (target.length === 0) {
    return `Coordinate with other ${domainBucket} work before editing shared scope.`;
  }
  return `Do not run in parallel with tasks touching ${target}.`;
}

function readTargets(value: string): string[] {
  const inlineCodes = readInlineCode(value);
  if (inlineCodes.length > 0) {
    return inlineCodes;
  }
  return readList(value).filter((entry) => /[/.]/.test(entry));
}

function readManualVerification(value: string): string[] {
  return readList(value).filter((entry) => /manual|native|目視|手動/i.test(entry));
}

function readList(value: string): string[] {
  const inlineCodes = readInlineCode(value);
  const withoutInlineCode = value.replace(inlineCodePattern, "");
  const proseParts = withoutInlineCode
    .split(/、|,|;/)
    .map((part) => part.trim())
    .filter(Boolean);
  return uniqueSorted([...inlineCodes, ...proseParts]);
}

function readInlineCode(value: string): string[] {
  return [...value.matchAll(inlineCodePattern)].map((match) => match[1]?.trim()).filter(isNonEmptyString);
}

function isVerificationCommand(value: string): boolean {
  return /^(?:pnpm|mise|git|cargo|node|vitest|npx)\b/.test(value);
}

function appendSentence(current: string | null, next: string): string {
  return current === null ? next : `${current} ${next}`;
}

function normalizeDetailKey(key: string): string {
  return key.trim().toLowerCase();
}

function normalizeShard(value: string): string {
  const inlineShard = readInlineCode(value)[0];
  return (inlineShard ?? value.split(/、|,|;/)[0] ?? value).trim();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(isNonEmptyString))].sort();
}

function intersectMany(groups: readonly string[][]): string[] {
  const [first, ...rest] = groups;
  if (first === undefined) {
    return [];
  }
  return uniqueSorted(first.filter((item) => rest.every((group) => group.includes(item))));
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isTodoTriageEntrypoint(importMetaUrl: string, argvPath: string | undefined): boolean {
  return typeof argvPath === "string" && importMetaUrl === pathToFileURL(argvPath).href;
}

type MutableTodoItem = TodoItem;

if (isTodoTriageEntrypoint(import.meta.url, process.argv[1])) {
  runTodoTriage();
}
