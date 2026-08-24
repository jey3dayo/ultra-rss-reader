<div align="center">

<img src="assets/app-icon.png" alt="Ultra RSS Reader" width="128" height="128" />

# Ultra RSS Reader

**フィードは、あなたの手元に。** キーボード操作中心のデスクトップ RSS リーダー。全文検索はオフラインで動き、FreshRSS と同期できます。アカウント不要・クラウド不要・サブスク不要。

[![Latest release](https://img.shields.io/github/v/release/jey3dayo/ultra-rss-reader)](https://github.com/jey3dayo/ultra-rss-reader/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/jey3dayo/ultra-rss-reader/total)](https://github.com/jey3dayo/ultra-rss-reader/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)

[**ultra-rss.jey3dayo.net**](https://ultra-rss.jey3dayo.net/ja/) • [ダウンロード](#インストール) • [機能](#機能) • [キーボードショートカット](#キーボードショートカット) • [English](README.md)

</div>

![3ペインリーダー（ライトテーマ）](docs/assets/screenshot-reader-light.jpg)

<details>
<summary>ダークテーマ</summary>

![3ペインリーダー（ダークテーマ）](docs/assets/screenshot-reader-dark.jpg)

</details>

## なぜ Ultra RSS Reader?

- ローカルファースト、アカウント不要 — 全記事が組み込み SQLite に保存され、FTS5 全文検索がオフラインで動作します。
- FreshRSS 同期 — Google Reader API 経由で FreshRSS サーバーと接続。既読・スターは双方向同期し、ローカルの未送信変更が古いリモート状態で巻き戻されないよう保護されます。
- 認証情報は OS キーリングへ — パスワードやトークンは Keychain / Credential Manager / Secret Service に保存され、データベースには入りません。
- キーボード駆動 — `j`/`k` ナビゲーション、単キーアクション、任意のフィードへ直接ジャンプできる `⌘K` コマンドパレット。バインドはすべてカスタマイズ可能です。
- リーディングフローを離れず元ページを閲覧 — Web Preview が配信元ページをアプリ内に埋め込み、専用のブラウザ操作を提供します。

## 他のリーダーとの違い

優れた RSS リーダーは他にもたくさんあり、何を重視するかで最適解は変わります。

Ultra RSS Reader は、記事のアーカイブを自分のマシンに置いておきたい人、そして手をキーボードから離したくない人のために作っています。取得した記事はすべてローカルの SQLite に残り、オフラインで全文検索できます。同期は任意で、自分の FreshRSS サーバーに向けることも、アカウントなしで使うこともできます。MIT ライセンスの無料ソフトウェアです。

Apple プラットフォームで完成度の高いネイティブリーダーが欲しいなら [NetNewsWire](https://netnewswire.com/) や [Reeder](https://reederapp.com/) が優れています。モバイルアプリや記事推薦を含むホスティング型サービスが欲しいなら [Feedly](https://feedly.com/) や [Inoreader](https://www.inoreader.com/) の方が向いています。Ultra RSS Reader はホスティング側の機能を意図的に持ちません。

## インストール

最新のインストーラは [**GitHub Releases**](https://github.com/jey3dayo/ultra-rss-reader/releases/latest) からダウンロードできます。

| プラットフォーム | アーティファクト |
| --- | --- |
| macOS (Apple Silicon) | `.dmg` |
| Windows | `.exe` / `.msi` |

> **macOS 注意**: 現在リリースは ad-hoc 署名（Apple Developer ID なし）のため、初回起動時に Gatekeeper の警告が出ます。アプリを右クリック →「開く」、または `xattr -dr com.apple.quarantine "/Applications/Ultra RSS Reader.app"` を実行してください。

ソースからのビルドは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## 機能

- 📡 **マルチプロバイダ** — ローカル RSS/Atom フィードと FreshRSS（Google Reader API）
- 🔍 **全文検索** — SQLite FTS5 による全記事の即時・オフライン検索
- 🔄 **同期** — バックグラウンド定期同期、復帰時同期、手動トリガー、既読・スターの双方向 pending mutation
- 🗂️ **フォルダとタグ** — フィードのフォルダ整理、記事タグ、ミュートキーワード
- 🧭 **コマンドパレット** — `⌘K` / `Ctrl+K`、`@` 入力で購読フィードへジャンプ
- 🌐 **Web Preview** — 配信元ページをアプリ内に埋め込み表示
- 🧹 **購読レビュー** — 停滞フィードを検出し Keep / Later / 解除を判断できる購読一覧ワークスペース
- 📥 **OPML** — フィードリストのインポート・エクスポート
- ⚡ **Bionic reading** — 速読向けの強調表示レンダリング
- 🎨 **テーマ** — システム連動のライト/ダーク、OKLch カラートークン
- 🇯🇵 **日本語ローカライズ** — 機械翻訳でない、調整された日本語 UI
- 🔐 **セキュアな既定値** — HTML は Rust 側でサニタイズしてから描画、認証情報は SQLite に触れない

## キーボードショートカット

すべて設定でカスタマイズ可能。既定値:

| キー | 動作 | キー | 動作 |
| --- | --- | --- | --- |
| `j` / `k` | 次 / 前の記事 | `m` | 既読切替 |
| `h` / `l` | 前 / 次のフィード | `s` | スター切替 |
| `Space` / `Shift+Space` | 記事スクロール | `a` | すべて既読 |
| `v` | アプリ内ブラウザで開く | `b` | 外部ブラウザで開く |
| `/` | 検索 | `f` | フィルタ切替 |
| `⌘1` / `⌘2` / `⌘3` | 未読 / すべて / スター | `u` | サイドバーへフォーカス |
| `⌘K` | コマンドパレット | `⌘\` | サイドバー表示切替 |
| `Esc` | 閉じる / クリア | `⌘,` | 設定 |

## 技術スタック

Tauri 2 (Rust) · React 19 · TypeScript · SQLite (rusqlite + FTS5) · Tailwind CSS v4 · Zustand + TanStack Query

アーキテクチャ、開発モード、検証コマンドの詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ロードマップ

現時点で予定しているもの(おおよその順序):

- インストールの摩擦解消 — macOS の署名・notarization に加えて Homebrew cask と winget 対応。初回起動で Gatekeeper の回避操作が不要になる。これはパッケージング側ではなく Developer ID 署名証明書の取得が前提になっている
- Microsoft Store 配布([#57](https://github.com/jey3dayo/ultra-rss-reader/issues/57))

Linux パッケージングは release workflow の opt-in 入力 `build_linux`(既定 off)として利用でき、必要なときに `.deb` / `.AppImage` を生成します。配布済みの Linux インストール経路はまだないため、上記のインストール表は macOS と Windows のままです。Feedly 同期は予定していません。

## コントリビュート

コントリビュート歓迎です。[CONTRIBUTING.md](CONTRIBUTING.md) のセットアップ（`mise install && pnpm install && mise run app:dev`）、アーキテクチャ、品質ゲートから始めてください。運用ドキュメントは [docs/](docs/README.md) にあります。

## ライセンス

[MIT](LICENSE)
