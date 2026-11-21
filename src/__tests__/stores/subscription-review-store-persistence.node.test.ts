import { installNodeTestStorage } from "@tests/helpers/node-test-storage";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";

const nodeTestStorage = installNodeTestStorage();

// Re-importing the store module with a seeded localStorage simulates an app
// restart: the store hydrates its initial state from the persisted decisions.
async function importFreshStore() {
  vi.resetModules();
  return import("@/stores/subscription-review-store");
}

function storedAccounts(): Record<string, string[]> {
  const raw = localStorage.getItem(STORAGE_KEYS.subscriptionReviewDecisions);
  return (JSON.parse(raw ?? "{}") as { accounts?: Record<string, string[]> }).accounts ?? {};
}

describe("useSubscriptionReviewStore persistence", () => {
  afterAll(() => {
    nodeTestStorage.restore();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores persisted decisions when the store is created", async () => {
    localStorage.setItem(
      STORAGE_KEYS.subscriptionReviewDecisions,
      JSON.stringify({ version: 1, accounts: { "acc-1": ["feed-a", "feed-b"], "acc-2": ["feed-c"] } }),
    );

    const { useSubscriptionReviewStore } = await importFreshStore();
    const { kept } = useSubscriptionReviewStore.getState();

    expect([...(kept.get("acc-1") ?? [])].sort()).toEqual(["feed-a", "feed-b"]);
    expect([...(kept.get("acc-2") ?? [])]).toEqual(["feed-c"]);
  });

  it("persists decisions as they change and forgets deleted accounts", async () => {
    const { useSubscriptionReviewStore } = await importFreshStore();
    const { keep, unkeep, forgetAccount } = useSubscriptionReviewStore.getState();

    keep("acc-1", "feed-a");
    keep("acc-1", "feed-b");
    keep("acc-2", "feed-c");
    unkeep("acc-1", "feed-a");

    expect(storedAccounts()).toEqual({
      "acc-1": ["feed-b"],
      "acc-2": ["feed-c"],
    });

    forgetAccount("acc-1");

    expect(useSubscriptionReviewStore.getState().kept.has("acc-1")).toBe(false);
    expect(storedAccounts()).toEqual({ "acc-2": ["feed-c"] });
  });

  it("keeps decisions in memory when persisting fails", async () => {
    const { useSubscriptionReviewStore } = await importFreshStore();

    vi.spyOn(nodeTestStorage.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    useSubscriptionReviewStore.getState().keep("acc-1", "feed-a");

    expect([...(useSubscriptionReviewStore.getState().kept.get("acc-1") ?? [])]).toEqual(["feed-a"]);
  });
});
