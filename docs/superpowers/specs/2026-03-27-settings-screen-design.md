# Settings Screen — Design Specification

## Overview

Preferences画面（⌘, またはアプリメニューから開く）。
Reeder準拠の2ペイン構成。左にカテゴリ、右にコンテンツ。

## 変更点

### サイドバー

- ⚙ボタン削除
- ↻（リロード）+ +（フィード追加）のみ残す

### AddAccountDialog

- 廃止。アカウント追加はSettings > Accounts内で完結

### アカウント切り替え

- サイドバーのアカウント名ドロップダウンは維持（閲覧用の切り替え）

## Preferences画面

### レイアウト

2ペイン構成（モーダル/オーバーレイ）

```
┌────────────────────────────────────────────┐
│ ✕  Preferences                             │
├──────────┬─────────────────────────────────┤
│ General  │  （右ペイン: 選択カテゴリの内容）│
│ Accounts │                                 │
└──────────┴─────────────────────────────────┘
```

- 左サイドバー: カテゴリ一覧（General, Accounts）
- 右ペイン: 選択カテゴリの内容

### Accounts カテゴリ

#### 一覧画面

```
ACCOUNTS
┌────────────────────────────┐
│ 📡 FreshRSS    jey3dayo  >│
│ 📁 Local                  >│
└────────────────────────────┘
+ Add Account
```

#### 詳細画面（アカウントクリック時）

右ペインがスタック遷移。「← Accounts」で戻る。

```
← Accounts

FreshRSS
jey3dayo

GENERAL
Description       FreshRSS
Server            http://jey3dayo.asuscomm.com:5556/api/greader.php

SYNCING
Sync              Every hour ▾
Sync on wake      [toggle]
Keep read items   1 month ▾

⊖ Delete Account
```

#### Add Account画面

「+ Add Account」クリック時、右ペインにフォーム表示。

```
← Accounts

Add Account

Type              [Local / FreshRSS] ▾
Name              [入力]
Server URL        [入力]  (FreshRSSの場合)
Username          [入力]  (FreshRSSの場合)

[Add]
```

### General カテゴリ（MVP）

MVPでは最小限。将来の拡張用プレースホルダー。

```
GENERAL
Version           0.1.0
```

## コンポーネント構成

```
src/components/settings/
├── SettingsModal.tsx        # モーダルコンテナ（⌘,で開閉）
├── SettingsSidebar.tsx      # 左ペイン（General, Accounts）
├── GeneralSettings.tsx      # General カテゴリの内容
├── AccountsSettings.tsx     # Accounts 一覧
├── AccountDetail.tsx        # アカウント詳細 + Delete
└── AddAccountForm.tsx       # アカウント追加フォーム
```

## 開閉トリガー

- `⌘,` キーボードショートカット
- Tauriアプリメニュー（Preferences...）

## UI State

Zustand storeに追加:

```typescript
settingsOpen: boolean;
settingsCategory: 'general' | 'accounts';
settingsAccountId: string | null;  // null=一覧, string=詳細
settingsAddAccount: boolean;       // Add Account フォーム表示

openSettings: () => void;
closeSettings: () => void;
```
