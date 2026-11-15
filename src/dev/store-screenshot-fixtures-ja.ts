import type { AccountDto, ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import hillsThumbnail from "@/dev/assets/demo-thumbnails/hills.svg?no-inline";
import ringsThumbnail from "@/dev/assets/demo-thumbnails/rings.svg?no-inline";
import stripesThumbnail from "@/dev/assets/demo-thumbnails/stripes.svg?no-inline";
import wavesThumbnail from "@/dev/assets/demo-thumbnails/waves.svg?no-inline";
import {
  createMockArticle,
  type DevMockSeedState,
  type MockArticleTag,
  type RelativeMockArticlePublishedAtMap,
} from "@/dev/mock-data-shared";
import { addLocalDays, getCurrentDate } from "@/lib/datetime";

const now = getCurrentDate();
const yesterday = addLocalDays(now, -1);
const fallbackNote =
  "これは画面表示と操作感を確認するための架空の記事です。実在する配信元やサービスとは関係ありません。";

export const relativeStoreScreenshotPublishedAtJa: RelativeMockArticlePublishedAtMap = {
  "art-en-1": { dayOffset: 0, hours: 9, minutes: 12 },
  "art-en-2": { dayOffset: 0, hours: 8, minutes: 5 },
  "art-en-3": { dayOffset: 0, hours: 9, minutes: 30 },
  "art-en-4": { dayOffset: -1, hours: 11, minutes: 15 },
  "art-en-5": { dayOffset: 0, hours: 16, minutes: 22 },
  "art-en-6": { dayOffset: 0, hours: 14, minutes: 50 },
  "art-en-7": { dayOffset: 0, hours: 10, minutes: 30 },
  "art-en-8": { dayOffset: -1, hours: 13, minutes: 5 },
};

const accounts = [
  {
    id: "acc-freshrss",
    kind: "FreshRss",
    name: "個人用",
    username: "reader",
    server_url: "https://reader.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    keep_read_items_days: 30,
  },
  {
    id: "acc-local",
    kind: "Local",
    name: "ローカル",
    username: null,
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
] satisfies readonly AccountDto[];

const folders = [
  { id: "folder-tech", account_id: "acc-freshrss", name: "技術", sort_order: 0 },
  { id: "folder-news", account_id: "acc-freshrss", name: "ニュース", sort_order: 1 },
  { id: "folder-dev", account_id: "acc-freshrss", name: "開発", sort_order: 2 },
  { id: "folder-video", account_id: "acc-freshrss", name: "動画", sort_order: 3 },
] satisfies readonly FolderDto[];

const feeds = [
  {
    id: "feed-tech-digest",
    account_id: "acc-freshrss",
    folder_id: "folder-tech",
    remote_id: null,
    title: "技術の小窓",
    url: "https://example.com/tech-window/feed",
    site_url: "https://example.com/tech-window",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-systems-journal",
    account_id: "acc-freshrss",
    folder_id: "folder-tech",
    remote_id: null,
    title: "仕組みの読みもの",
    url: "https://example.com/systems-notes/feed",
    site_url: "https://example.com/systems-notes",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-daily-signal-wire",
    account_id: "acc-freshrss",
    folder_id: "folder-news",
    remote_id: null,
    title: "今日の小窓",
    url: "https://example.com/daily-window/feed",
    site_url: "https://example.com/daily-window",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-north-star-report",
    account_id: "acc-freshrss",
    folder_id: "folder-news",
    remote_id: null,
    title: "北極星レポート",
    url: "https://example.com/north-star/feed",
    site_url: "https://example.com/north-star",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-dev-weekly",
    account_id: "acc-freshrss",
    folder_id: "folder-dev",
    remote_id: null,
    title: "開発だより",
    url: "https://example.com/dev-letter/feed",
    site_url: "https://example.com/dev-letter",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-frontend-notes",
    account_id: "acc-freshrss",
    folder_id: "folder-dev",
    remote_id: null,
    title: "画面づくりノート",
    url: "https://example.com/ui-notes/feed",
    site_url: "https://example.com/ui-notes",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-video-lab",
    account_id: "acc-freshrss",
    folder_id: "folder-video",
    remote_id: null,
    title: "動画工房",
    url: "https://video.example.com/feeds/video-studio",
    site_url: "https://video.example.com",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
  {
    id: "feed-indie-dev-cast",
    account_id: "acc-freshrss",
    folder_id: "folder-video",
    remote_id: null,
    title: "個人開発ラジオ",
    url: "https://video.example.com/feeds/indie-radio",
    site_url: "https://video.example.com",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  },
] satisfies readonly FeedDto[];

const tags = [
  { id: "tag-important", name: "重要", color: "#cf7868" },
  { id: "tag-read-later", name: "あとで読む", color: "#6f8eb8" },
  { id: "tag-work", name: "仕事", color: "#5f9670" },
] satisfies readonly TagDto[];

const articleTags = [
  { article_id: "art-en-1", tag_id: "tag-important" },
  { article_id: "art-en-1", tag_id: "tag-work" },
  { article_id: "art-en-4", tag_id: "tag-read-later" },
] satisfies readonly MockArticleTag[];

const showcaseContent = [
  "<p>テストの見直しに取り組んだチームは、一度に作り替えるのではなく、少しずつ整えていったと話します。変更のたびに不安定なチェックを減らし、必要な確認を残す方法です。</p>",
  "<h2>ツールより、担当者を決める</h2>",
  "<p>共通していたのは、失敗をすぐに調べる担当者がいることでした。担当が曖昧なテストは、失敗を放置したまま無効化されがちです。</p>",
  "<blockquote><p>遅いテストより、不安定なテストの方が信頼を失いやすい。</p></blockquote>",
  "<p>今は重要な操作に絞って、ブラウザーでの確認を続けています。</p>",
  "<ul><li>利用者に影響する操作はブラウザーで確認する</li><li>それ以外は単体テストやコンポーネントテストで素早く確かめる</li><li>失敗を調べる担当者を決める</li></ul>",
].join("");

const articles = [
  createMockArticle(
    {
      id: "art-en-1",
      feedId: "feed-tech-digest",
      title: "小さな言語モデル、日々の業務で使える性能に",
      summary: "軽量なモデルの性能が向上し、処理費用と応答品質の選び方が変わりつつあります。",
      contentHtml:
        "<p>軽量なモデルの性能が向上し、日々の業務でも使いやすくなっています。</p><p>用途に合わせて評価し、必要な性能を満たすモデルを選ぶ動きが広がっています。</p>",
      url: "https://example.com/tech-window/small-models",
      author: "技術の小窓編集部",
      date: now,
      hours: 9,
      minutes: 12,
      isRead: false,
      isStarred: false,
      thumbnail: ringsThumbnail,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-2",
      feedId: "feed-tech-digest",
      title: "週末の小さなスクリプトが、便利な道具になるまで",
      summary: "繰り返し作業を自動化する個人用スクリプトが、複数の人に使われるツールへ育ちました。",
      url: "https://example.com/tech-window/weekend-tool",
      author: "技術の小窓編集部",
      date: now,
      hours: 8,
      minutes: 5,
      isRead: false,
      isStarred: false,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-3",
      feedId: "feed-dev-weekly",
      title: "チームはなぜ E2E テストの見直しを進めているのか",
      summary: "時間がかかり不安定な E2E テストを整理し、確認の速さと信頼性を高める方法を紹介します。",
      contentHtml: showcaseContent,
      url: "https://example.com/dev-letter/rethinking-e2e-tests",
      author: "開発だより編集部",
      date: now,
      hours: 9,
      minutes: 30,
      isRead: false,
      isStarred: false,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-4",
      feedId: "feed-systems-journal",
      title: "サービスの成長に合わせたキューの選び方",
      summary: "処理量、順序の保証、運用の手間を手がかりに、キューの方式を選ぶ方法をまとめました。",
      url: "https://example.com/systems-notes/choosing-a-queue",
      author: "仕組みの読みもの",
      date: yesterday,
      hours: 11,
      minutes: 15,
      isRead: false,
      isStarred: true,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-5",
      feedId: "feed-frontend-notes",
      title: "コンポーネント設計に共通する、いくつかの考え方",
      summary: "組み合わせやすい部品、表示とロジックの分離、アクセシブルな基本要素を紹介します。",
      url: "https://example.com/ui-notes/component-patterns",
      author: "画面づくりノート",
      date: now,
      hours: 16,
      minutes: 22,
      isRead: true,
      isStarred: false,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-6",
      feedId: "feed-daily-signal-wire",
      title: "リモートワークの意識調査、変化が緩やかに",
      summary: "在宅と出社を組み合わせる働き方への意識は、急な変化を経て落ち着きつつあります。",
      url: "https://example.com/daily-window/remote-work-survey",
      author: "今日の小窓編集部",
      date: now,
      hours: 14,
      minutes: 50,
      isRead: false,
      isStarred: false,
      thumbnail: hillsThumbnail,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-7",
      feedId: "feed-north-star-report",
      title: "今年は控えめな機器更新、その理由を考える",
      summary: "性能向上が緩やかになる中で、買い替えの価値を改めて考える動きが出ています。",
      url: "https://example.com/north-star/hardware-upgrades",
      author: "北極星レポート",
      date: now,
      hours: 10,
      minutes: 30,
      isRead: false,
      isStarred: false,
      thumbnail: wavesThumbnail,
    },
    fallbackNote,
  ),
  createMockArticle(
    {
      id: "art-en-8",
      feedId: "feed-dev-weekly",
      title: "ビルドツールの変遷と、今見えてきた落ち着きどころ",
      summary: "この十年の変化を振り返り、開発環境の選択肢がどう整理されてきたかをたどります。",
      url: "https://example.com/dev-letter/build-tool-history",
      author: "開発だより編集部",
      date: yesterday,
      hours: 13,
      minutes: 5,
      isRead: false,
      isStarred: true,
      thumbnail: stripesThumbnail,
    },
    fallbackNote,
  ),
] satisfies readonly ArticleDto[];

export const storeScreenshotSeedsJa: DevMockSeedState = {
  accounts,
  folders,
  feeds,
  tags,
  articleTags,
  articles,
};
