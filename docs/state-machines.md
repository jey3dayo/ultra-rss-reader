---
type: reference
title: Implicit State Machines Catalog
description: Catalog of implicit state machines across the frontend stores, sync and updater flows, and the Rust backend, with the phased plan to make them explicit without behavior changes.
resource: urn:ultra-rss-reader:docs:state-machines
tags: [category/reference, audience/developer, audience/agent]
timestamp: 2026-11-17
audience: developer, agent
owner: project-maintainers
---

# URR 暗黙のステートマシン 全数調査（2026-11-17）

対象: `jey3dayo/ultra-rss-reader` @ `4bd8964`（v0.67.29）
方法: 読み取り専用。コードを一切変更していない。UI層／データ・同期層／Rust側／フロー横断の4方面で grep＋実読し、主要な死に状態・未使用機構は自分で再確認済み。
前提: FSMライブラリ（xstate等）は未導入。状態管理は zustand 3ストア＋React Query＋ローカル `useState`／`useReducer`＋Rust側の Atomic／DBカラム。

## 結論：最善の判断（短く）

**結論は「FSMライブラリの全面導入はしない。既にリポジトリ内にある良い型（判別共用体）へ、導出層から寄せていく」**。理由は3つ。

1. すでに模範がある。`AccountSetupSession`（verifying は型レベルで accountId を持てない）、`ArticleViewSelectionState`（kind ごとに表示に必要なデータを型で必須化）、`PendingState`（idle/attempting/waiting/failed）。これらが「型で不可能化する」雛形として機能している。
2. 暗黙マシンの大半は「実状態を書き換える」問題ではなく「読み手ごとに再解釈している」問題。読み手側に導出関数を1箇所作るだけで、挙動を変えずに UX（表示のブレ）・DX（追跡性）・AX（エージェントが状態を再現できること）が同時に上がる。
3. 壊すリスクが高いのは DB と同期の実状態（`sync_state` 行の使い回し、`pending_mutations` の存在＝未送信、`syncing` AtomicBool の過負荷）。ここを先に触ると同期そのものが壊れる。最後に回し、マイグレーション＋テストとセットで扱う。

### 優先順位（UX × DX × AX × 破壊リスク）

| 優先度 | クラスタ | 一番効く改善 | 破壊リスク |
| --- | --- | --- | --- |
| P0 | 同期の「真実の4重化」 | 同期状態を1つの導出型に寄せる（読み手側のみ） | 低（表示層のみ） |
| P0 | アップデーターのモジュール可変状態 | 進捗・セッションID・世代の3識別子を1つの導出に | 低〜中 |
| P1 | オーバーレイ群の排他なし | 排他ルールを1箇所に集約（commandPalette×shortcutsHelp は既に先例あり） | 低 |
| P1 | リーダー／ブラウザの三重符号化 | `ArticleViewSelectionState` を正本にし、store直書き経路を減らす | 中 |
| P1 | 設定ロック・dirtyレジストリの二重化 | ロック判定の2実装を1つに、未使用の nativeLifecycleBlockers を整理 | 低 |
| P1 | 認証情報エディタ（21フィールド平坦） | ドラフトのスナップショット照合を型に寄せる | 中 |
| P2 | dev scenario で再現できない状態 | エラー・中間状態の scenario を追加（AXの要） | 低 |
| P3 | Rust: `sync_state` 行の使い回し | スコープ別に型を分ける＋CHECK（マイグレーション要） | 高 |
| P3 | Rust: `pending_mutations` | 試行カウンタ＋未知 type の隔離 | 高 |
| P3 | Rust: `syncing` AtomicBool の過負荷 | 同期／保守／updaterの排他を分離 | 高 |

### やらないこと（判断）

- xstate 等の FSM ライブラリを全画面に導入しない。既存の判別共用体パターンで十分で、導入コストと学習コストの方が大きい。
- `sync_state` のスキーマ変更や `pending_mutations` へのカラム追加をこのフェーズでやらない。マイグレーション（現行 LATEST_VERSION=29）＋既存DBの移行検証なしには触れない。
- 「壊れていないもの」を一斉に書き換えない。1クラスタずつ、導出層→テスト固定→実状態統合、の順に進める。

---

## 1. 同期系（最大クラスタ）

### 1.1 全体同期の進行状態 `SyncProgressUiState`

- 場所: 型 `src/stores/ui-store.types.ts:63-73`、遷移 `src/stores/ui-store-sync-actions.ts:96-167`、イベント源 `src/api/schemas/sync-progress.ts:19-28`
- 符号化: `active:boolean` + `stage`（started/account_started/account_finished/finished）+ `kind`（manual_all/manual_account/automatic）+ `sessionId:number|null` + `total/completed` + `activeAccountIds:Set` + `lastSettledSessionId`。idle は `getIdleSyncProgress()` の全フィールドリセットで表現。
- 遷移: Tauri イベント `SyncProgressEvent` のみ。`session_id <= lastSettledSessionId` は破棄、新セッションは単調増加ガード。`applySyncProgress` 内のガード（古いイベント無視・counts クランプ）は比較的丁寧。
- 弱点: `finished` を取りこぼすと `active:true` が永続する設計。復旧は下記 1.2 に依存。`active:true && stage:null` 等の組み合わせは型で排除できない。`kind` がアカウント詳細側で再解釈される（`account-detail.tsx:82`）。
- UX: 同期中表示が固まる／別アカウントの同期でもスピナーが回る余地。

### 1.2 同期 stuck 復旧（ストア外の第二のライフサイクル）

- 場所: `src/components/reader/hooks/sidebar/use-sidebar-sync.ts:60,291-373`
- 符号化: ローカル変数 `disposed`／`requestSequence`／`syncEventRevision` ref＋タイマー。10分イベント無し or フォアグラウンド復帰時に `getSyncState()`（`src/api/tauri-commands/sync.ts:14`、boolean 1本）を引き、false なら強制 `clearSyncProgress()`。
- 弱点: ネイティブ側の真実は boolean のみで「どのセッションが生きているか」は分からず、復旧＝全消去のみ。最長10分「同期中」に見え続ける可能性。

### 1.3 アカウント別同期ステータス `AccountSyncStatusDto`

- 場所: `src/api/schemas/account-sync-status.ts:7-15`、取得 `src/hooks/use-account-sync-status.ts:16-24`、集約 `src/hooks/use-account-sync-statuses.ts:28-40`
- 符号化: status 文字列が無く、`last_success_at`／`last_error`／`error_count`／`next_retry_at`／`waiting_for_credential_access` の組み合わせ解釈。「健全／失敗中／リトライ待ち／資格情報待ち」を利用側が毎回再導出（`use-account-detail-sync-status-rows.ts:45-66` は waiting→next_retry→error_count→last_error の優先順位分岐）。
- 弱点: `last_error!= null && next_retry_at == null && error_count==0` のような矛盾組み合わせを型で排除できない。`last_error` は表示文字列で、種別は接頭辞マッチで復元（`account-sync-status-format.ts:50-100`、8種の prefix 表）。フロント側に refetchInterval は無い。
- UX: 画面ごとに状態の言い換えがずれる。認証エラーなのか再試行待ちなのかが表示箇所依存。
- 追加: `useAccountSyncStatuses` は `data` だけを `Record<accountId,Dto>` に詰め替え、キー欠落＝「未取得／ロード中／エラー／対象外」が区別不能。取得失敗したアカウントが「問題なし」に見える。

### 1.4 `SyncResultDto` → `SyncFeedback` の解釈

- 場所: スキーマ `src/api/schemas/sync-result.ts:170-196`、解釈 `src/lib/sync/sync-result-feedback.ts:495-551`
- 符号化: `synced:false` は「失敗」ではなく「already-in-progress」の意味に流用。warnings の `kind`（generic/retry_pending/retry_scheduled）＋ `retry_at`／`retry_in_seconds` nullable 組で retry-scheduled／retry-pending／warnings を優先順位導出。
- 弱点: 1回の結果に retry_scheduled と generic が混在すると単一 kind に潰れる。`synced:false` と「本当に何もしなかった」の区別なし。
- UX: 「同期済み／実行中／一部失敗／再試行予定」のトースト文言がこの単一導出に全面依存。

### 1.5 手動同期クールダウン

- 場所: `src/lib/sync/manual-sync.ts:7-16,74-95,122-124,136-167`
- 符号化: モジュール変数 `manualSyncCooldownUntil:number` ＋ `manualSyncCooldownTimer` ＋ listener Set。「冷却中」は `timer!== null` という間接表現で、時刻値とタイマーの二重管理。
- 弱点: 成功 or `synced||total>0` or Retryable 失敗で 15秒開始、それ以外の失敗では開始しない。`Result.fail({type:"cooling_down"})` を AppError と同列のエラー型に合成。

### 1.6 起動時同期スロットル

- 場所: `src/lib/sync/startup-sync-storage.ts:129-148`
- 符号化: localStorage のタイムスタンプ（アカウント別キー＋レガシーキー移行）との差分比較のみ。ストレージ失敗時は warn-once フラグ群でプロセス内ガードのみにフォールバック。
- 弱点: 起動を跨いで残るためアプリ再起動＝状態リセットにならない。端末時計変更で誤判定。起動時同期が黙ってスキップされる／二重に走る条件が外部から不可視。

### 1.7 ローカルフィード同期ステータス＋再試行

- 場所: スキーマ `src/api/schemas/local-feed-sync-status.ts:241-254`、フック `src/hooks/use-local-feed-sync-statuses.ts:23-24,44-64,100-115`
- 符号化: (1) フィード状態は DTO の nullable 組み合わせ（attempt のみ＝失敗中、等は型に無い）。(2) 再試行中はモジュールスコープ `Set<string> pendingFeedRetryKeys`（JSON文字列キー）＋ `useSyncExternalStore` で「件数だけ」購読。React Query の mutation 状態とは別系統。
- 弱点: mutation が何らかの理由で settle しないとキー残留＝そのフィードは二度と再試行不可（remount でもモジュール Set は生存）。対象可否は `accountsPending`＋`account.kind.toLowerCase()==="local"`＋ID正規化の3条件の積。

### 1.8 接続検証ステータス `connection_verification_status`

- 場所: `src/api/schemas/account.ts:259,298-300`（picklist: verified/unverified/error/quarantined、ただし `v.optional` で欠落可）＋ `connection_verified_at`＋`connection_verification_error` の3点セット
- 弱点: status 本体が optional のため「未検証」と「状態不明（旧データ）」が同じ undefined。quarantined の遷移条件はフロントに無く表示専用。同期側の `waiting_for_credential_access` とは別軸で、同じ「資格情報問題」が2系統に分散。

### 1.9 構造的な核（同期の真実の4重化）

同期の真実はバックエンド側にあり、フロントの各マシンは「イベント（sync-progress）」「結果 DTO（SyncResult）」「永続ステータス DTO（AccountSyncStatus）」「boolean（getSyncState）」という4つの異なる粒度の写しを別々に保持している。これが分散の構造的な核。**直し方: まず読み手側に `deriveSyncStatus(...)` 的な単一の導出関数を作り、4つの写しを1つの判別共用体に寄せる。実状態は触らない。**

---

## 2. アップデーター系（最も分散が大きい）

### 2.1 ダウンロード実行状態 `updaterState`（モジュール単例の可変オブジェクト）

- 場所: `src/hooks/updater/updater-state.ts:5-47`、駆動 `src/hooks/use-updater.ts:32,69-192,222-236`
- 符号化: 明示的状態が無く、`checkInFlight:Promise|null`／`downloadInFlight:boolean`／`activeDownloadSessionId`／`activeDownloadProgressPercent`（null は「不明な進捗」も兼ねる）／`activeDownloadRequestId`／`activeDownloadVersion`／`activeDownloadSilent:boolean`／`nextDownloadRequestId`／`updateCheckGeneration` の9フィールド＋モジュール変数 `pendingDownloadIsActive`。**「ready」は状態として存在せず**、`downloadUpdate()` 解決と `update-ready` イベントの両経路が `completeActiveDownloadAsReady` に合流し、トースト表示が完了の唯一の表現。
- 弱点: (a) progress は単調増加を強制し後退イベントを破棄＝実進捗と表示の乖離があり得る。(b) `staleDownloadSessionIds` は無制限に増える Set で掃除なし。(c) silent/manual の区別が boolean 1本で、失敗時の分岐が `silent × isPending × DB busy 判定` の3条件積。(d) check と download の排他は都度のガード散在で一箇所に無い。(e) 世代管理が check は generation、download は requestId、イベントは sessionId と3種類の識別子で並行。
- UX: 更新が来ているのに無反応、進捗トーストの停止・逆行不能、ready トーストの二重／欠落リスクがすべてこの暗黙状態に集約。

### 2.2 保留中アップデート `PendingState`（pending-coordinator）

- 場所: 型 `src/hooks/updater/updater-pending-store.ts:5-9`（idle/attempting/waiting/failed の union、健全な部類）、調整 `src/hooks/updater/updater-pending-coordinator.ts:13-180`
- 符号化: zustand 側 union とは別に、モジュール変数 `request`／`sequence`／`firstAttempt`／`unsubscribe`／`timer` が実ライフサイクルを握る二重表現。waiting からの再試行は「`syncProgress.active` の true→false エッジ購読」＋「5秒 setInterval ポーリング」の二重トリガー。
- 弱点: 上記 2.1 と排他を `isUpdatePending()` 参照で相互に取り合う循環。同期が終わらないと waiting が永続し interval が回り続ける。`cancelPendingUpdate` は waiting/failed のみ可で attempting は取消不可。

### 2.3 再起動ブロック判定（合成状態）

- 場所: `src/hooks/updater/updater-toasts.ts:269-280`
- 符号化: 状態変数ではなく都度合成：`settingsOpen && (settingsDirty.dirty || pending || accountSetupSession.state が verifying/syncing)` OR `isAddFeedDialogOpen && (addFeed.dirty || pending)`。dirty/pending のスナップショットは別レジストリから取得。
- UX: ready になっても再起動できない理由が、3系統の未保存／実行中状態の合成で決まるため追跡困難。

### 2.4 Rust側アップデーター

- `commands/updater_commands/state.rs:10-12,87-125`: `DOWNLOADING: AtomicBool`＋`DOWNLOAD_SESSION_ID: AtomicU64`＋`ACTIVE_DOWNLOAD_SESSION_ID: AtomicU64`（0=なしのセンチネル）の3変数。`DownloadGuard::acquire` が CAS 成功時に active ID を store、Drop は `DOWNLOADING.store(false)` を無条件実行。途中キャンセル手段なし。
- `PendingUpdateSlot`（同:14-93）: `generation: u64`＋`value: Option<PendingUpdateHandle>`、`restore_if_unchanged` の世代ガードは明示的で良い例。一方 `downloaded_bytes: Option<Vec<u8>>` の None が「チェック済み・未ダウンロード」と「macOSで即時インストール済み」の2状態を兼ねる。`check_for_update` は開始時にまず `clear()` し成功時のみ replace＝チェックがエラーになると旧pending（ダウンロード済み・インストール待ち）が失われる。
- 進捗は `Option<Option<u8>>`（`mod.rs:184-285`）で未送信／送信済み（不明）／送信済み（確定値）の3状態を二重Optionで表現。percent は `max` で単調化、content_length 不明時は進捗が永遠に None のまま完了する。
- macOS再起動ヘルパーはシェルスクリプト文字列内で `remaining`／`attempt`／`mode=normal|fallback` のカウンタ状態機械（`restart_macos.rs:14-140`）。

---

## 3. UI層：オーバーレイ群とリーダー／ブラウザ

### 3.1 グローバル・オーバーレイ群（最重要）

- 場所: `src/stores/ui-store.types.ts:102-135`、`src/stores/ui-store.ts:118-144`、描画 `src/components/app-shell.tsx:365-419`
- 符号化: 独立した6系統 — `settingsOpen`／`commandPaletteOpen`／`shortcutsHelpOpen`／`isAddFeedDialogOpen`／`confirmDialog: {open, message, onConfirm}`／`subscriptionsWorkspace`。さらに `toastMessage` と UpdaterPendingView も同レイヤーに乗る。
- 弱点: **排他がコード化されているのは1ペアだけ**（`openCommandPalette` は `shortcutsHelpOpen:false` を、`openShortcutsHelp` は `commandPaletteOpen:false` を同時設定）。それ以外は無防備。settings＋commandPalette 同時open、settings＋shortcutsHelp 同時open、AddFeed＋confirm 同時open 等の全組み合わせが通常アクション経由で到達可能。`AppShell` は settings→confirm→shortcuts→palette の順に全部描画するため、前後関係・フォーカス奪い合いはDOM順と stacking class 任せ。`use-keyboard.ts:34-55` は逆に「DOM上に dialog が居るか」をセレクタで実地検出してショートカットを止めており、storeのフラグ群とDOMの実在という二重の真実がある。
- UX: Esc／フォーカス復帰先の競合、背面ダイアログへの誤操作、ショートカットが効く／効かないの条件が store から読めない。
- 直し方: 排他ルールを1箇所の関数に集約する（既存の1ペアを一般化する）。ただし一律の「後から開いたものが勝つ」は挙動を変えるため採らない。排他の対象は同格のピア同士（settings／commandPalette／shortcutsHelp／AddFeed 等）に限る。設定が意図的に開く子確認（ショートカットリセット `shortcuts-settings.tsx:181-185`、アカウント削除 `use-account-detail-danger-zone.ts:442-450` の confirm）は親子関係として保持し、親を閉じずに重ね、キャンセル時は親へ戻る現行挙動を維持する。

### 3.2 リーダー・コンテンツ表示マシン

- 場所: `src/stores/ui-store.types.ts:80-95`、`src/lib/layout/layout-state.types.ts:3`（`ContentMode = "empty"|"reader"|"browser"|"loading"`）、遷移 `src/stores/ui-store-reader-actions.ts:340-395`
- 符号化: `contentMode` union が主役のはずが、実態は `selectedArticleId`＋`browserUrl`＋`browserArticleId`＋`webPreviewSessionMode`（"auto"|"forced-on"|"forced-off"）＋`articleEngagement`（"preview"|"reading"）＋`articleNavigationDirection`＋`subscriptionsWorkspace` の合奏。表示の決定は別途 `ArticleViewSelectionState` で再導出される。
- **死に状態（自分で再確認）**: `contentMode:"loading"` は型にあるのに本番コードのどこからも代入されない。loading表示は React Query の pending から別導出。
- 弱点: `clearArticle` は `selectedArticleId:null, contentMode:"empty"` のみで browser系フィールドを触らないため、アクション単体では `contentMode:"empty" && browserUrl≠null` を作れる。`contentMode:"reader" && selectedArticleId===null` 等が型上すべて表現可能。
- 対比の良い例: `ArticleViewSelectionState`（`use-article-view-selection.ts:27-33`）は `{kind:"subscriptions-index"} | {kind:"browser-only", browserUrl} | {kind:"empty", emptyReason} | {kind:"loading"} | {kind:"not-found"} | {kind:"article", article}` と、表示に必要なデータが kind ごとに型で必須化されている。**store側の生フラグ群をこの共用体へ寄せるのが移行の雛形。**

### 3.3 ブラウザ（WebView）ライフサイクル ― 状態の三重符号化

- 場所: ローカル実体 `src/components/reader/hooks/browser/use-browser-view-runtime.ts:45` の `useState<BrowserWebviewState|null>`／store側ミラー `browserNavigationState`（同期は `src/components/reader/browser-webview-state.ts:14-33` が ref と両方へ手書き）／overlay開閉 `src/components/reader/browser-view.tsx:180-208` の `useReducer<boolean>`／失敗表現 `use-browser-view-surface-state.ts:62` の `surfaceIssue`＋props の `isLoading`／`runtimeUnavailable` から導く `activeSurfaceIssue`
- 弱点: store の navigationState とローカル状態の乖離、`is_loading:true` のまま surfaceIssue（失敗）表示、`overlayOpen:false`（アニメーション前）なのに webview は生成済み、等。世代管理も `load_generation`・`fallbackInFlightRef`・request-id 系 ref に分散。

### 3.4 ブラウザ閉鎖の保留アクションマシン

- 場所: `src/stores/ui-store.types.ts:88-90`、`src/stores/ui-store-reader-actions.ts:396-410`、消費側 `src/lib/browser-close-action-buffer.ts`、閉鎖hook `src/components/reader/hooks/article/use-article-browser-overlay-close.ts:25-84`
- 符号化: `browserCloseInFlight: boolean`＋`pendingBrowserCloseAction`（単体）＋`pendingBrowserCloseActionQueue`（キュー）の**二重表現**。`setPendingBrowserCloseAction(action)` は単体とキューの両方へ書き、`null` で両方消すため、単体はキューの末尾の複製でしかない。さらに hook内に `closeInFlightByHookRef`／`closeFinalizedRef`、bufferモジュール内に stuck recovery フラグと 0ms タイマー。
- 弱点: `browserCloseInFlight:false` なのに queue 非空、`pendingBrowserCloseAction≠queue末尾`、`contentMode≠"browser"` なのに inFlight=true（recovery側がこの組み合わせを想定して掃除している＝実際に起こり得るとコードが証言している）。
- 追加の経路差: 記事ペーン経路は in-flight を立てた直後、ネイティブ webview クローズ（最大2秒タイムアウト）の完了を待たず同一コール内で finalize＋flush まで済ませるため、非同期クローズ中の入力はキューに入らない。全既読確認経路は逆に `.finally()` まで in-flight を保持するが flush をせず、キュー投入時に予約される stuck recovery（`setTimeout(...,0)`）が正規クローズより先に走って状態を確定させる競合がある。
- UX: 「閉じる最中に次記事キーを押したら閉じた後に移動する」が経路とタイミングで効いたり効かなかったりする。

### 3.5 レイアウト／ペインマシン

- 場所: `src/stores/ui-store.types.ts:76-79`、`src/hooks/use-layout.ts:19-81`、`src/hooks/use-breakpoint.ts:12-28`、`src/components/app-layout.tsx:263-302`
- 符号化: `layoutMode`×`focusedPane`×`sidebarOpen`×`accountPaneOpen`×`contentMode`×`selectedAccountId`。表示ペインは `resolveLayout`／`resolveVisiblePane`／`isPaneVisible` が毎回導出。
- 弱点: `useBreakpoint` が**導出結果を `setLayoutMode` で store へ書き戻す**（ユーザー嗜好 wide/compact と viewport由来 mobile が同一フィールドに同居）。`focusedPane:"sidebar"` なのに sidebar 非表示（`getSidebarHiddenFallbackPane` という補正関数の存在自体が証拠）。補正ロジックが `use-layout.ts` と store アクションと `app-layout.tsx` の3箇所に分散。

### 3.6 選択スコープマシン

- 場所: `src/stores/ui-store.types.ts:82-86`、`src/stores/ui-store-reader-actions.ts:187-339`、`src/lib/reader/selection-history.ts`
- 符号化: `selection: ReaderQuerySelection`（判別共用体、良い例）に対し、`selectedAccountId`・`viewMode`（"all"|"unread"|"starred"）・`selectionHistory: {entries, index}` が独立に並ぶ。viewMode と smart選択の関係は `getSmartViewMode`／`getContextAwareScopeViewMode` が毎回調停。
- 弱点: `setViewMode` には smart選択との整合ガードが無く、`selection={smart,unread} && viewMode:"all"` を作れる（UI側は footer の disabledModes で防いでいるだけ）。`removeSelectionsFromHistory` は cursor 以前が全削除されると `index:-1`、`entries:[]` の履歴を返す経路があり、空履歴が実際に到達可能。

### 3.7 Toast

- 場所: store側 `src/stores/ui-store.ts:55-84`（モジュール変数 `toastTimer`／`toastAnnouncementId`）＋表示側 `src/components/app-shell.tsx:135-175`（`renderedToast`＋`isExiting` のローカル複製）
- 符号化: 単一 `toastMessage: ToastData|null`（`{message, persistent?, progress?, variant?:"update", severity?}` の optional 盛り合わせ）＋別系統 `toastAnnouncements`（aria-live用、1秒で一括消去）。表示側は exit アニメーションのため toast をもう1コピー保持。
- 弱点: `persistent:true` の toast が居る間に通常 toast が来ると単一スロットなので上書きされ、persistent の意味が「タイマーで消えない」だけになる。

### 3.8 Confirm ダイアログ

- `confirmInFlight` が useState と useRef の二重化。store側は `open:true && onConfirm:null` を型上許す。confirm 実行→成功で close、失敗で inFlight だけ戻して開いたまま。二重実行防止は ref 側の即時性頼み。

### 3.9 キーボード／フォーカス

- 場所: `src/hooks/use-keyboard.ts:76-130,232-377`
- store の `focusedPane` と**実際の DOM フォーカス**が別物として併存。account pane のキー振り分けは `accountPaneOpen && focusedPane==="sidebar" && DOM target が data-account-pane 内か` の三者照合。global shortcut の可否は DOM の dialog／popover 実在検出。
- UX: 矢印キー／Esc の効き先が時々ずれる系の不具合の温床。

### 3.10 記事リスト検索 ― searchQuery の三重存在

- 実働側: `src/components/reader/hooks/article-list/use-article-list-search.ts:9-65`（reducer: `{showSearch, searchQuery, debouncedQuery}`、閉じたら query 両方クリア、閉中は set を無視するガード付き＝比較的良い）。
- 死蔵側: `src/stores/ui-store.types.ts:87` の `searchQuery: string`＋`setSearchQuery`。**実検索には使われていない**（ナビゲーションスナップショット `fetch-errors-navigation.ts` には含まれるため、完全な死にコードではなく「検索状態はどこか」の誤認を招く残留物として扱うのが正確）。
- さらにコマンドパレットにも第三の独立検索入力がある。

---

## 4. 設定・アカウント追加・認証情報

### 4.1 設定モーダルのアカウント・ビュー

- 場所: `src/stores/ui-store.types.ts:102-107`、`src/stores/ui-store-settings-actions.ts:11-33,72-142`
- 符号化: `settingsOpen`＋`settingsCategory` union＋`settingsAccountId`＋`settingsAddAccount`＋`settingsAddAccountInitialKind`＋`settingsLoading`。不変条件（addAccount時は accountId=null、initialKind は addAccount時のみ）は `getSettingsAccountsViewState` ヘルパーが担う。
- 弱点: `settings-modal.tsx:295-330` 側が削除済みアカウント補正のために `resolvedSettingsAccountId` と `settingsAccountsViewTransition` を再導出し effect で store へ書き戻す二段構え。`closeSettings` は全リセットで再開不可。

### 4.2 アカウント・セットアップ・セッション × 設定ロック

- 型 `src/lib/account/account-setup-session.types.ts` は判別共用体で**模範**（`verifying` 変種は `accountId` を持たない、失敗理由は `errorMessage?` の有無のみ）。遷移 `src/stores/ui-store-sync-actions.ts:52-110` では `markAccountSetupFailed/Succeeded` が `verifying` の間は無言で遷移拒否、accountId 不一致も無言で現状維持。
- しかしその**効力**は `isSettingsSetupLocked(state)` が `session.state × settingsCategory × settingsAccountId × settingsAddAccount` の組み合わせを毎回再判定する暗黙の第2マシンで、ほぼ全ての設定アクションに横断的に差し込まれている。しかもロック判定が**2実装で微妙に違う**（ストア側は `settingsAccountId` 一致のみ、モーダル側 `settings-modal-account-selection.ts:166-185` は導出済みアカウント一致でもロック）。
- UX: `failed` でもロックされ、そのアカウント表示中は `closeSettings`／`setSettingsCategory` が no-op。**同期失敗時に設定画面から出られない。** `succeeded` の間はロック対象外で、succeeded セッションが残留したまま通常遷移が再開する。

### 4.3 設定の dirty／離脱ガード ― 同じ概念の二重レジストリ

- (i) `src/stores/ui-store.types.ts:56-67,128` の `nativeLifecycleBlockers: Map<owner, {dirty, pending}>`（owner は `"settings"|"add-feed"|"sync"|"updater"|"export"|"backup"`）
- (ii) `src/lib/settings/settings-dirty-state-registry.ts:1-27` の `SettingsDirtyStateEntry`（owner は `"account"|"add-account"|"tag"|"shortcut"|"preferences"|"data"` で **(i) と重ならない別語彙**）
- (iii) `src/components/settings/settings-modal.tsx:228-229,233-275` の `pendingLeave: (()=>void)|null`＋`savingBeforeLeave: boolean`
- **未使用機構（自分で再確認）**: (i) の `setNativeLifecycleBlocker`／`getNativeLifecycleBlockerSnapshot` の本番呼び出し元・消費者はゼロ。実際に再起動を止めているのは updater 側の合算判定（`updater-toasts.ts:88-102`）で、フィード追加側の snapshot は ui-store ではなくモジュールレベル可変変数 `latestAddFeedRestartBlockerSnapshot` に effect で書き込む方式。owner 名にある export/backup に対応する登録者は存在せず、**OPML 実行中でも再起動ブロックが掛からない。**
- 弱点: 保存失敗時は `pendingLeave` を null 化済みで離脱意図ごと消える（再操作が必要）。破棄は対象画面分でなく snapshot 内の全オーナー分を一括破棄。追加フォーム内部の戻る／キャンセルはガード対象外。

### 4.4 Preferences ストアのロード／保存

- 場所: `src/stores/preferences-store.ts:293-430`
- 符号化: `loaded: boolean`＋`prefs: PreferenceRecord`（空オブジェクトが「未ロード」と「ロード済み・空」の両義）＋`pendingPreferenceSaves: number`（カウンタ）＋`failedPreferenceSaveKeys`。非同期の世代管理はモジュール変数群（`preferencesLoadPromise`, `preferencesMutationGeneration`, key別 request counter/id map）に退避。
- 弱点: `loadPreferences` は成功／失敗フォールバックの両方で `loaded:true`、失敗時はデフォルト＋ミラーテーマで埋めるため**成功と失敗が state 上区別不能**。`loaded:false` のまま `setPref` で prefs が埋まる（load と競合）。

### 4.5 Platform ストア

- 場所: `src/stores/platform-store.ts:8-87`
- 符号化: `platform: PlatformInfo`（デフォルト値で初期化＝未取得でも値が存在）＋`loaded`＋`loadError`＋`inFlightLoad: Promise<void>|null`（**Promise を zustand state に格納**）。
- 弱点: `loaded:true && loadError:true` はエラー時の正式表現で、「ロード済み」と「失敗」が同居する設計。`platform.kind` を読む側が「デフォルト値なのか実測値なのか」を区別できない。

### 4.6 アカウント追加ウィザード（サービス選択→設定入力）

- 場所: `src/components/settings/add-account/controller.tsx:9,18-37`、`account-config-form.tsx:183-208,475`
- 符号化: 明示型 `Step={type:"pick"}|{type:"config",kind}` はあるが保持先は `useState` のみ、初期値はマウント時の `initialKind` 一度きり。フォーム本体は別コンポーネントの別 reducer。
- UX: 「戻る」「キャンセル」はどちらも dirty ガードを通らない直接遷移。`pick` へ戻るとフォームがアンマウントされ**入力全喪失**。カテゴリ等の変更でも `contentResetKey` で content 全体が remount され同じ喪失経路。

### 4.7 アカウント追加の送信・接続検証

- 場所: `account-config-form.tsx:43-83,195-199,223-342`、`account-config-actions.ts:13-25`
- 符号化: ローカル reducer の `submitting/errorMessage/validationError`＋ref 群 `submittingRef/submittedSuccessfullyRef/submitRequestIdRef/mountedRef`＋snapshot 一致判定＋グローバル `accountSetupSession="verifying"` の三重管理。
- 弱点: (1) snapshot 比較対象は `kind/name/serverUrl/username/password` のみで Cloudflare Access の enabled/clientId/clientSecret の送信中変更は stale と判定されない。(2) stale な成功時（送信中に入力変更・アンマウント）はバックエンドではアカウント作成済みなのに `clearAccountSetup()` だけで戻り、選択・同期・キャッシュ投入を一切しない。`submitting` は下りるため**再送信でき重複アカウントを作りうる**。stale な失敗時もエラー表示なし。(3) 同期後の最終 UI 遷移は複合条件 `shouldApplyFinalUiAction`（`use-account-detail-sync-controls.ts:149-159`）が外れると無言で終わる。

### 4.8 認証情報エディタ（最大の局所マシン）

- 場所: `src/components/settings/hooks/account-detail/account-detail-credentials-editor-state.ts:40-61`、本体 `use-account-detail-credentials-editor.ts:78-98`
- 符号化: **21フィールドの平坦な object**。Cloudflare Access だけでも `cloudflareAccessStatus`（"loading"|"ready"|"error"|"unavailable"|"authorization_required"）×`cloudflareAccessRecoveryAction`×`cloudflareAccessEnabled`×`secretEditing`×`secretVisible`×`draftTouched`×`removalRequested`×保存済み側 `savedClientId/savedOrigin`。並行して `testingConnection` と `credentialSavePending` が別フラグ、失敗は `credentialFailure` と `cloudflareAccessLoadFailure` の2つの nullable、成功した接続テストは hook側の別 useState `{accountId, accountGeneration, draftRevision}|null` で draftRevision と突き合わせて有効性を判定。
- 弱点: `removalRequested:true && enabled:true`、`recoveryAction:"remove" && secretEditing:true`、`status:"loading" && loadFailure≠null`、`testingConnection && credentialSavePending` 同時、等が型上すべて可能。ドラフトはメモリ内のみでアカウント切替・remount で喪失。`hasSavedPassword` 自体が推測（FreshRSS かつ `connection_verification_status==="error"` かつエラー文字列に `"Password is not configured"` を含まないことから導出）で、バックエンドのエラー文言マッチ依存。
- バリデーション表示も二系統: 送信時に保存した `validationError` と毎レンダー導出の FreshRSS 専用 `liveValidationError`、`resolved = 保存済み?? ライブ`。直したのに古いエラーが残って見える／逆に隠れる余地。

### 4.9 Cloudflare Access 認証情報

- 場所: `src/lib/account/cloudflare-access.ts:10,87-176`
- 符号化: 明示型 `status` に、`recoveryAction:"replace"|"remove"|null + enabled + draftTouched + removalRequested + secretEditing + secretVisible + savedClientId` の積。表示は view 側で再分岐。
- 弱点: 読込完了時に `draftTouched` ならドラフトを守るが `recoveryAction` は `null` に戻る分岐があり、選択した復旧操作が巻き戻りうる。`enabled=false+保存済み` は「保存時に削除」の注記だけで、実際の削除はコミットまで発動せず、離脱時の破棄で静かに取り消される。

### 4.10 アカウント詳細・同期セクション

- 場所: `build-sync-section.ts:32-57,97-115`、`use-account-detail-sync-controls.ts:168-200,224-368`
- 符号化: 表示フェーズは明示型 `SyncPhase="quarantined"|"setup-syncing"|"setup-failed"|"idle"` に寄せているが入力は `isQuarantined × isSetupSyncing × isSetupFailed × isSyncing`。`isSyncing` はさらに `syncProgress.active && (kind!=="manual_account" || activeAccountIds.has(id))` に setup syncing を OR。実行中判定はローカル `syncActionInFlight + 同名 ref`、成功表示は `syncNowSuccess:{accountId,generation}|null`。
- 弱点: 同じ「今すぐ同期」ボタンがフェーズで `handleSetupRetry`／無効／`handleSyncNow` に化ける。再試行は認証情報が dirty/pending なら同期せずエディタへフォーカス移動する前段分岐あり。`syncNowSuccess` は次回実行か切替まで消えず残り続ける。同期設定変更は呼ぶたび即書き込みで連打で複数回走る。

---

## 5. フィード追加・OPML・データ設定

### 5.1 フィード追加（URL入力→発見→候補選択→登録）

- 場所: 状態 `src/components/reader/add-feed-dialog.types.ts:9-18`、reducer `add-feed-dialog-state.ts:9-20,45-96,179-187`、実行 `hooks/feed-dialogs/use-add-feed-dialog-actions.ts:148-193,195-289`
- 符号化: `phase/step` フィールドなし。`url + discovering + discoveryRequestId + discoveredFeeds[] + selectedFeedUrl + successMessage:"feed_url_ready"|"feed_detected"|null + loading + error` の組み合わせ。0件=`successMessage="feed_url_ready", selectedFeedUrl=null`、1件=タイトル有りの場合のみ候補を保持しつつ自動選択、複数=先頭を自動選択し `successMessage=null`。送信先は `selectedFeedUrl?? url.trim()` で暗黙決定。
- 弱点: (1) URL を1文字でも編集すると発見結果・選択を全消去。実行中の発見は abort されず結果を requestId と URL 照合で捨てるだけ。(2) 閉じると次回オープン時に無条件 reset で再開不可。(3) 登録中は閉じられない表示ガードのみで、閉じられた場合もネイティブ側の作成自体は止まらないため、知らないままフィードが作られ再オープン時の初期状態と合わせて二重登録に気付きにくい。(4) 登録は逐次3コマンド（フォルダ作成→`addLocalFeed`→`updateFeedFolder`）で単一トランザクションでない。フォルダ作成後にフィード追加が失敗すると空フォルダが残る（巻き戻しなし）。フォルダ割当だけ失敗するとフィードはフォルダ無しで登録され警告トーストのみでダイアログが閉じ、その場でリトライできない。包む optimistic rollback の実体は `loading=false` 等だけでデータの巻き戻しはしていない。
- 局所マシンとして: `set-submit-error` は successMessage を消さないため、検出成功→送信失敗で `error≠null && successMessage≠null` が到達可能。

### 5.2 OPML インポート

- 場所: `hooks/account-detail/use-account-detail-danger-zone.ts:143-146,228-262`、`account-detail/danger-zone-view.tsx:98-99,210-240`
- 符号化: 「ファイル選択→確認→実行→結果」のうち確認・結果段階が存在しない。`importingOpml:boolean + importInFlightRef:boolean`（同義フラグ二重）＋エラー文字列のみ。**ファイルを選んだ瞬間に即実行。**
- UX: プレビュー／確認なしで誤ファイル・誤アカウントでも即取り込み。成功時は汎用トーストのみで、バックエンドが返す作成フィード一覧（件数・スキップ数）は捨てられる。部分インポートの担保は Rust 側（単一トランザクション、既存／重複 URL は黙ってスキップ）だが「何件入ったか」は伝わらない。アンマウントで `mountedRef` により成否通知自体が抑制される。dirty/pending レジストリ未登録のため再起動ブロッカーからも見えない。なお `src/hooks/use-feeds.ts:13-18` の `useImportOpml` は呼び出し元なしの別経路として残存。

### 5.3 OPML エクスポート

- 場所: `use-account-detail-danger-zone.ts:264-306`
- 符号化: `exportingOpml + exportInFlightRef` のみ。「保存先選択中」と「書き出し中」が同じ true に潰れている（フラグを立ててから `showSaveDialog` を await）。キャンセル（path=null）は無言で終了、成功時もトーストなし。**成功したのかキャンセルしたのか画面で判別できない。**

### 5.4 データ設定の各アクション

- 場所: `hooks/use-data-settings-controller.ts:180-456`、状態 `hooks/reducer.ts:16,24-35,57-74`
- 符号化: reducer だが段階 enum なし。5つの独立 boolean（`backingUp/exportingSettingsProfile/importingSettingsProfile/vacuuming/openingLogDir`）＋ `actionFailures: Record<操作,string|null>`。相互排他は各ハンドラ冒頭 guard と view 側の合成条件で、ハンドラごとに条件が微妙に違う。DB サイズだけ明示 union `"loading"|"ready"|"error"`。
- 弱点: 共有 lifecycle に載るのは vacuum/logdir の2つだけ。backup/export/import はローカル reducer のみで、パネルを開き直すと初期値に戻り、実行中だった処理の成否トーストも `mountedRef` で消える。二重実行防止は「同一マウント中＋view の disabled 合成」が前提でインスタンスを跨ぐと防げない。プロファイル取り込みはファイル選択即実行で確認なし。
- DB復元: アプリ内に復元の実行フロー自体がない（復元は「アプリを終了して手作業」が前提の案内のみ）。復元後の整合処理 `reconcileDatabaseRestoreFrontendState` は本番コードからの呼び出し元がなくテストからのみ使われる未配線部品。

### 5.5 ドラッグ（feed／folder）― 同型マシンの二重実装＋状態の三層化

- 場所: 上位 `hooks/sidebar/use-sidebar-feed-drag-state.ts:14-15`（`draggedFeedId`＋`activeDropTarget` の別々 useState）と `use-sidebar-folder-drag-state.ts:18-19`／中位 `hooks/feed-tree/use-feed-tree-drag.ts:15-55` と `use-folder-tree-drag.ts:13-48`（`{isPointerTracking, pointerDragPreview, pointerHoverTarget/dropTarget}` の reducer、ただしアクションはフィールド別セッター）／下位 `src/lib/sidebar/feed-tree-drag-session.ts:10-21`（ref内セッション `{isDragging, hoverTarget, currentX/Y}`）
- 符号化: 「ドラッグ中」が、`draggedId≠null`（上位）・`isPointerTracking`（中位）・`session.isDragging`（下位、閾値6px超過で立つ）の**3つの異なる意味**で存在し、表示用ターゲットは `isPointerTracking? pointerHoverTarget: activeDropTarget` と合成される。
- UX: ドロップ先ハイライトの残留、クリック抑制との競合、feedとfolderで挙動の微差。folder版は親ドラッグ終了を `parentDragWasActiveRef` で検出して後追い掃除する経路があり、feed版とライフサイクルが非対称。

### 5.6 フィードツリー presence（退場アニメーション）― 最も自覚的なマシン

- 場所: `src/components/reader/hooks/sidebar/feed-tree-presence-state.ts`（冒頭コメントで自ら "presence/diff state machine" と名乗る純関数層）、実体 `use-feed-tree-presence.ts:91`
- 符号化: `{scopeKey, folderOrder[], leavingFolders: Map, perFolderFeedOrder: Map, unfolderedOrder[], leavingFeeds: Map}`＋タイマー実体は runtime 側の ref／タイマーで、純関数層は `TimerInstruction`（schedule/cancel の判別共用体）を返すだけ。
- 評価: 設計意図と不変条件（feed同一性は全体で一意、leaving snapshot は凍結）がコメントで明文化された、この調査で最も自覚的なマシン。ただし「leaving に居るがタイマーが schedule されていない」状態は型上表現可能で、保証は runtime 側が命令を落とさないことに依存。

### 5.7 購読インデックス（Subscriptions Index）

- 場所: `src/components/subscriptions-index/use-subscriptions-index-state.ts:46-80`
- 符号化: useState が10個並列 ― `activeAccountId`（ui-store の selectedAccountId とは別の二重管理で、prop変化を effect で追随）／`selectedFeedId`／`keptFeedIds: Set`／`deferredFeedIds: Set`／`searchQuery`／`sortKey`／`expandedGroups`／`activeSummaryFilter`／`listScrollState`／`listScrollResetKey`（スクロールリセット信号が state本体とカウンタの二重）。
- 弱点: kept ∩ deferred ≠ ∅ が型上可能で、排他は `updateSelectedFeedDecision` を通る操作でのみ成立。初期値（options の `initialKeptFeedIds`／`initialDeferredFeedIds`）は無検証で両 Set に入る。`selectedFeedId` が visibleRows に無い状態は effect で後追い修復。
- 再開の非対称: ワークスペースを跨いだ復元用 `returnState` に保存されるのは accountId・フィルタ・選択 feed・展開グループ・スクロール・kept/deferred までで、ローカル state の `searchQuery` と `sortKey` は保存されない。閉じて戻ると検索・ソートだけ初期化される。

---

## 6. 記事 mutation・キャッシュ系

### 6.1 既読／スターの要求順序マシン `ArticleMutationRequestState`

- 場所: `src/hooks/article-mutation-requests.ts:44-121`、利用 `src/hooks/use-article-mutations.ts:90-142`（useSetRead）／`:274-326`（useToggleStar）
- 符号化: React Query の mutation 状態とは別に、モジュール `Map<articleId, {nextOrder, requests[]}>`。各要求は `status:"pending"|"success"|"failure"`＋`applied:boolean`＋token（instanceId Symbol・hook内 requestId・全体 order の3識別子）。
- 遷移: onMutate で register、onSuccess/onError で settle。settle の規則が暗黙の核：「成功した要求のうち、より新しい pending が存在しない最大 order のものだけを1回だけキャッシュへ適用」し、全要求が settle したら Map から削除。
- 弱点: 失敗した新要求は古い成功を「蘇らせる」ことはなく、onError でも成功時と同じ patch+invalidate を実行＝エラー時にキャッシュが「最後に成功した値」へ寄る。Map はコンポーネントを跨いで共有されるため、片方の画面の未 settle 要求が他方の適用を保留させる。
- UX: 既読／スターの連打・アンマウント跨ぎで、表示がサーバー結果と一時的に食い違う。健全な意図（順序保証）はあるが状態は外部から不可視。

### 6.2 閲覧履歴クリアの楽観更新

- 場所: `src/hooks/use-article-mutations.ts:193-252`
- 符号化: 古典的 onMutate スナップショット方式。onError では「現在のデータ === optimisticData のときだけ」巻き戻す同一性チェック。
- 弱点: 楽観適用後に別の更新（同期の invalidate 等）が同じ query を書き換えると巻き戻しが黙ってスキップされ、失敗したのに履歴が消えたまま見える。accountId が削除済みだと mutationFn が `Promise.resolve(0)` で「成功」として完了する。

### 6.3 一括既読＋ retained 表示

- 場所: `src/hooks/use-article-mutations.ts:254-273`、保持先 `src/stores/ui-store-reader-actions.ts:472-478`（`retainedArticleIds:Set`）
- 符号化: `viewMode` が条件を満たすときだけ既読化した記事 ID を ui-store の Set に保持し、一覧フィルタが `is_read` でも保持対象を表示し続ける。「既読だが表示中」という第3の状態が記事データ外の Set で表現。
- 弱点: Set の掃除は選択変更・明示 clear のみ。キャッシュ再取得で記事が消えても ID が残留し得る。

### 6.4 閲覧記録 `useRecordArticleView` の無言 no-op

- 場所: `src/hooks/use-article-mutations.ts:162-191`
- ID 正規化に失敗すると mutationFn が `Promise.resolve(null)`＝成功扱い。成功時も「アカウントが削除済みでない」場合のみ invalidate。失敗と意図的スキップと成功が呼び出し側で区別不能。

### 6.5 無限スクロールの終端判定

- 場所: `src/hooks/use-articles.ts:72-87,113-139`
- 状態ではなく `lastPage.length < pageSize` で終端、総 offset が `MAX_IPC_PAGINATION_OFFSET` 超過でも終端扱い（どちらも「次ページ無し」に潰れる）。また `useInfiniteArticleQuery` がレンダー中に `getQueryData` が配列なら infinite 形式へ書き換える移行処理を持つ（描画中 setQueryData）。
- UX: 読み込み終わり／上限到達の区別なし。

### 6.6 アカウント切替時の query キャンセル

- 場所: `src/hooks/use-cancel-reader-queries-on-account-switch.ts:141-203`
- `previousAccountIdRef` との差分で切替を検知し、対象 root 配下で「切替先 ID をキーのどこにも含まない」query だけ cancel する述語。コメント自体が、cancel された query が `fetchStatus:"idle"` のまま自動再試行されない詰まりと、検索文字列が ID と偶然一致する誤判定（無害な無駄フェッチとして許容）を明記。
- UX: 切替直後に一覧が空のまま固まる障害モードが、この述語の正しさに全面依存。

### 6.7 バッジの待機状態

- 場所: `src/hooks/use-badge.ts:84-120`
- `data===undefined && isFetching` の組み合わせを「待機中」と解釈し、その間は `latestBadgeCountRef` の前回値を表示し続ける ref ベースの保持。取得失敗時も前回カウントが残り得て、実未読数との乖離が不可視。

### 6.8 健全と区別できる箇所（React Query／明示型が状態を担っている）

- 読み取り基盤 `createQuery`（`src/hooks/create-query.ts:560-596`）: `enabled: queryId!==null` と `retry: shouldRetryReadQuery` を一元化。
- 書き込み基盤 `createMutation`（`src/hooks/create-mutation.ts:626-653`）: 成功時 invalidation の失敗を mutation の error 状態に伝播させる規約をコメントで明文化。
- 再試行ポリシー（`src/lib/query/query-client.ts:299-339`）: 読みは `AppError.type==="Retryable"` のみ上限2回、mutation は再試行なし、を型に基づいて一元決定。
- 明示 union として書けているもの: `PendingState`、`AccountSetupSession`、`SyncFeedback.kind`、`AppError` variant。ただし「型は明示的だが、遷移・実状態がモジュール変数や他ストアとの合成に分散している」のが残課題。

---

## 7. Rust側：DB状態（最も不正状態の余地が大きい）

### 7.1 SyncState（汎用状態行に複数ライフサイクルを詰め込み）— P3筆頭

- 場所: `repository/sync_state.rs:261-272`（struct）、`infra/db/sqlite_sync_state.rs:71-99`（全カラムUPSERT上書き）、`migrations/V1__initial.sql:53-64`
- 符号化: 状態enum／`status`カラムなし。`continuation/etag/last_modified/last_success_at/last_error: Option<String>`（日時はRFC3339文字列）＋`error_count: i32`＋`next_retry_at: Option<String>`＋`timestamp_usec: Option<i64>` の組合せを `scope_key: String` で使い回し。DBにCHECKなし。同じカラムがスコープで意味変化: `scheduler`=backoff、`account:greader:all`／`feed:<id>`=差分カーソル、`account:greader:remote-state-full`=10分クールダウン判定、`unread-drift:<id>`=ローテーション時刻、`local_feed:<url>`=HTTPバリデータ＋健全性。
- 遷移: 成功系、失敗系（`error_count=saturating_add(1)`、バリデータはNone化）、リセット系は `service/sync_scheduler/backoff.rs:290-315` と `commands/sync_commands/scheduler.rs:318-347` にほぼ重複実装。
- 弱点: `error_count>0`＋`next_retry_at=None/不正文字列/過去`、`last_error=None`＋`error_count>0`、`last_success_at` が失敗より新しい等が全て表現可能。述語 `backoff.rs:215-234 is_in_backoff` は `next_retry_at` パース失敗時に行を書き換えてclearする**読取りが書込み副作用を持つ**。古い状態を読んだ書き手の全列上書きでlost-update（カーソル／エラー巻き戻し）があり得る。
- UX: backoff不発でリトライ連打、逆に永久に同期対象外、同期状態表示の嘘。
- 型は `SyncStateScopeKey` enum があるのに永続表現・structは生 `String`。`From<&str>` は未知形式を `LegacyRaw` に落とし、接頭辞パース順依存。`continuation` は範囲内全書込みが `None` で、復元時も意図的に捨てられる死んだカラム。

### 7.2 pending_mutations（行の存在＝未送信）

- 場所: `repository/pending_mutation.rs:84-103`、`infra/db/sqlite_pending_mutation.rs` 全体、`migrations/V1:66-73`＋V18（一意索引＋重複は最小id残しで破壊的移行）
- 符号化: 状態カラムなし。行存在=未送信、削除=送信成功／破棄／置換の3意味が同居。`attempt_count`／`last_error`／`next_retry_at` なし。永続層は `mutation_type: TEXT` で旧表記 `"MarkRead"/"set_starred"` 等のaliasも `parse` が受付。順序は `created_at: String` をSQL `datetime()` で解釈。
- 弱点: 永続失敗するmutationはカウンタなしで毎同期無限リトライ。**DBに未知 `mutation_type` があると `find_by_account` 全体がparseエラーになり、そのアカウントの全pending処理が停止。** アカウント種別が文字列 `"FreshRss"` でないと保存自体がPersistenceエラー。
- UX: 既読／スターがサーバへ届かず警告だけ毎回出る、1行の破損で全件停止。

### 7.3 記事 is_read／is_starred ＋ 隠れ変更時刻

- 場所: `domain/article.rs:21-22,43-44`、V28（トリガー）
- 独立bool 2つの4組合せが全て許容。DBのみに `read_changed_at/starred_changed_at` があり `Article` struct に露出しない隠れ状態。トリガーは「値が変わり、かつchanged_at自体は不変」のときだけ `strftime(now)` 刻印＝local-sync importの明示時刻を尊重する規約をトリガー条件で表現。
- V28以前の既存行は `is_read=1` でも changed_at=NULL のまま＝「未変更」と「移行前」が区別不能（V29冒頭コメントが明言）。記事upsert は `ON CONFLICT(id) DO UPDATE` の対象に is_read/is_starred/remote_id を含めない「初回勝ち」で、挿入時の状態が競合時に無言で捨てられ、`published_at` は `MIN` で単調減少のみ。

### 7.4 アカウント接続検証（enum＋独立Option 2つ）

- 場所: `domain/account.rs:49-54`、`infra/db/sqlite_account.rs:299-322`、`commands/account_commands/mod.rs:303-343`
- 本体は enum `ConnectionVerificationStatus{Verified,Unverified,Error,Quarantined}` だが `connection_verified_at`／`connection_verification_error` が独立。不変条件（Verified⇒at=Some,error=None等）は呼出側規約のみで、任意組合せを無検証で保存できる。
- 弱点: Credential/Missing系失敗時は**何も書かず旧状態残留**（同期側も成功時のみVerified化、既にVerifiedなら早期return）。接続テストと認証情報更新の競合で、古いテスト結果が新しい認証情報をVerifiedに戻し得る（世代番号なし）。

### 7.5 ProviderKind::Quarantined（種別と状態の混同）＋二重符号化

- 場所: `domain/provider.rs:5-10`、`infra/db/sqlite_account.rs:28-56,98-140`
- 「隔離」というライフサイクルがプロバイダ種別enumの一variant。効果は場所ごとに個別実装（全件読込除外・単体同期エラー・スケジューラ除外・pendingではLocal扱い）。しかもDB文字列カラム `kind` と `connection_verification_status` の両方が quarantine を表し得るのに、`provider_kind_to_str`／`verification_status_to_str` が書く `"Quarantined"/"quarantined"` を対応する `*_from_str` はどちらも受け付けない往復非対称。読取パース失敗行は合成行（kind/status共にQuarantined、verified_at=None、error=パースエラー文字列）に置換され、元の状態が失われ、未知の将来値も全て同じ隔離に潰れる。
- UX: 隔離アカウントの原因表示が本来のエラーでなく内部パースエラー文になる可能性。

### 7.6 アカウント存在＝DB行＋keyringエントリの分散状態

- 場所: `commands/account_commands/mod.rs:69-115`、`access_credentials.rs:264-390`、`credentials.rs:17-57`
- 本体はSQLite、パスワード／Cloudflare AccessはOS keyring／ファイルストア。単一txなし、成否は手順順序＋rollback成否で決定。`password: Option<String>` は空文字を `filter(!is_empty)` で「変更なし」に潰す。
- 弱点: 終了／rollback失敗で「DBありパスワードなし」「パスワードだけ残留」。削除時はDB削除後のパスワード削除失敗を warn のみで成功扱い＝残存シークレット。rollback可否自体も boolean群（`access_inaccessible/password_inaccessible/password_attempted/access_attempted/access_written`）＋`previous_access: Option<AccessSnapshot>` の手続き的状態機械。

### 7.7 フィード同一性（ON CONFLICT節による暗黙マージ）

- 場所: `infra/db/sqlite_feed/mod.rs:138-185`
- 3つの `ON CONFLICT` 節 `(id)/(account_id,url)/(account_id,remote_id)` のどれに当たるかで更新フィールド集合が変わる。`(account_id,url)` 競合時は remote_id が他行と衝突すれば旧値保持、reader/web_preview_modeは更新されない。`(account_id,remote_id)` 競合時は title/site_url/unread_count が更新されない。呼び手はどの節が発火したか知る手段なし。

### 7.8 feeds.unread_count（非正規化キャッシュ）

- `domain/feed.rs:16`、`infra/db/sqlite_feed/mod.rs:16,187-195`、`sqlite_feed/unread.rs:21-58`
- `i32` カラムで保持しつつ実数は `articles.is_read=0` のCOUNT。`normalize_unread_count` は `clamp(0, i32::MAX)` で負値・溢れを黙って丸める。ミュートキーワード有無でCOUNT定義自体が変わる。再計算する経路としない経路が混在。
- UX: バッジ・未読数が実数と乖離し、直るのは再計算経路を通るか再起動まで。

### 7.9 フィード表示モード／アイコン二重表現

- `reader_mode/web_preview_mode: String`、有効値 `"inherit"|"on"|"off"`。V8ではCHECK付きだが修復経路で追加されたカラムにはCHECKが付かない。検証はrepositoryとcommandの2箇所で文字列 `matches!` の重複実装。旧 `display_mode` カラム（V5）が現行2カラムと併存する死んだ状態。アイコンは `icon: Option<Vec<u8>>` と `icon_url: Option<String>` の併存で、Rust範囲内に優先順位を決めるコードなし。

### 7.10 記事の付随的な暗黙状態

- sanitizer: `sanitizer_version: u32` が現在版未満＝要再サニタイズという数値比較。起動時は上限500件のみ・進捗カーソルなしで毎回最古から。`content_text` は `trim==''` を「未生成」のセンチネルにするため正当に空の記事と区別できず起動のたび再走査。
- 孤児記事: 状態カラムなし、LEFT JOINで都度判定。掃除は `(dry_run: bool, orphaned_article_ids: Option<Vec<String>>)` の組合せで3モード、`(false, None)` は確認なし全削除と等価で引数渡し忘れが破壊的操作になる型。
- 閲覧履歴: 行存在＝閲覧済み、上限超は同一txで古い行を無言削除、記事削除でCASCADE消去。
- articles.account_id 非正規化: feedから導出される複製を3トリガー＋upsert内サブクエリで追従、feed不存在の挿入ではNULLになり得る。
- ミュート自動既読: preferences の `mute_auto_mark_read == "true"` 文字列比較＋キーワード一致で未読を一括既読化＋pending積み。`"true"` 以外の表記揺れは無言で無効。

---

## 8. Rust側：同期エンジン（メモリ内）

### 8.1 AppState.syncing（単一AtomicBoolの過負荷）

- 場所: `commands/mod.rs:277-284`（`AppState{db, syncing, shutdown_draining, automatic_sync_enabled, automatic_sync_notify, browser_webview}`）、CAS取得は `sync_commands/account_sync.rs:260-283`、`manual.rs:142-158,251-267` ほか、RAIIは `progress.rs:19-25 SyncGuard`／`scheduling.rs:15-21 SchedulerSyncGuard`
- 1つの bool が「手動全体／手動単体／フィード／自動／起動時修復」の全排他に加え、DB保守ガード（フィード削除・リネーム・フォルダ操作・整合性掃除・VACUUM・バックアップが借用）と updater のインストール排他まで兼ねる。取得失敗はエラーでなく `SyncResult{synced:false,total:0,...}`。
- **UX: `synced:false` が「実行中」「自動同期未有効」「起動時対象ゼロ」「CAS失敗」の4意味を区別できない。** 誰がいつ始めたか保持しない。保守ガード取得失敗時は一律 "Database maintenance is unavailable while syncing" と表示され実際の競合相手と食い違う。
- 追加: `automatic_sync_enabled` は範囲内に false へ戻す書込みなし＝ワンウェイ・ラッチ。「初回手動同期前」と「無効化」が同値。

### 8.2 SchedulerLifecycle／Shutdown

- 場所: `service/sync_scheduler/lifecycle.rs:5-58,72-108`、`mod.rs:71-72`（`static SCHEDULER_LIFECYCLE: OnceLock<Mutex<…>>`）
- `task: Option<JoinHandle>`＋`running: Arc<AtomicBool>`＋`shutdown{requested: AtomicBool, notify}` の3点で「未起動／起動中／停止要求済／終了済」を表現。`running` のCASで二重起動防止、掃除は `task.is_some() &&!running`、解除は Guard の Drop 依存。
- 終了ドレインは `main_window_close_decision(shutdown_draining, sync_in_flight, update_download_in_flight) -> MainWindowCloseDecision` の明示enumに切り出されている（良い例）が実状態は bool 群。`shutdown_draining` は CAS で一度だけ開始でき戻す経路なし。ドレインは `browser && sync_scheduler && db` の3 bool の AND、5秒で打ち切り未完了でも `exit(0)`。

### 8.3 AccountSchedule と永続backoffの二重管理

- 場所: `service/sync_scheduler/scheduling.rs:9-13,40-65,110-141`、復元 `backoff.rs:30-60`
- 次回時刻がメモリ内 `HashMap<String, AccountSchedule{next_sync: Instant, interval: Duration}>` とDB内 `next_retry_at` 文字列の二重の真実。再起動でメモリ側消失→全アカウント now+interval で再作成（永続backoffがある場合のみ前倒し復元）。DBの `next_retry_at` が過去なら `Duration::ZERO` で即時due化。
- `RetryBackoffState`: `error_count: i32` を指数に流用（`clamp(0,10)` して `1<<count`、上限1時間で飽和）。Retry-After はエラーメッセージ接頭辞 `"Rate limit error: HTTP 429 "` の文字列一致時のみ採用。`retry_warning_changed` は旧／新 `next_retry_at` 文字列の不等比較で導出。
- `waiting_for_credential_access`: 状態カラムでなく `!has_lease && last_error.contains(NEEDS_AUTH定数文)` で判定し、DTOは常時falseで初期化後に `manual.rs:133-158` が上書きする二段階構築。macOS以外は常時false。文言変更・別エラー混入で判定反転。

### 8.4 起動時 remote-state 修復マーカー

- 場所: `commands/sync_commands/scheduler.rs:42-43,83-92,109-160`
- preferences文字列ペア `startup_remote_state_repair_v1 == "done"` か否かだけ。`!= Some("done")` は欠損・空・破損すべて「未完了」。完了判定は `synced: bool`＋`repaired_account_ids: Vec`＋失敗ID集合の複合述語で、`MissingUsername` も「修復済み」に数える。

### 8.5 SyncResult／FinishPlan 入力bool群

- 場所: `commands/dto/sync.rs:19-27`、`sync_commands/finish_plan.rs:13-95`
- 結果は `synced: bool + total/succeeded: usize + failed/warnings: Vec` の組合せ解釈。`FinishPlan` 自体は `SyncEntry` enum 別の決定表に一元化された良い例だが、入力は bool 6つ（64組合せ）。

### 8.6 GReaderSession とリース generation

- 場所: `commands/sync_providers/session.rs:13-27,118-135`、`session/lease.rs:14-51`
- セッションオブジェクトの存在自体が「認証済み」（有効期限フィールドなし）。`lease_generation: Option<u64>`。`try_leased_session` の `Ok(Some)/Ok(None)/Err` 三値が「リース利用／ストアへフォールバック／失敗」を符号化。リース破棄条件は `mode==Interactive` かエラー種別の**文字列比較** `diagnostic_kind()=="auth"`。generation一致時のみ無効化する競合対策自体はテスト付きで明示的。

### 8.7 GReaderパイプライン／ローカルフィード健全性

- `PullResult`（`domain/provider.rs:45-60,71-97`）: `next_cursor: Option, has_more: bool, not_modified: bool` で has_more×not_modified の4組合せ検証なし。ローカル経路は not_modified のみ見て entries を捨て、GReader経路は not_modified を一切見ない。`RemoteState{read_ids, starred_ids}` は「集合に含まれる＝既読／スター、不在＝未読」で完全性フラグなし（空Vecが本当に0件か取得不完全か区別不能）。
- ページングループ（`entries.rs:49-341`）: ローカル変数群 `cursor`／`latest_timestamp_usec`／カウンタ群／`seen_continuations: HashSet`／`incomplete_reason: Option<&'static str>`。遷移判定自体は `PageStep{Continue,Done,Incomplete}` enum（良い例）。ただし `next_page_step` は `has_more=true` でも次継続トークンが無ければ `Done` を返すため、切り捨てが成功としてカーソル前進し得る。
- 未読調整（`unread/mod.rs:24-209`）: 対象判定はサーバ未読数 ≠ ローカル未読数のカウンタ比較。一致時も drift チェックが走り、その最終チェック時刻は SyncState の `greader_unread_drift` スコープの `last_success_at` を流用（24hクールダウン）。`mark_unread_drift_check_completed` は失敗・不完全でも時刻を前進させる＝この箇所では `last_success_at` が「成功」でなく「試行」を意味する。
- `LocalFeedFailureRecord`（`local.rs:32-139`）: `SyncState.last_error: String` に `{error_kind, attempted_at, diagnostic_id}` のJSON文字列を格納する二重符号化（error_kind 自体は enum）。JSONでない旧形式・未知kind・不正な時刻／UUIDは読側で `Other/None/None` に劣化。表示用 `last_attempt_at` は「エラーあり→失敗時刻、なし→成功時刻」の同名異義。
- フィード stale 判定／verdict 診断: stale は永続化せず都度計算（最新20件、5件未満は判定不能 `None`、中央値gap）。verdict の結論は明示 enum `Verdict`（良い例）だが入力は `feed_scope_synced: bool`（＝sync_state行が存在するか）＋Option群の組合せで、行の有無が意味を変える。V23マイグレーションで空フィード行が削除されると同期済み→未同期扱いに戻り誤診。

---

## 9. Rust側：Keyring／セッションリース／ストレージモード

### 9.1 セッションリース（session_cache）

- 場所: `infra/keyring_store/session_cache.rs:17-18,26-31,66-145,186`
- `Lease{generation: u64, server_url/username: Option<String>, expires: Instant, credentials}`＋全体 `generation` カウンタ＋`generations: HashMap`＋`leases: HashMap`（上限16件、最古／期限最早を追い出し）。有効期限は固定8時間、期限切れは読取時の `retain(expires>now)` による遅延削除のみ（タイマーなし）。
- UX: 8時間経過・再起動・17件目以降のアカウント追加で自動同期が突然「認証が必要」になる。
- 判定不一致: `has_lease(id)` は ID と期限しか見ないが実際の `get_leased` は server_url/username 一致も要求。判定と取得の間の期限切れ・invalidate の TOCTOU もある。
- `NEEDS_AUTH` 文字列センチネル: 「リースなし＝要認証」を専用型でなく `DomainError::Keychain(NEEDS_AUTH文字列)` で伝達し、設定画面側は `message == NEEDS_AUTH` の文字列完全一致で `CloudflareAccessMetadata::AuthorizationRequired` に変換。

### 9.2 読取キャンセルとゲート

- `infra/keyring_store/mod.rs:113-150,230-250` — macOS は Semaphore(1) ゲート＋`PendingLookup(Arc<AtomicBool>)` だが blocking 読取は開始前に一度だけ cancelled を確認。非macOSの caller timeout 10秒は blocking 読取をキャンセルしない。キャンセル後も裏で読取が継続し permit を保持し続けるため後続の同期読取が待たされる。

### 9.3 ストレージ・モードの三重の真実源

- 場所: `infra/keyring_store/storage_mode.rs:18-19,23-130`、`commands/credential_storage_commands.rs:22,39-125`
- enum `CredentialStorage{OsKeychain,LocalFile}` 自体は明示的だが実効状態は (1) マーカーファイル `credential-storage.json` のJSON文字列、(2) メモリ内 `ACTIVE: AtomicU8`（0/1手動符号化）、(3) `APP_DATA_DIR: OnceLock`（2回目の init は dir を差し替えられないのに `set_active(read_marker(new_dir))` は実行される）、(4) プラットフォーム dev ファイルストアの有無の組合せ。`read_marker` はパース失敗・読取失敗・ファイルなしを全て OsKeychain にフォールバック。
- UX: マーカー破損でサイレントに Keychain モードへ戻る（秘密はファイル側に残ったまま読まれなくなる）。cleanup失敗後は両ストアに秘密が残るが再起動後は知る手段がない。

### 9.4 dev ファイルストアのロック＝ファイル存在＋mtime

- `infra/keyring_store/dev_store_lock.rs:12-160` — ロック状態は `.lock` ファイルの存在そのもの、中身の `pid=/created_unix_ms=` は診断用で検証されない。stale判定は mtime 5分以上のみ。5分以上ロックを保持する正当な処理があると他プロセスが stale と誤認して二重保持になり得る。ストア本体も64KiB超過で「破損」扱いになる閾値状態を持つ。

### 9.5 Cloudflare Access の保存表現

- `infra/keyring_store/cloudflare_access.rs:54-140` — 保存実体は keyring 1エントリ内のJSON文字列。読取側は `AccessSnapshot{Missing,Configured,Malformed(String)}` の明示enumに復号する良い例だが、Malformed は生文字列を保持して復元可能にするため「読めないが存在する」が文字列保持で表現される。

---

## 10. Rust側：内蔵ブラウザ WebView

### 10.1 Tracker の複合状態（単一 pending スロット）

- 場所: `browser_webview/mod.rs:44-49,88-215`
- `BrowserWebviewTracker{current: Option<BrowserWebviewState>, history: Vec<String>, history_index: usize, pending_navigation: PendingNavigation, load_generation: u64}`、対外状態 `BrowserWebviewState{url, can_go_back, can_go_forward, is_loading: bool, load_generation}`。開いているかは `current` の None/Some。pending 自体は enum（良い例）だが1枠しかない。
- 弱点: 連続ナビゲーションで先行 pending が上書き、二重startで generation が余分に進み timeout/finish 受理条件とずれる余地。

### 10.2 遷移種別の URL 等値ヒューリスティクス

- `start(url)` が「history[index-1]==url⇒Back」「[index+1]==url⇒Forward」「[index]==url⇒Reload」「それ以外⇒New」とURL文字列一致だけで推論。同じURLが履歴に連続・重複すると誤判定、リダイレクトで最終URLが変わると finish 側の履歴書換えも推論依存。

### 10.3 読込タイムアウト＝3点一致

- start ごとに10秒タイマーを spawn し、発火時に url＋generation＋snapshot が全て一致すれば `tracker.finish()` を強制実行。finish受理も「is_loading かつ URL完全一致」が条件。リダイレクトで finish の URL が start と異なると正規完了が受理されず10秒間「読込中」が残り、その後タイムアウト側が開始URLで finish する（履歴に開始URLが残る）。

### 10.4 can_go_back／forward の二重の真実源

- tracker自前履歴から算出する bool と OS webview の native 値（取得できれば Some、できなければ／Windows placeholder時は None）が併存し `finish` は `availability.unwrap_or(history_flags)` で選択。native履歴と tracker履歴が乖離すると真実源が切替わり得る。go_back等のコマンドは native実行前の snapshot を返却値とするため返却 state は遷移前の値のまま。

### 10.5 「開いている」判定の二重源＋placeholderセンチネル

- 実在判定は Tauri の `get_webview("browser-webview")` の有無、表示状態は tracker snapshot の有無で別判定。Windowsでは初期URL文字列 `"about:blank"` がセンチネルで「placeholder表示中」は `(platform==Windows && current_url=="about:blank" && snapshot.url==target)` の複合条件。webviewはあるが tracker が空の場合、`current_or_loading_state` が fallback URL から新規 loading 状態を合成する。

### 10.6 グローバルAtomic群

- macOS `BROWSER_MACOS_ESCAPE_MONITOR_INSTALLED: AtomicBool` は CAS で一度だけ true になりモニタ実体は `mem::forget` で永続化、失敗時のみ false に戻る一方向ラッチ（webview開閉ライフサイクルと独立、二度と解除されない）。Windows `BROWSER_CLOSE_GRACE_UNTIL_MS: AtomicU64` は epoch ミリ秒の締切で「close直後800msの猶予」を表現。

---

## 11. Rust側：起動・終了・ウィンドウ・メニュー・DB

### 11.1 終了ドレイン／2重起動／起動時フォーカス復元

- 終了ドレインの判断自体は `MainWindowCloseDecision` の明示enumに切り出されている（良い例）が実状態は bool 群。ドレインは `browser && sync_scheduler && db` の3 bool の AND、5秒で打ち切り未完了でも `exit(0)`。
- 2重起動: `SecondLaunchDecision` enum は存在するが `#[cfg(test)] #[allow(dead_code)]` で本番未使用。本番経路は single-instance プラグインのコールバックが無条件に既存ウィンドウを show＋focus するだけ。
- 起動時フォーカス復元: `startup_focus_restore_active: Arc<AtomicBool>`（初期true）、起動後250ms待ってから判定enum `StartupFocusRestoreDecision` で show/focus/サイズclampを実行。この復元処理が「ウィンドウを表示する唯一の経路」であるため、メインスレッド投入に失敗するとウィンドウが出ないままになり得る。

### 11.2 メニューのチェック状態（二重管理）

- `menu.rs:180-230,402-443` — 初期チェックは prefs 文字列解釈（`reading_sort`、なければ旧キー `sort_unread` が `"oldest_first"` か、`group_by=="feed"` か）。クリック時はまずネイティブ CheckMenuItem を反転してフロントへ emit、emit失敗時のみロールバック。永続化はフロント側前提でバックエンドに「現在のチェック状態」の正がない。フロントが処理し損ねるとネイティブ表示と実際の設定が乖離したまま。

### 11.3 preferences 全般（文字列型なしストア）

- `domain/preference.rs:1-160` — 全設定が `HashMap<String,String>` で、bool は `"true"/"false"` 文字列。検証はキー許可リスト＋一部キーだけ bool 形式を検査する `PreferenceRowQuarantineReason` enum（良い例）で、それ以外の bool キーは表記揺れが無言で false 扱いになり得る。`selected_account_id` や `startup_remote_state_repair_v1` のような状態マーカーも同じ文字列ストアに同居。

### 11.4 schema_version（単一整数＋暗黙不変条件）

- `infra/db/migration/mod.rs:25-256`、`LATEST_VERSION=29` — 状態は整数1つだが実体は「行がちょうど1行・整数・非負・重複なし」という暗黙不変条件で、違反（空、複数同値行、非整数、負値、テーブル欠落＋他テーブル存在）を全て Migration エラーとして起動拒否。**V10ファイルは存在しない** — `from_version < 10 || feed_mode_columns_need_repair` の場合に修復処理が `set_schema_version(10)` する番だけのバージョン。tx外で部分的に書かれたDBは「版数と実スキーマの不一致」になり版数だけでは復旧可否が分からない。
- `repaired_schema`（版数を上げない修復）: 同じ版数でも「修復済み／未修復」が bool 1つで別管理。版数は最新だが列が欠けたDBがあり得ることが前提で、版数だけ見る外部ツールは構造差を見逃す。

### 11.5 バックアップ／復旧のファイル状態機械

- `infra/db/backup/mod.rs:13-481` — 状態はファイル存在で表現 — 本体 `.db`、補助 `-wal/-shm`、作業中 `.tmp`、退避 `.restore-old`、世代はファイル名埋め込みの秒精度timestamp＋衝突時 `_1,_2…` サフィックス。保持は名前辞書順で最新3件。バックアップ内テーブル `__ultra_rss_backup_metadata(id=1固定, format_version, schema_version, checksum)` を書き込むが、`restore_backup` が検証するのは SQLite `integrity_check` のみで **metadata の checksum・schema_version・出自は復旧時に照合しない**。しかも checksum は metadata テーブルを書く前のファイルに対して計算される。
- UX: 古い／別版バックアップを検証なしで復旧してしまう、復旧失敗時は手動手順頼み。復旧途中クラッシュで `.tmp/.restore-old` が残留（次回 restore/backup 開始時に stale として削除されるが通常起動では掃除されない）。

### 11.6 Local Account Sync（デバイス間同期）

- settings: `LocalAccountSyncSettings{sync_folder_path, sync_account_id, device_id, enabled: bool, last_export_digest: Option<String>}`。digest の None は「未export」「フォルダ変更直後でリセット」の2意味を兼ね、最新か否かは digest 文字列の等値比較のみ。フォルダ変更時の digest リセットはコマンド層だけが実施し repository の `save()` は path と digest の整合を検証しない。merge を経由しない保存で「新フォルダ＋旧digest」になると `export_if_changed` が変更なしと判断して新フォルダが空のままになる。
- import の全-or-無ゲート: `should_apply = rejected_files.is_empty() && conflicted_candidates.is_empty()` の Vec 空判定から `applied: bool` を導出する一方、merge で reject された operation は適用を妨げない。ファイル単位の不整合は全体を止めるが operation 単位は部分適用される粒度の異なる二重基準。
- apply ガード＝DB単一行の bool＋tombstones: `local_sync_apply_guard(id=1固定, active: INTEGER 0/1)` という単一行boolが全トリガーの発火可否を決める大域スイッチ。`active=1` の間は changed_at 刻印も tombstone 記録も一切起きない。import が異常終了して `active=1` のまま残る経路があると、以降のローカル変更が永久に記録されない無言の状態になり得る。
- 記事状態の Option ペア: `LocalSyncArticleState{is_read: Option<bool>, read_updated_at: Option<DateTime>, is_starred: Option<bool>, starred_updated_at: Option<DateTime>}`。適用側は `if let (Some(v), Some(t))` のペアが揃った時だけ反映し、値だけ／時刻だけ Some はサイレントに無視される。
- タグの生死＝removed_at: None=生存、Some=削除済み（tombstoneを同一レコード内包）。RemoveTag は `display_name=normalized_name`（小文字化済み名）でレコードを作り直すため削除時点で元の表示名が失われる。
- LWW時刻の文字列保存と非対称な同値ルール: DB側の変更時刻は `changed_at: Option<String>`（RFC3339文字列）、None は export 時に `DateTime::UNIX_EPOCH` のセンチネル時刻に変換され「一度も変更されていない＝常に負ける」を表現。勝敗は `file_wins`（file >= local でファイル勝ち）と `local_removal_is_newer`（removed_at > file で削除勝ち）で同値時の扱いが非対称。

---

## 12. フロー横断：起動・オンボーディング・選択履歴

### 12.1 アプリ起動シーケンス

- 場所: `src/App.tsx:24-32, 67-86`
- 専用 boot 状態なし。`preferencesLoaded`×`devIntentReady`×モジュール外 ref `startupSyncRequested.current` の組み合わせで「起動時同期を撃ってよい段階か」が決まる。`activeDevIntent!== null` なら同期自体を抑止。
- 「一度だけ実行」の保証が再マウントでリセットされる ref 依存。wake側は `syncOnWakeInFlight: useRef<boolean>`＋`syncOnWakeRunToken: useRef<number>`＋`lastHiddenAt: useRef<number>`＋30秒閾値定数。inFlight と token の二重管理。

### 12.2 初回・アカウント0件（専用オンボーディングは存在しない）

- onboarding/welcome 専用コンポーネントなし。実体は `src/components/settings/settings-modal-account-selection.ts:32-58` の自動補正と `src/hooks/use-layout.ts:resolveVisiblePane`（mobile で `selectedAccountId===null` なら sidebar を出す）。
- `selectedAccountId=null`＋アカウント一覧が空＋設定を開く、で暗黙に「追加画面」が初回フローになる。設定側では選択 ID が一覧に無ければ `{accountId:null, addAccount:true}` へ強制遷移。
- UX: ユーザーの明示選択より自動補正が優先。「初回だから追加画面」なのか「選択が消えたから追加画面」なのか区別が付かない。

### 12.3 選択履歴の戻る／進む

- 場所: `src/lib/reader/selection-history.ts:5-79`、`selection-history-navigation.ts:13-30`
- `SelectionHistory={entries,index}`、push 時は前方切り捨て・同一選択 dedup・上限50件。移動時は「カーソル位置の entry が現在の selection と一致しない履歴は直接書込みで迂回されたものとして無効」＋「まだ存在し表示設定上も有効な entry」だけを近傍から探す。
- 弱点: 履歴は `selection` だけを持ち、記事・検索・ブラウザ・当時の `viewMode` を持たない。復元時の viewMode は smart 以外「現在の状態から推定」。マウス戻るは段階式（①ブラウザ内戻る／閉じる ②記事を閉じる ③履歴を戻る ④feed→所属 folder ⑤サイドバーへフォーカス）だが、進むはブラウザ以外では履歴のみで、記事段階は戻らない。
- UX: 「ブラウザ的な戻る」を期待すると段階がずれ、進んでも記事と絞り込みが戻らない非対称な体験。

### 12.4 `articleEngagement`（プレビューか本読みか）

- 場所: `ui-store.types.ts:27`、初期値 `"reading"`（`ui-store.ts:103`）
- 記事 ID を持たない単一グローバルスカラー `"preview"|"reading"`。自動既読は `==="reading"` の時だけ進む。`"preview"` を指定するのは自動で先頭記事を開くランディング経路だけで、それ以外の全 `selectArticle` は省略で `"reading"` に上書き。スクロール・滞在等での明示的な昇格遷移は確認できなかった。スコープ切替・記事クリアでもリセットされない。
- UX: 自動既読の効き方が「開き方（クリックか自動ランディングか）」だけで決まる。

### 12.5 feed-landing の楽観遷移とロールバック

- 場所: `src/hooks/use-feed-landing.ts:29-58,96-110,155-210`
- 遷移前に UI snapshot（browserUrl/contentMode/focusedPane/selectedArticleId/selection/selectionHistory/viewMode/webPreviewSessionMode）を取り、失敗時だけ最新リクエストの場合に `useUiStore.setState(snapshot)` で復元する明示的な中断・復帰設計がある箇所。
- 弱点: snapshot に `browserArticleId/articleEngagement/browserCloseInFlight/pendingBrowserCloseActionQueue` が含まれない。途中まで進んだ後の失敗では、復元後も browserArticleId はランディング先のまま・engagement="preview" が残り、上記コンテンツ表示フローと不整合になり得る。

### 12.6 ブラウザオーバーレイ自動開閉（Web プレビュー）

- 場所: `src/lib/articles/article-display.ts:6,220-286`、`hooks/article/use-article-browser-overlay-display.ts:24-71`
- store に「表示すべきか」の単一フィールドはなく、`webPreviewSessionMode="auto"|"forced-on"|"forced-off"`（セッション全体）×アプリ既定×フィード上書き×URL 有無を `resolveArticleDisplay` で合成し、その変化を effect が検知して `openBrowser/closeBrowser` を呼ぶ。手動で開く=`forced-on`、閉じる=`forced-off` に書く。
- UX: セッションモードは記事単位でなく、アカウント切替時にしかリセットされない。ある記事でプレビューを閉じると別フィードの記事でも自動で開かなくなる（逆も同様）。理由が画面から見えない。

### 12.7 記事リスト内検索モード

- ローカル reducer は明示的な良い例（`use-article-list-search.ts:8-110`）。弱点は分裂（store側の同名 `searchQuery`、コマンドパレットの第三の検索入力）と選択喪失：検索結果に開いている記事が含まれないと `use-article-list-effects.ts:39-68` がフレーム後に `closeBrowser()+clearArticle()` する。検索を閉じても選択は復元されず snapshot がない。検索モードは選択履歴にも記録されない。
- UX: 読んでいる記事のタイトルで検索し直すとリーダーが勝手に閉じて空表示に戻り、検索をやめても元の記事に戻れない。

### 12.8 中断・再開の非対称（横断パターン）

再開の仕組みがあるのは feed-landing の snapshot と購読インデックスの returnState だけで、どちらも保存対象フィールドが部分的（前者は browserArticleId/engagement 等、後者は searchQuery/sortKey が欠ける）。設定・追加ウィザード・Add Feed・OPML・データ設定は閉じる／アンマウントで状態喪失が既定。

### 12.9 二重実行防止の寿命がマウント単位

OPML・データ設定・同期ボタン等、in-flight フラグがコンポーネントローカル（＋同義 ref の二重持ち）で、インスタンスを跨ぐと防げない。逆にアカウント追加は作成済みでも stale 判定で無言化し、再送信による重複作成の余地がある。

### 12.10 結果通知の喪失

アンマウント時の `mountedRef` ガードにより、OPML・バックアップ・取り込み等の成否がユーザーに届かない経路が複数ある。

---

## 13. dev scenario／mock（AXの良い例と穴）

良い例の集積:

- ID の符号化: 全24件が `src/dev/scenario-ids.ts:1-61` の kebab-case 定数＋型 `DevScenarioId`＋許可リスト＋ Set 照合で閉じている。URL パラメータ経路は存在せず、入力は env のみ。
- 起動→適用の段階分離: (1) 起動前 mock 注入は Tauri 不在 or dev のみ動的 import、(2) intent 解決完了 `ready` まで起動時同期を抑止するゲート、(3) 実行は `setTimeout(0)` で1回だけ、失敗は toast 化、(4) scenario 本体は import-registry 経由の動的 import＋モジュール形状の runtime 検証、(5) 実行器は世代カウンタ＋ `isCurrentRun` で古い非同期 run の書込みを抑止、(6) 状態適用は2系統のみ — React Query キャッシュへの seed は draft に貯めて一括 commit（途中失敗・stale 時は commit しない）か、ui-store の通常アクション呼び出し。
- registry の完全性: `DEV_SCENARIO_DETAILS: Record<DevScenarioId, …>` で全 ID 分の定義が型で強制、重複 ID/title/keyword の診断付き。context 型が「scenario が触ってよい面」を ui 選択系＋ queryClient の set/getQueryData ＋ actions 読み取り系のみに限定。
- prod stub 化: `command=build && mode=production` のときだけ3モジュールを `src/dev/prod-stubs/` へ alias。alias 対象外のモジュール自身も `import.meta.env.DEV` ガードで null/unavailable を返す二重化。

**AXの穴（この調査で最も大きい）**: 24件すべてが「開く／移動する」系＋ `sync-all-smoke` のみ。次に相当する ID は存在しない: エラー・失敗状態（同期失敗、認証エラー、接続検証失敗、フィード取得失敗。mock 側に local feed を1回失敗させる `failDevMockLocalFeedOnce` はあるが scenario から呼べない）、空状態（アカウント0件等）、ダイアログ中間状態（Add Feed の発見中／発見済み／送信中、設定の未保存／保存中／保存失敗、アカウント追加の検証中ロック）、ブラウザ中間状態（ローディング、リトライ可能エラー、close-in-flight／保留キュー）、同期進行中、アップデーター DL 中／ready、入力済み検索クエリ。

**追記（2026-11-17、#678）**: エラー・中間状態の scenario を5件追加した: `show-feed-sync-failure`（local feed の同期失敗。`failDevMockLocalFeedOnce` を scenario から呼ぶ）、`show-account-sync-failure`（リモートアカウントの同期失敗。mock に account sync status の override を追加して再現）、`show-account-credential-wait`（`waiting_for_credential_access`）、`show-updater-ready` / `show-updater-failed`（updater pending store の waiting / failed）。Add Feed の発見済み、設定の未保存などダイアログ内のローカル状態は scenario context から到達できないため、引き続き未対応。

- scenario で作れない状態は unit/store/story 側にテストはあるが名前付き再現手段がないため、実機・スクリーンショットでの再現はその都度手作業になる構造。
- テストでの固定: scenario 層は「遷移そのもの」を fake context で検証（runner テスト全1151行）。アプリ本体は store/reducer の純粋遷移テストが厚い。e2e は scenario を一切使わず実クリックで、起動は `page.goto("/")` のみ。前提状態はブラウザ mock のデフォルト seed という暗黙依存。dev scenario の起動経路（env→実アプリ起動→到達状態）を通す Playwright テストはない。

---

## 14. 段階的な進め方（壊さない順序）

### Phase 0 — 文書化と安全な片付け（今すぐできる、挙動を変えない）

1. 本書をリポジトリの `docs/` に置く（状態カタログとして維持）。
2. 死に状態・未使用機構の整理（テストで固定してから除去）:
   - `contentMode: "loading"` の代入が無いことをテストで固定し、型から除去するか、読み手側の loading 導出に一本化する。
   - `nativeLifecycleBlockers`（ui-store の Map）は本番呼び出し元ゼロ。削除するか、updater のブロック判定をここへ寄せるかのどちらかに決める。現状の「定義だけあって使われていない」が最悪。
   - store の `searchQuery` は実検索に使われていない。ナビゲーションスナップショットでの用途を明記するか、スナップショット側のフィールド名を変える。
   - `isSyncDisabled` は常に `false` ハードコード（`ui-store-sync-actions.ts:449`）。死に導出として除去。
3. dev scenario にエラー／中間状態を数件追加する（同期失敗、認証エラー、Add Feed 発見済み、設定の未保存）。AX の穴を埋める最も安い一手で、挙動は変わらない。

### Phase 1 — 導出層での明示化（挙動を変えない、読み手側のみ）

1. 同期: `deriveSyncStatus(...)` を1箇所に作り、4つの写し（イベント／結果DTO／永続DTO／boolean）を1つの判別共用体に寄せる。各画面の再解釈をそこへ移す。
2. オーバーレイ: 排他ルールを1箇所の関数に集約（既存の commandPalette×shortcutsHelp の先例を一般化）。排他は同格のピア同士に限り、設定から開く子確認のような親子ダイアログは重なりを保持する（§3.1 参照）。
3. 設定ロック: `isSettingsSetupLocked` の2実装を1つに統合。`failed` でも設定を閉じられる経路を明示する。
4. ブラウザ閉鎖: `pendingBrowserCloseAction`（単体）と queue の二重表現を、queue を正本にして単体を導出にする。
5. 不変条件をテストで固定する（既に ui-store のテストは厚いので、そこへ「到達してはいけない組み合わせ」の assert を足す）。

### Phase 2 — 局所マシンの型への寄せ（中リスク、1つずつ）

1. 認証情報エディタ: 21フィールドの平坦 object を、Cloudflare Access 側と資格情報側で判別共用体に分ける。`hasSavedPassword` のエラー文言マッチをやめ、バックエンドからの明示フラグに寄せる。
2. Add Feed: `phase` フィールドを導入し、発見→選択→送信の段階を型で表す。登録の3コマンドを1つのトランザクション的単位に寄せる（失敗時の空フォルダ残留を解消）。
3. OPML: 確認段階と結果段階（件数・スキップ数）を追加する。ファイル選択即実行をやめる。
4. アカウント追加: stale 成功時に「作成済みアカウントへ遷移＋同期」する経路を作り、重複作成を防ぐ。戻る／キャンセルで入力を失わないようフォーム状態をモーダル外に持つか、離脱ガードの対象に含める。

### Phase 3 — Rust側の実状態（高リスク、マイグレーション＋検証とセット）

1. `sync_state`: スコープ別に型を分け、CHECK 制約と部分更新（全列上書きの廃止）を入れる。`is_in_backoff` の読取り時書込み副作用をやめる。
2. `pending_mutations`: `attempt_count`／`last_error`／`next_retry_at` を追加し、未知 `mutation_type` はその行だけ隔離して他アカウントを止めないようにする。
3. `syncing` AtomicBool: 同期／DB保守／updaterインストールの排他を分離し、`synced:false` の4つの意味を区別できる結果型にする。
4. `ProviderKind::Quarantined`: 種別から状態へ分離し、文字列往復の非対称を直す（既存DBの移行が必要）。
5. バックアップ復旧: metadata の checksum・schema_version を復旧時に照合する。

---

## 15. 良い例（このまま広げるべき雛形）

- `AccountSetupSession` — 判別共用体。`verifying` は型レベルで accountId を持てない。
- `ArticleViewSelectionState` — kind ごとに表示に必要なデータを型で必須化。store の生状態 → この共用体へ寄せる導出層の置き方が雛形。
- `PendingState`（updater）— idle/attempting/waiting/failed の union。
- `AddAccount` の Step（`{type:"pick"} | {type:"config", kind}`）、`ReaderQuerySelection`。
- feed-tree presence — "presence/diff state machine" と自ら名乗り、不変条件をコメントで明文化した純関数層＋ `TimerInstruction` の判別共用体。
- `createQuery`／`createMutation`／再試行ポリシー — 状態解釈を呼び出し側に漏らさない基盤。
- dev scenario の registry — `Record<DevScenarioId, …>` で全 ID 分の定義が型で強制、context 型が触ってよい面を限定。
- Rust側: `PageStep{Continue,Done,Incomplete}`、`UnreadSnapshot/PageScan/ReconcileOutcome`、`SyncEntry`＋`finish_plan` の決定表、`AccessSnapshot`、`CredentialLookupMode`、`StartupFocusRestoreDecision`／`MainWindowCloseDecision`。共通パターンとして「判断だけ enum 化し、実状態は bool/Option/文字列カラム側に残る」ため、判断の enum 化だけでは不十分で実状態側も寄せる必要がある。

## 16. 数え方と網羅性の限界

- 同定した候補は UI層 27件（中核13＋局所14）、データ／同期層 20件、フロー横断 30件、Rust側 40件超。重複を除くと**約60の独立した暗黙マシン**（軽微な単一boolean／トグルは別枠）。
- 網羅性は grep＋実読によるもので、動的解析（実行時トレース）はしていない。特に Rust側の `Atomic*`／`OnceLock`／`static` は grep で洗い出したが、実行時にしか現れない遷移（タイミング依存の競合）はこの調査の対象外。
- 「良い例」と「暗黙」の境界は「段階が型で読めるか」「遷移の掃除範囲が一箇所に集約されているか」で引いた。境界付近のものは本文中でその旨を明記した。
