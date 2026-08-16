/**
 * English demo mock dataset for browser-only development mode.
 *
 * Selected via `VITE_DEV_MOCK_LOCALE=en` (see `mock-data-locale.ts`) so the
 * whole UI and its sample content render in English for README / landing
 * page screenshots and demo GIFs. Feed and publication names are
 * intentionally fictional (e.g. "Tech Digest", "Dev Weekly") — never real
 * news organizations — paired with generic, non-event-specific tech
 * headlines so nothing here reads as a fabricated real-world news story.
 */

import type { AccountDto, ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import {
  createMockArticle,
  type DevMockSeedState,
  type MockArticleSeed,
  type MockArticleTag,
  type RelativeMockArticlePublishedAtMap,
} from "@/dev/mock-data-shared";
import { addLocalDays, getCurrentDate } from "@/lib/datetime";

const now = getCurrentDate();
const yesterday = addLocalDays(now, -1);

const MOCK_ARTICLE_FALLBACK_NOTE_EN =
  "A sample article prepared for browser development use, to make it easy to check keyboard navigation and scroll behavior.";

function createMockArticleEn(seed: MockArticleSeed): ArticleDto {
  return createMockArticle(seed, MOCK_ARTICLE_FALLBACK_NOTE_EN);
}

export const relativeMockArticlePublishedAtEn: RelativeMockArticlePublishedAtMap = {
  "art-en-1": { dayOffset: 0, hours: 9, minutes: 12 },
  "art-en-2": { dayOffset: 0, hours: 8, minutes: 5 },
  "art-en-3": { dayOffset: -1, hours: 19, minutes: 40 },
  "art-en-4": { dayOffset: -1, hours: 11, minutes: 15 },
  "art-en-5": { dayOffset: 0, hours: 16, minutes: 22 },
  "art-en-6": { dayOffset: 0, hours: 14, minutes: 50 },
  "art-en-7": { dayOffset: 0, hours: 10, minutes: 30 },
  "art-en-8": { dayOffset: -1, hours: 13, minutes: 5 },
  "art-en-17": { dayOffset: -140, hours: 10, minutes: 10 },
  "art-en-18": { dayOffset: -140, hours: 9, minutes: 35 },
  "art-en-19": { dayOffset: -140, hours: 8, minutes: 15 },
};

const mockAccountSeedsEn = [
  {
    id: "acc-freshrss",
    kind: "FreshRss",
    name: "FreshRSS",
    username: "user",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    keep_read_items_days: 30,
  },
  {
    id: "acc-local",
    kind: "Local",
    name: "Local",
    username: null,
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
] satisfies readonly AccountDto[];

const mockFolderSeedsEn = [
  { id: "folder-tech", account_id: "acc-freshrss", name: "Tech", sort_order: 0 },
  { id: "folder-news", account_id: "acc-freshrss", name: "News", sort_order: 1 },
  { id: "folder-dev", account_id: "acc-freshrss", name: "Dev", sort_order: 2 },
  { id: "folder-video", account_id: "acc-freshrss", name: "Video", sort_order: 3 },
] satisfies readonly FolderDto[];

const mockFeedSeedsEn = [
  {
    id: "feed-tech-digest",
    account_id: "acc-freshrss",
    folder_id: "folder-tech",
    remote_id: null,
    title: "Tech Digest",
    url: "https://example.com/tech-digest/feed",
    site_url: "https://example.com/tech-digest",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-systems-journal",
    account_id: "acc-freshrss",
    folder_id: "folder-tech",
    remote_id: null,
    title: "The Systems Journal",
    url: "https://example.com/systems-journal/feed",
    site_url: "https://example.com/systems-journal",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-daily-signal-wire",
    account_id: "acc-freshrss",
    folder_id: "folder-news",
    remote_id: null,
    title: "Daily Signal Wire",
    url: "https://example.com/daily-signal-wire/feed",
    site_url: "https://example.com/daily-signal-wire",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-north-star-report",
    account_id: "acc-freshrss",
    folder_id: "folder-news",
    remote_id: null,
    title: "North Star Report",
    url: "https://example.com/north-star-report/feed",
    site_url: "https://example.com/north-star-report",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-dev-weekly",
    account_id: "acc-freshrss",
    folder_id: "folder-dev",
    remote_id: null,
    title: "Dev Weekly",
    url: "https://example.com/dev-weekly/feed",
    site_url: "https://example.com/dev-weekly",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-frontend-notes",
    account_id: "acc-freshrss",
    folder_id: "folder-dev",
    remote_id: null,
    title: "Frontend Notes",
    url: "https://example.com/frontend-notes/feed",
    site_url: "https://example.com/frontend-notes",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-video-lab",
    account_id: "acc-freshrss",
    folder_id: "folder-video",
    remote_id: null,
    title: "Video Lab",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=mock-video-lab",
    site_url: "https://www.youtube.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-indie-dev-cast",
    account_id: "acc-freshrss",
    folder_id: "folder-video",
    remote_id: null,
    title: "Indie Dev Cast",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=mock-indie-dev-cast",
    site_url: "https://www.youtube.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
] satisfies readonly FeedDto[];

const mockTagSeedsEn = [
  { id: "tag-important", name: "important", color: "#cf7868" },
  { id: "tag-read-later", name: "read later", color: "#6f8eb8" },
  { id: "tag-work", name: "work", color: "#5f9670" },
] satisfies readonly TagDto[];

const mockArticleTagSeedsEn = [
  { article_id: "art-en-1", tag_id: "tag-important" },
  { article_id: "art-en-1", tag_id: "tag-work" },
  { article_id: "art-en-4", tag_id: "tag-read-later" },
] satisfies readonly MockArticleTag[];

const longReaderKeyboardContentEn = Array.from({ length: 18 }, (_, index) => {
  const sectionNumber = index + 1;
  return `<p>Long-scroll verification section ${sectionNumber}. This body text is long enough to confirm that, while the reader pane has focus, pressing the up and down arrow keys only scrolls the reader's own scroll region. It gives enough content to observe scrollTop changes in both the browser preview and the desktop app.</p>`;
}).join("");

const mockArticleSeedsEn = [
  createMockArticleEn({
    id: "art-en-1",
    feedId: "feed-tech-digest",
    title: "Small language models are quietly getting good enough for real workloads",
    summary:
      "A wave of compact, efficient models is closing the gap with much larger ones on everyday tasks, shifting the calculus for teams weighing cost against capability.",
    contentHtml:
      "<p>A wave of compact, efficient models is closing the gap with much larger ones on everyday tasks.</p><p>Teams that once defaulted to the biggest available model are increasingly running evaluations first, and picking the smallest model that clears the bar for their use case.</p>",
    url: "https://example.com/tech-digest/small-models-good-enough",
    author: "Tech Digest Staff",
    date: now,
    hours: 9,
    minutes: 12,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-2",
    feedId: "feed-tech-digest",
    title: "A weekend project turned into a widely used open-source CLI tool",
    summary:
      "What started as a personal script to automate a repetitive task has grown into a small but actively maintained open-source project with contributors from several time zones.",
    url: "https://example.com/tech-digest/weekend-project-cli",
    author: "Tech Digest Staff",
    date: now,
    hours: 8,
    minutes: 5,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-3",
    feedId: "feed-dev-weekly",
    title: "Why teams are rethinking their end-to-end test suites this year",
    summary:
      "Slow, flaky end-to-end tests are pushing more teams toward a layered testing strategy that leans harder on fast unit and component tests.",
    contentHtml: longReaderKeyboardContentEn,
    url: "https://example.com/dev-weekly/rethinking-e2e-tests",
    author: "Dev Weekly Editors",
    date: yesterday,
    hours: 19,
    minutes: 40,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-4",
    feedId: "feed-systems-journal",
    title: "A practical guide to picking a message queue for a growing service",
    summary:
      "Choosing between a lightweight queue and a full-blown streaming platform comes down to a handful of concrete questions about throughput, ordering, and operational cost.",
    url: "https://example.com/systems-journal/picking-a-message-queue",
    author: "The Systems Journal",
    date: yesterday,
    hours: 11,
    minutes: 15,
    isRead: false,
    isStarred: true,
  }),
  createMockArticleEn({
    id: "art-en-5",
    feedId: "feed-frontend-notes",
    title: "Component libraries are converging on the same handful of patterns",
    summary:
      "Looking across popular design systems, the same primitives keep showing up: composable slots, headless logic, and a small set of accessible base components.",
    url: "https://example.com/frontend-notes/component-libraries-converging",
    author: "Frontend Notes",
    date: now,
    hours: 16,
    minutes: 22,
    isRead: true,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-6",
    feedId: "feed-daily-signal-wire",
    title: "Remote work surveys show a plateau after years of steady change",
    summary:
      "The latest round of workplace surveys suggests attitudes toward remote and hybrid arrangements have stabilized after several years of rapid shifts.",
    url: "https://example.com/daily-signal-wire/remote-work-plateau",
    author: "Daily Signal Wire",
    date: now,
    hours: 14,
    minutes: 50,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-7",
    feedId: "feed-north-star-report",
    title: "A quiet year for hardware upgrades, and why that might be fine",
    summary:
      "Year-over-year performance gains have slowed across consumer hardware, prompting a broader conversation about what upgrades are actually worth it anymore.",
    url: "https://example.com/north-star-report/quiet-hardware-year",
    author: "North Star Report",
    date: now,
    hours: 10,
    minutes: 30,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-8",
    feedId: "feed-dev-weekly",
    title: "A short history of the build tool wars, and where things settled",
    summary:
      "A look back at the last decade of JavaScript build tooling churn, and a case for why the ecosystem finally feels like it is converging.",
    url: "https://example.com/dev-weekly/build-tool-wars-history",
    author: "Dev Weekly Editors",
    date: yesterday,
    hours: 13,
    minutes: 5,
    isRead: false,
    isStarred: true,
  }),
  createMockArticleEn({
    id: "art-en-9",
    feedId: "feed-tech-digest",
    title: "Battery-life claims are getting more honest, testers say",
    summary:
      "Independent reviewers report that manufacturer battery-life claims track much closer to real-world usage than they did a few product generations ago.",
    url: "https://example.com/tech-digest/battery-life-claims-honest",
    author: "Tech Digest Staff",
    date: now,
    hours: 7,
    minutes: 48,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-10",
    feedId: "feed-systems-journal",
    title: "The case for boring infrastructure, revisited",
    summary:
      "A recurring argument in the systems community: pick well-understood, unglamorous tools for anything load-bearing, and save the novel stuff for the edges.",
    url: "https://example.com/systems-journal/boring-infrastructure-revisited",
    author: "The Systems Journal",
    date: now,
    hours: 6,
    minutes: 40,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-11",
    feedId: "feed-north-star-report",
    title: "Local-first apps are having a moment again",
    summary:
      "Renewed interest in offline-capable, sync-friendly app architectures is bringing local-first patterns back into mainstream conversation.",
    url: "https://example.com/north-star-report/local-first-apps-moment",
    author: "North Star Report",
    date: now,
    hours: 12,
    minutes: 10,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-12",
    feedId: "feed-daily-signal-wire",
    title: "A gentle explainer on why your feed reader shows unread counts differently",
    summary:
      "Different feed readers count unread items differently depending on sync timing and read-state propagation, which explains some of the confusion around badge numbers.",
    url: "https://example.com/daily-signal-wire/unread-count-explainer",
    author: "Daily Signal Wire",
    date: now,
    hours: 9,
    minutes: 5,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-13",
    feedId: "feed-frontend-notes",
    title: "Reduced motion support is finally a default consideration, not an afterthought",
    summary:
      "More teams are treating prefers-reduced-motion as a baseline requirement for animations rather than a nice-to-have accessibility patch.",
    url: "https://example.com/frontend-notes/reduced-motion-default",
    author: "Frontend Notes",
    date: yesterday,
    hours: 17,
    minutes: 20,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-14",
    feedId: "feed-frontend-notes",
    title: "Design tokens are the least exciting, most useful thing you'll adopt this year",
    summary:
      "A practical look at how design tokens quietly reduce inconsistency between design and implementation once teams commit to using them everywhere.",
    url: "https://example.com/frontend-notes/design-tokens-useful",
    author: "Frontend Notes",
    date: yesterday,
    hours: 15,
    minutes: 4,
    isRead: false,
    isStarred: false,
  }),
  createMockArticleEn({
    id: "art-en-15",
    feedId: "feed-video-lab",
    title: "This week's build-along stream recap, with viewer questions answered",
    summary:
      "Highlights from this week's live build-along session, including the questions viewers asked most often in chat.",
    url: "https://www.youtube.com/watch?v=mock-video-lab-1",
    author: "Video Lab",
    date: yesterday,
    hours: 11,
    minutes: 10,
    isRead: false,
    isStarred: false,
    thumbnail: null,
  }),
  createMockArticleEn({
    id: "art-en-16",
    feedId: "feed-indie-dev-cast",
    title: "Weekend co-op games worth playing in short sessions",
    summary:
      "A roundup of low-commitment co-op games that are easy to pick up with friends for a quick session, sorted by typical playtime.",
    url: "https://www.youtube.com/watch?v=mock-indie-dev-cast-1",
    author: "Indie Dev Cast",
    date: yesterday,
    hours: 10,
    minutes: 42,
    isRead: false,
    isStarred: false,
    thumbnail: null,
  }),
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
    isRead: true,
    isStarred: false,
  }),
] satisfies readonly ArticleDto[];

export const mockDataSeedsEn: DevMockSeedState = {
  accounts: mockAccountSeedsEn,
  folders: mockFolderSeedsEn,
  feeds: mockFeedSeedsEn,
  tags: mockTagSeedsEn,
  articleTags: mockArticleTagSeedsEn,
  articles: mockArticleSeedsEn,
};
