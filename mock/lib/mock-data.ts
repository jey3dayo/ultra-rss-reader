export interface Feed {
  id: string
  name: string
  icon: string
  unreadCount: number
  folderId: string
}

export interface Folder {
  id: string
  name: string
  isExpanded: boolean
}

export interface Article {
  id: string
  feedId: string
  feedName: string
  feedIcon: string
  title: string
  summary: string
  content: string
  author: string
  date: string
  dateGroup: string
  thumbnail?: string
  isRead: boolean
  isStarred: boolean
}

export const folders: Folder[] = [
  { id: "comic", name: "Comic", isExpanded: false },
  { id: "misc", name: "Misc", isExpanded: true },
  { id: "must-read", name: "Must Read", isExpanded: true },
  { id: "news", name: "News", isExpanded: true },
  { id: "tech", name: "Tech", isExpanded: true },
  { id: "youtube", name: "YouTube", isExpanded: false },
]

export const feeds: Feed[] = [
  { id: "automaton", name: "AUTOMATON", icon: "A", unreadCount: 199, folderId: "misc" },
  { id: "hatima", name: "はちま起稿", icon: "起", unreadCount: 239, folderId: "misc" },
  { id: "yumenavi", name: "ゆめ鬼 -News Alert-", icon: "夢", unreadCount: 162, folderId: "misc" },
  { id: "publickey", name: "Publickey", icon: "P", unreadCount: 70, folderId: "must-read" },
  { id: "techno-edge", name: "techno-edge", icon: "T", unreadCount: 1, folderId: "must-read" },
  { id: "nhk", name: "NHKニュース", icon: "N", unreadCount: 194, folderId: "news" },
  { id: "hatena", name: "はてブ 人気エントリー", icon: "B", unreadCount: 201, folderId: "news" },
  { id: "blog-jxck", name: "blog.jxck.io", icon: "J", unreadCount: 1, folderId: "tech" },
  { id: "npaka", name: "npaka", icon: "n", unreadCount: 128, folderId: "tech" },
  { id: "chimolog", name: "ちもろぐ", icon: "ち", unreadCount: 1, folderId: "tech" },
]

export const articles: Article[] = [
  {
    id: "1",
    feedId: "automaton",
    feedName: "AUTOMATON",
    feedIcon: "A",
    title: "SIE 新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。『Returnal』の「弾幕を避ける」ゲームから「弾幕と触れ合う」ゲームへ、弾幕へのこだわりがすごい",
    summary: "『SAROS』のクリエイティブディレクターのGregory Louden氏、アートディレクターのSimone Silvestri氏へのメディア合同インタビューが行われた。",
    content: `『SAROS』のクリエイティブディレクターのGregory Louden氏、アートディレクターのSimone Silvestri氏へのメディア合同インタビューが行われた。

本作は、Housemarque開発の高難度3D弾幕ローグライトシューターだ。プレイヤーは宇宙探査船SARUSのパイロットとして、謎の異星生物が待ち受ける未知の惑星を探索する。

インタビューでは、『Returnal』との違いや、弾幕ゲームとしてのこだわりについて語られた。開発チームは「弾幕を避ける」だけでなく「弾幕と触れ合う」新しい体験を目指しているという。`,
    author: "TAKAYUKI SAWAHATA",
    date: "2026-03-27T09:07:00",
    dateGroup: "TODAY",
    thumbnail: "https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=300&fit=crop",
    isRead: false,
    isStarred: false,
  },
  {
    id: "2",
    feedId: "automaton",
    feedName: "AUTOMATON",
    feedIcon: "A",
    title: "高難度3D弾幕ローグライトシューター『SAROS』先行プレイ感想。「回避」も「位置取り」も「強化」も全部重要、難しさはそのまま裾野広げた『Returnal』開発新作",
    summary: "『Returnal』の流れを汲むゲーム性と、独自の進化を遂げたシステムについてレポート。",
    content: "高難度3D弾幕ローグライトシューター『SAROS』の先行プレイレポートをお届けします。",
    author: "AUTOMATON編集部",
    date: "2026-03-27T00:00:00",
    dateGroup: "TODAY",
    thumbnail: "https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&h=300&fit=crop",
    isRead: false,
    isStarred: false,
  },
  {
    id: "3",
    feedId: "automaton",
    feedName: "AUTOMATON",
    feedIcon: "A",
    title: "人気海上街づくりサバイバルシム『Havendock』が期間限定で無料配布開始。Epic Gamesストアにて、合計3240円分の2本立て配布中",
    summary: "Epic Gamesストアにて3月28日までの期間限定で無料配布中。",
    content: "人気海上街づくりサバイバルシム『Havendock』がEpic Gamesストアにて無料配布中です。",
    author: "AUTOMATON編集部",
    date: "2026-03-27T00:00:00",
    dateGroup: "TODAY",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop",
    isRead: false,
    isStarred: false,
  },
  {
    id: "4",
    feedId: "automaton",
    feedName: "AUTOMATON",
    feedIcon: "A",
    title: "大盛況オープンワールド『紅の砂漠』、やたら「木」が強いと話題に。丸太を持ったら、ボスさえ一撃",
    summary: "『紅の砂漠』における一風変わった攻略法が話題に。",
    content: "オープンワールドゲーム『紅の砂漠』で、木を使った意外な攻略法が発見されました。",
    author: "AUTOMATON編集部",
    date: "2026-03-26T18:24:00",
    dateGroup: "YESTERDAY",
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop",
    isRead: false,
    isStarred: false,
  },
  {
    id: "5",
    feedId: "publickey",
    feedName: "Publickey",
    feedIcon: "P",
    title: "PostgreSQL 18ベータ版が登場、仮想生成カラムやJSONパス機能が追加。パフォーマンス改善も多数",
    summary: "PostgreSQL Global Development Groupは、PostgreSQL 18の最初のベータ版をリリースしました。",
    content: "PostgreSQL 18ベータ版では、仮想生成カラムやJSONパス機能など、多くの新機能が追加されています。",
    author: "Publickey編集部",
    date: "2026-03-26T10:00:00",
    dateGroup: "YESTERDAY",
    thumbnail: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&h=300&fit=crop",
    isRead: false,
    isStarred: true,
  },
]

export const accounts = [
  { id: "inoreader", name: "Inoreader", email: "j138cm@gmail.com", icon: "circle" },
  { id: "freshrss", name: "FreshRSS", email: "jey3dayo", icon: "rss" },
]
