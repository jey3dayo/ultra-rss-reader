/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 * Pre-populated with realistic data for UI development.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, ArticleDto, FeedDto } from "./api/tauri-commands";

// --- Pre-populated mock data (based on v0 mock) ---

const mockAccounts: AccountDto[] = [
  { id: "acc-freshrss", kind: "FreshRss", name: "FreshRSS" },
  { id: "acc-local", kind: "Local", name: "Local" },
];

const mockFeeds: FeedDto[] = [
  {
    id: "feed-automaton",
    account_id: "acc-freshrss",
    title: "AUTOMATON",
    url: "https://automaton-media.com/feed/",
    unread_count: 199,
  },
  {
    id: "feed-hatima",
    account_id: "acc-freshrss",
    title: "はちま起稿",
    url: "https://esuteru.com/feed/",
    unread_count: 239,
  },
  {
    id: "feed-yumenavi",
    account_id: "acc-freshrss",
    title: "ゆめ痛 -News Alert-",
    url: "https://yumenavi.info/feed/",
    unread_count: 152,
  },
  {
    id: "feed-publickey",
    account_id: "acc-freshrss",
    title: "Publickey",
    url: "https://www.publickey1.jp/atom.xml",
    unread_count: 70,
  },
  {
    id: "feed-techno",
    account_id: "acc-freshrss",
    title: "techno-edge",
    url: "https://www.techno-edge.net/rss/",
    unread_count: 1,
  },
  {
    id: "feed-nhk",
    account_id: "acc-freshrss",
    title: "NHKニュース",
    url: "https://www.nhk.or.jp/rss/news/cat0.xml",
    unread_count: 187,
  },
  {
    id: "feed-hatena",
    account_id: "acc-freshrss",
    title: "はてブ 人気エントリー",
    url: "https://b.hatena.ne.jp/hotentry/it.rss",
    unread_count: 432,
  },
  {
    id: "feed-jxck",
    account_id: "acc-freshrss",
    title: "blog.jxck.io",
    url: "https://blog.jxck.io/entries/feed",
    unread_count: 1,
  },
  {
    id: "feed-npaka",
    account_id: "acc-freshrss",
    title: "npaka",
    url: "https://note.com/npaka/rss",
    unread_count: 128,
  },
  {
    id: "feed-chimolog",
    account_id: "acc-freshrss",
    title: "ちもろぐ",
    url: "https://chimolog.co/feed/",
    unread_count: 1,
  },
];

const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);

const mockArticles: ArticleDto[] = [
  {
    id: "art-1",
    feed_id: "feed-automaton",
    title: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。弾幕へのこだわりがすごい",
    content_sanitized:
      "<p>『SAROS』のクリエイティブディレクターのGregory Louden氏へのメディア合同インタビューが行われた。</p><p>本作は、Housemarque開発の高難度3D弾幕ローグライトシューターだ。プレイヤーは宇宙探査船SARUSのパイロットとして、謎の異星生物が待ち受ける未知の惑星を探索する。</p><p>インタビューでは、『Returnal』との違いや、弾幕ゲームとしてのこだわりについて語られた。開発チームは「弾幕を避ける」だけでなく「弾幕と触れ合う」新しい体験を目指しているという。</p>",
    url: "https://automaton-media.com/articles/interviewsjp/saros-interview/",
    author: "TAKAYUKI SAWAHATA",
    published_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 7).toISOString(),
    thumbnail: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=300&fit=crop",
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-2",
    feed_id: "feed-automaton",
    title: "人気海上街づくりサバイバルシム『Havendock』が期間限定で無料配布開始。Epic Gamesストアにて",
    content_sanitized:
      "<p>人気海上街づくりサバイバルシム『Havendock』がEpic Gamesストアにて無料配布中です。3月28日までの期間限定。</p>",
    url: "https://automaton-media.com/articles/newsjp/havendock-free/",
    author: "AUTOMATON編集部",
    published_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30).toISOString(),
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop",
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-3",
    feed_id: "feed-automaton",
    title: "大盛況オープンワールド『紅の砂漠』、やたら「木」が強いと話題に。丸太を持ったら、ボスさえ一撃",
    content_sanitized:
      "<p>オープンワールドゲーム『紅の砂漠』で、木を使った意外な攻略法が発見されました。なんと丸太を持つだけでボスを一撃で倒せるとのこと。</p>",
    url: "https://automaton-media.com/articles/newsjp/crimson-desert-tree/",
    author: "AUTOMATON編集部",
    published_at: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 18, 24).toISOString(),
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop",
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-4",
    feed_id: "feed-publickey",
    title: "PostgreSQL 18ベータ版が登場、仮想生成カラムやJSONパス機能が追加。パフォーマンス改善も多数",
    content_sanitized:
      "<p>PostgreSQL Global Development Groupは、PostgreSQL 18の最初のベータ版をリリースしました。</p><p>仮想生成カラムやJSONパス機能など、多くの新機能が追加されています。また、パフォーマンスの改善も多数含まれています。</p>",
    url: "https://www.publickey1.jp/blog/26/postgresql_18.html",
    author: "Publickey編集部",
    published_at: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 10, 0).toISOString(),
    thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=300&fit=crop",
    is_read: false,
    is_starred: true,
  },
  {
    id: "art-5",
    feed_id: "feed-hatena",
    title: "生成AIで誰でもオシャレなパワポを作る方法 - Qiita",
    content_sanitized:
      "<p>はじめに こんにちは！AIエンジニアのヤマゾーです。突然ですが、このたび生成AIプロジェクトに関わる人に向けた技術書を出版しました。</p><p>細部まで拘って約1年かけて書いたこともあり、周りからも「図解がわかりやすい」「断片的な知識が繋がった」とかなり好評でした。</p>",
    url: "https://qiita.com/yamazombie/items/example",
    author: "@yamazombie",
    published_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 8).toISOString(),
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
  {
    id: "art-6",
    feed_id: "feed-hatena",
    title: "競馬場で喜ぶCMは封幸心おある、選挙期間に競馬広告「ほとんどの方が馬券外れている」",
    content_sanitized: "<p>競馬場のCMについての考察記事です。</p>",
    url: "https://example.com/keiba",
    author: null,
    published_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 56).toISOString(),
    thumbnail: "https://images.unsplash.com/photo-1529927120475-1f638e42f5c3?w=400&h=300&fit=crop",
    is_read: true,
    is_starred: false,
  },
  {
    id: "art-7",
    feed_id: "feed-nhk",
    title: "【地震速報】岩手で震度4 津波被害の心配なし",
    content_sanitized: "<p>26日午前、岩手県で震度4の地震がありました。この地震による津波の心配はありません。</p>",
    url: "https://www3.nhk.or.jp/news/html/example.html",
    author: "NHK",
    published_at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30).toISOString(),
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-8",
    feed_id: "feed-npaka",
    title: "Claude 4.5 Sonnet の新機能まとめ - 実践的な使い方ガイド",
    content_sanitized:
      "<p>Claude 4.5 Sonnetがリリースされました。主な新機能と実践的な使い方をまとめます。</p><p>1. 拡張されたコンテキストウィンドウ</p><p>2. 改善されたコーディング能力</p><p>3. マルチモーダル理解の向上</p>",
    url: "https://note.com/npaka/n/example",
    author: "npaka",
    published_at: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 14, 0).toISOString(),
    thumbnail: null,
    is_read: false,
    is_starred: true,
  },
];

let nextAccountId = 100;
let nextFeedId = 100;

export function setupDevMocks() {
  if (window.__TAURI_INTERNALS__) return;

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown>;

    switch (cmd) {
      case "list_accounts":
        return mockAccounts;

      case "add_account": {
        const account: AccountDto = {
          id: `dev-acc-${nextAccountId++}`,
          kind: String(args.kind ?? "Local"),
          name: String(args.name ?? "Dev Account"),
        };
        mockAccounts.push(account);
        return account;
      }

      case "delete_account": {
        const idx = mockAccounts.findIndex((a) => a.id === args.accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        return null;
      }

      case "list_feeds":
        return mockFeeds.filter((f) => f.account_id === args.accountId);

      case "add_local_feed": {
        const feedId = `dev-feed-${nextFeedId++}`;
        const feedUrl = String(args.url ?? "");
        // Derive a readable title from the URL (real backend parses RSS <title>)
        const titleFromUrl = (() => {
          try {
            const u = new URL(feedUrl);
            return u.hostname.replace(/^www\./, "");
          } catch {
            return feedUrl;
          }
        })();
        const feed: FeedDto = {
          id: feedId,
          account_id: String(args.accountId),
          title: titleFromUrl,
          url: feedUrl,
          unread_count: 3,
        };
        mockFeeds.push(feed);
        // Generate sample articles for the new feed
        const now = new Date();
        for (let i = 0; i < 3; i++) {
          const pubDate = new Date(now);
          pubDate.setHours(pubDate.getHours() - i);
          mockArticles.push({
            id: `${feedId}-art-${i}`,
            feed_id: feedId,
            title: `Sample article ${i + 1} from ${feedUrl}`,
            content_sanitized: `<p>This is a sample article fetched from ${feedUrl}.</p>`,
            url: `${feedUrl}#article-${i}`,
            author: null,
            published_at: pubDate.toISOString(),
            thumbnail: null,
            is_read: false,
            is_starred: false,
          });
        }
        return feed;
      }

      case "list_articles": {
        const feedId = args.feedId as string;
        return mockArticles.filter((a) => a.feed_id === feedId);
      }

      case "search_articles":
        return mockArticles.filter((a) => a.title.toLowerCase().includes(String(args.query ?? "").toLowerCase()));

      case "mark_article_read": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_read = true;
        return null;
      }

      case "toggle_article_star": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_starred = args.starred as boolean;
        return null;
      }

      case "trigger_sync":
      case "open_in_browser":
      case "import_opml":
        return null;

      default:
        return null;
    }
  });
}
