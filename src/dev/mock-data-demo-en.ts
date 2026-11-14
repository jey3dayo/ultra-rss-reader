/**
 * English demo mock dataset for browser-only development mode.
 *
 * Selected via `VITE_DEV_MOCK_LOCALE=en` (see `mock-data-locale.ts`) so the
 * whole UI and its sample content render in English for README / landing
 * page screenshots and demo GIFs. Feed and publication names are
 * intentionally fictional (e.g. "Tech Digest", "Dev Weekly") — never real
 * news organizations — paired with generic, non-event-specific tech
 * headlines so nothing here reads as a fabricated real-world news story.
 *
 * The base set lives in `store-screenshot-fixtures.ts`; this file adds only the
 * articles other dev checks need (stale subscriptions, long-form reading).
 */

import type { ArticleDto } from "@/api/tauri-commands";
import type { DevMockSeedState, RelativeMockArticlePublishedAtMap } from "@/dev/mock-data-shared";
import {
  createMockArticleEn,
  relativeStoreScreenshotPublishedAt,
  storeScreenshotSeeds,
} from "@/dev/store-screenshot-fixtures";
import { addLocalDays, getCurrentDate } from "@/lib/datetime";

const now = getCurrentDate();

export const relativeMockArticlePublishedAtEn: RelativeMockArticlePublishedAtMap = {
  ...relativeStoreScreenshotPublishedAt,
  "art-en-17": { dayOffset: -140, hours: 10, minutes: 10 },
  "art-en-18": { dayOffset: -140, hours: 9, minutes: 35 },
  "art-en-19": { dayOffset: -140, hours: 8, minutes: 15 },
};

const longReaderKeyboardContentParagraphsEn = [
  "Teams that made the switch describe a slow build-up rather than a single rewrite. Suites grew flaky one merge at a time, and the fix came the same way: replacing the shakiest end-to-end checks with faster, narrower tests as each one caused enough friction to justify the work.",
  "The common thread across the interviews was ownership. Suites that stayed healthy had a clear owner who triaged failures within a day or two, while suites that were nobody's job in particular tended to accumulate skipped tests until almost nothing in them was trusted.",
  "Cost was the other recurring theme. Full end-to-end runs are expensive in both compute time and attention, so several teams now reserve them for a small set of critical user journeys and push everything else down to faster layers that give feedback in seconds instead of minutes.",
  "None of this means end-to-end testing is going away. The teams interviewed still keep a handful of browser-driven checks for the flows that matter most to customers, they just no longer expect that layer to catch every regression on its own.",
  "Tooling played a smaller role in the shift than expected. Most teams kept their existing frameworks and instead changed what they asked those tools to cover, favoring fewer, more deliberate end-to-end scenarios over broad but brittle coverage.",
  "The pattern shows up outside of testing too. Whenever a process becomes expensive to maintain relative to the value it delivers, teams tend to narrow its scope rather than abandon it outright, keeping the parts that pay for themselves and trimming the rest.",
  "Several engineering leads pointed to flakiness itself as the real cost driver, more than raw runtime. A test that fails once in twenty runs for no discernible reason erodes trust faster than a suite that is merely slow, because every red run forces someone to decide whether it is a real regression.",
  "The teams that recovered from chronically flaky suites tended to start with a moratorium: no new end-to-end tests until the existing ones were either fixed or deleted. That constraint forced a harder conversation about which flows genuinely needed browser-level coverage in the first place.",
  "A recurring mistake was writing end-to-end tests to cover logic that a unit test could exercise far more cheaply. Once teams pushed that logic down a layer, the remaining end-to-end suite shrank naturally, and what was left tended to be the tests worth keeping.",
  "Feedback loop length came up again and again as the practical reason to change course. A ten-minute wait to learn whether a one-line fix worked pushed engineers toward batching changes and context-switching away, which in turn slowed down the whole team's iteration speed.",
  "Migration wasn't free. Several teams described a multi-quarter effort to build confidence in the new layered approach before they were willing to delete old end-to-end coverage, running both in parallel long enough to catch any gaps the faster tests missed.",
  "By the end of the transition, most teams described their testing pyramid as noticeably flatter than the textbook version: a large base of fast tests, a modest middle layer, and a deliberately small set of end-to-end checks reserved for the journeys that would hurt the most to get wrong.",
];

const longReaderKeyboardContentEn = longReaderKeyboardContentParagraphsEn
  .map((paragraph) => `<p>${paragraph}</p>`)
  .join("");

const demoOnlyArticleSeedsEn = [
  createMockArticleEn({
    id: "art-en-17",
    feedId: "feed-north-star-report",
    title: "Revisiting a slow news quarter for wearable displays",
    summary:
      "A sample article for exercising subscriptions that have gone quiet for a long stretch, used to check the stale-feed review UI.",
    url: "https://example.com/north-star-report/mock-stale-wearables",
    author: "North Star Report",
    date: addLocalDays(now, -140),
    hours: 10,
    minutes: 15,
    isRead: true,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-18",
    feedId: "feed-frontend-notes",
    title: "An old compatibility note worth re-checking",
    summary:
      "A sample article representing a subscription with no unread items and an old last-update time, used to exercise the stale-feed indicator.",
    url: "https://example.com/frontend-notes/mock-stale-compat-note",
    author: "Frontend Notes",
    date: addLocalDays(now, -140),
    hours: 9,
    minutes: 40,
    isRead: true,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-19",
    feedId: "feed-dev-weekly",
    title: "Old benchmark notes from a previous hardware generation",
    summary:
      "A sample article for verifying the appearance of a 90-day-plus stale subscription card in the review workspace.",
    url: "https://example.com/dev-weekly/mock-stale-benchmark-notes",
    author: "Dev Weekly Editors",
    date: addLocalDays(now, -140),
    hours: 8,
    minutes: 20,
    contentHtml: longReaderKeyboardContentEn,
    isRead: true,
    isStarred: false,
  }),
] satisfies readonly ArticleDto[];

export const mockDataSeedsEn: DevMockSeedState = {
  ...storeScreenshotSeeds,
  articles: [...storeScreenshotSeeds.articles, ...demoOnlyArticleSeedsEn],
};
