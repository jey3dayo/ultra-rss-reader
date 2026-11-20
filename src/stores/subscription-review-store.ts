import { create } from "zustand";

type KeptFeedIdsByAccount = ReadonlyMap<string, ReadonlySet<string>>;

type SubscriptionReviewState = {
  kept: KeptFeedIdsByAccount;
};

type SubscriptionReviewActions = {
  keep: (accountId: string, feedId: string) => void;
  unkeep: (accountId: string, feedId: string) => void;
  clear: (accountId: string) => ReadonlySet<string>;
  restore: (accountId: string, snapshot: ReadonlySet<string>) => void;
  forget: (accountId: string, feedIds: Iterable<string>) => void;
};

// Held in memory only: decisions outlive the workspace view but not the app session.
const EMPTY_FEED_IDS: ReadonlySet<string> = new Set();

function withAccountFeedIds(
  kept: KeptFeedIdsByAccount,
  accountId: string,
  feedIds: ReadonlySet<string>,
): KeptFeedIdsByAccount {
  const next = new Map(kept);
  if (feedIds.size === 0) {
    next.delete(accountId);
  } else {
    next.set(accountId, feedIds);
  }
  return next;
}

export const useSubscriptionReviewStore = create<SubscriptionReviewState & SubscriptionReviewActions>()((set, get) => ({
  kept: new Map(),

  keep: (accountId, feedId) =>
    set((state) => {
      const current = state.kept.get(accountId) ?? EMPTY_FEED_IDS;
      if (current.has(feedId)) {
        return state;
      }
      return { kept: withAccountFeedIds(state.kept, accountId, new Set(current).add(feedId)) };
    }),

  unkeep: (accountId, feedId) =>
    set((state) => {
      const current = state.kept.get(accountId) ?? EMPTY_FEED_IDS;
      if (!current.has(feedId)) {
        return state;
      }
      const next = new Set(current);
      next.delete(feedId);
      return { kept: withAccountFeedIds(state.kept, accountId, next) };
    }),

  clear: (accountId) => {
    const snapshot = get().kept.get(accountId) ?? EMPTY_FEED_IDS;
    if (snapshot.size > 0) {
      set((state) => ({ kept: withAccountFeedIds(state.kept, accountId, EMPTY_FEED_IDS) }));
    }
    return snapshot;
  },

  // Adds the snapshot back instead of replacing, so decisions made after the clear survive an undo.
  restore: (accountId, snapshot) =>
    set((state) => {
      const current = state.kept.get(accountId) ?? EMPTY_FEED_IDS;
      const next = new Set(current);
      for (const feedId of snapshot) {
        next.add(feedId);
      }
      if (next.size === current.size) {
        return state;
      }
      return { kept: withAccountFeedIds(state.kept, accountId, next) };
    }),

  forget: (accountId, feedIds) =>
    set((state) => {
      const current = state.kept.get(accountId) ?? EMPTY_FEED_IDS;
      const next = new Set(current);
      for (const feedId of feedIds) {
        next.delete(feedId);
      }
      if (next.size === current.size) {
        return state;
      }
      return { kept: withAccountFeedIds(state.kept, accountId, next) };
    }),
}));

export function useKeptFeedIds(accountId: string | null): ReadonlySet<string> {
  return useSubscriptionReviewStore((state) =>
    accountId === null ? EMPTY_FEED_IDS : (state.kept.get(accountId) ?? EMPTY_FEED_IDS),
  );
}
