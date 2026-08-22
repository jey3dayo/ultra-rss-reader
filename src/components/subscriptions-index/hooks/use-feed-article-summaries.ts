// Compatibility re-export: the implementation moved to `src/hooks/use-feed-article-summaries.ts`
// because it is now a cross-feature data hook (also used by the reader sidebar).
// Kept here so existing subscriptions-index imports, tests, and mocks are not churned.
export { useFeedArticleSummaries } from "@/hooks/use-feed-article-summaries";
