import {
  MAX_STORED_SUBSCRIPTION_REVIEW_STORAGE_LENGTH,
  STORAGE_KEYS,
  SUBSCRIPTION_REVIEW_DECISIONS_STORAGE_VERSION,
} from "@/constants/storage";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { parseJsonWithSchemaOrNull } from "@/schemas/parse";
import {
  type StoredSubscriptionReviewDecisions,
  StoredSubscriptionReviewDecisionsStorageSchema,
  type SubscriptionReviewDecisionsStorage,
} from "@/schemas/storage";

export type SubscriptionReviewDecisionsByAccount = ReadonlyMap<string, ReadonlySet<string>>;

type SubscriptionReviewStorageFailureKind = "unavailable" | "read" | "parse-invalid" | "normalize" | "write" | "remove";

const warnedFailureKinds = new Set<SubscriptionReviewStorageFailureKind>();

export function resetSubscriptionReviewStorageFailureWarnings(): void {
  warnedFailureKinds.clear();
}

function warnSubscriptionReviewStorageFailureOnce(
  kind: SubscriptionReviewStorageFailureKind,
  message: string,
  error: unknown,
): void {
  if (warnedFailureKinds.has(kind)) {
    return;
  }

  warnedFailureKinds.add(kind);
  logRuntimeDiagnostic("subscription-review-storage", message, {
    operation: kind,
    storageKey: STORAGE_KEYS.subscriptionReviewDecisions,
    error,
  });
}

function resetSubscriptionReviewStorageFailure(kind: SubscriptionReviewStorageFailureKind): void {
  warnedFailureKinds.delete(kind);
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storage = window.localStorage;
    resetSubscriptionReviewStorageFailure("unavailable");
    return storage;
  } catch (error) {
    warnSubscriptionReviewStorageFailureOnce(
      "unavailable",
      "Subscription review decisions localStorage is unavailable.",
      error,
    );
    return null;
  }
}

function toDecisions(accounts: StoredSubscriptionReviewDecisions): Map<string, Set<string>> {
  const decisions = new Map<string, Set<string>>();

  for (const [accountId, feedIds] of Object.entries(accounts)) {
    decisions.set(accountId, new Set(feedIds));
  }

  return decisions;
}

function toStorage(kept: SubscriptionReviewDecisionsByAccount): SubscriptionReviewDecisionsStorage {
  const accounts: Record<string, string[]> = {};

  for (const [accountId, feedIds] of kept) {
    if (feedIds.size > 0) {
      accounts[accountId] = [...feedIds];
    }
  }

  return {
    version: SUBSCRIPTION_REVIEW_DECISIONS_STORAGE_VERSION,
    accounts,
  };
}

function tryRemoveStoredDecisions(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEYS.subscriptionReviewDecisions);
    resetSubscriptionReviewStorageFailure("remove");
  } catch (error) {
    warnSubscriptionReviewStorageFailureOnce("remove", "Failed to remove subscription review decisions.", error);
  }
}

function writeNormalizedStoredDecisions(
  storage: Storage,
  raw: string,
  stored: SubscriptionReviewDecisionsStorage,
): void {
  const normalized = JSON.stringify(stored);
  if (raw === normalized) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEYS.subscriptionReviewDecisions, normalized);
    resetSubscriptionReviewStorageFailure("normalize");
  } catch (error) {
    warnSubscriptionReviewStorageFailureOnce(
      "normalize",
      "Failed to normalize subscription review decisions in localStorage.",
      error,
    );
    // Ignore cleanup write failures; callers can still use the normalized in-memory decisions.
  }
}

export function readSubscriptionReviewDecisions(): Map<string, Set<string>> {
  const storage = readStorage();
  if (!storage) {
    return new Map();
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEYS.subscriptionReviewDecisions);
    resetSubscriptionReviewStorageFailure("read");
  } catch (error) {
    warnSubscriptionReviewStorageFailureOnce("read", "Failed to read subscription review decisions.", error);
    return new Map();
  }

  if (!raw) {
    return new Map();
  }

  if (raw.length > MAX_STORED_SUBSCRIPTION_REVIEW_STORAGE_LENGTH) {
    tryRemoveStoredDecisions(storage);
    return new Map();
  }

  const parsed = parseJsonWithSchemaOrNull(raw, StoredSubscriptionReviewDecisionsStorageSchema);
  if (!parsed) {
    warnSubscriptionReviewStorageFailureOnce(
      "parse-invalid",
      "Invalid subscription review decisions storage",
      new Error("Invalid subscription review decisions storage"),
    );
    tryRemoveStoredDecisions(storage);
    return new Map();
  }

  writeNormalizedStoredDecisions(storage, raw, parsed);
  return toDecisions(parsed.accounts);
}

export function writeSubscriptionReviewDecisions(kept: SubscriptionReviewDecisionsByAccount): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEYS.subscriptionReviewDecisions, JSON.stringify(toStorage(kept)));
    resetSubscriptionReviewStorageFailure("write");
  } catch (error) {
    warnSubscriptionReviewStorageFailureOnce(
      "write",
      "Failed to write subscription review decisions to localStorage.",
      error,
    );
    // Ignore storage failures; decisions remain usable in memory for the rest of the session.
  }
}
