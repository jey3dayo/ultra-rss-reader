import { describe, expect, it } from "vitest";
import {
  type ArticleReadStateSnapshot,
  planOptimisticRetainOnRead,
  shouldKeepArticleInListQuery,
  shouldRetainBulkMarkedRead,
} from "@/lib/articles/article-read-projection";
import type { ReaderFilter } from "@/lib/reader/reader-query";

function article(overrides: Partial<ArticleReadStateSnapshot>): ArticleReadStateSnapshot {
  return { is_read: false, is_starred: false, ...overrides };
}

describe("shouldKeepArticleInListQuery", () => {
  it.each<{
    name: string;
    mode: ReaderFilter | null;
    article: ArticleReadStateSnapshot;
    expected: boolean;
  }>([
    {
      name: "unread mode drops a row once it becomes read",
      mode: "unread",
      article: article({ is_read: true }),
      expected: false,
    },
    {
      name: "unread mode keeps a row that is still unread",
      mode: "unread",
      article: article({ is_read: false }),
      expected: true,
    },
    {
      name: "all mode keeps a read row (icon patch only, no removal)",
      mode: "all",
      article: article({ is_read: true }),
      expected: true,
    },
    {
      name: "starred mode keeps a read-and-starred row: starred rows are removed only on unstar, not on read",
      mode: "starred",
      article: article({ is_read: true, is_starred: true }),
      expected: true,
    },
    {
      name: "starred mode drops a row once it becomes unstarred, regardless of read state",
      mode: "starred",
      article: article({ is_read: false, is_starred: false }),
      expected: false,
    },
    {
      name: "a query with no mode (null) always keeps the row",
      mode: null,
      article: article({ is_read: true, is_starred: false }),
      expected: true,
    },
  ])("$name", ({ mode, article: articleSnapshot, expected }) => {
    expect(shouldKeepArticleInListQuery(mode, articleSnapshot)).toBe(expected);
  });
});

describe("planOptimisticRetainOnRead", () => {
  it.each<{
    name: string;
    params: { viewMode: "all" | "unread" | "starred"; markingRead: boolean; isAlreadyRetained: boolean };
    expected: { shouldRetain: boolean; shouldRollbackOnError: boolean };
  }>([
    {
      name: "unread + marking read + not yet retained: retains and allows rollback on error",
      params: { viewMode: "unread", markingRead: true, isAlreadyRetained: false },
      expected: { shouldRetain: true, shouldRollbackOnError: true },
    },
    {
      name: "unread + marking read + already retained: retains but never rolls back an existing retention",
      params: { viewMode: "unread", markingRead: true, isAlreadyRetained: true },
      expected: { shouldRetain: true, shouldRollbackOnError: false },
    },
    {
      name: "unread + marking unread (markingRead=false): no retain, no rollback",
      params: { viewMode: "unread", markingRead: false, isAlreadyRetained: false },
      expected: { shouldRetain: false, shouldRollbackOnError: false },
    },
    {
      name: "all view: never retains regardless of markingRead",
      params: { viewMode: "all", markingRead: true, isAlreadyRetained: false },
      expected: { shouldRetain: false, shouldRollbackOnError: false },
    },
    {
      name: "starred view: never retains regardless of markingRead",
      params: { viewMode: "starred", markingRead: true, isAlreadyRetained: false },
      expected: { shouldRetain: false, shouldRollbackOnError: false },
    },
  ])("$name", ({ params, expected }) => {
    expect(planOptimisticRetainOnRead(params)).toEqual(expected);
  });
});

describe("shouldRetainBulkMarkedRead", () => {
  it.each<{ name: string; viewMode: "all" | "unread" | "starred"; expected: boolean }>([
    { name: "unread view retains bulk-read rows (single-pass sweep, no rollback)", viewMode: "unread", expected: true },
    { name: "all view does not retain bulk-read rows", viewMode: "all", expected: false },
    { name: "starred view does not retain bulk-read rows", viewMode: "starred", expected: false },
  ])("$name", ({ viewMode, expected }) => {
    expect(shouldRetainBulkMarkedRead(viewMode)).toBe(expected);
  });
});
