# ダイアログのキーボード確定

ダイアログやモーダルで Enter が主アクションへ届くようにするためのルール。

## 制約

- 確認ダイアログは**主アクションへ初期フォーカスを当てる**。Base UI の Dialog は最初の tabbable 要素へフォーカスを移すので、キャンセルを先に描画すると Enter がキャンセルを押す。`ConfirmDialogView` は `initialFocus` で実行ボタンを指す
- 取り消せない操作(`destructive`)はキャンセル側へフォーカスを残す。キーボード活性化は press-and-hold ゲートを通らず即実行されるため、初期フォーカスを当てると Enter 一発で走る
- フォームダイアログの submit ボタンは **`<form>` の子孫に置く**。submit ボタン不在時の implicit submission フォールバックに依存しない
- `submitType="submit"` と onClick の `onSubmit` を同時に渡さない。二重発火する
- Enter を手で扱うときは IME を `isImeCommitKeyEvent`(`src/lib/keyboard/ime-key-event.ts`)で除外する。`isComposing` を直接読まない
- 新しいダイアログシェルを足すときは、Enter の確定経路を契約テストで固定する

## Enter の契約

「主アクションへ送る」と広く書かない。キャンセルにフォーカスがある Enter や選択 UI の Enter まで送る解釈ができてしまう。

| 状況 | 期待 |
| --- | --- |
| 単一行入力にフォーカスがあるときの Enter | submit(1 回だけ) |
| IME 候補確定の Enter | submit しない |
| Select / combobox 上の Enter | 選択のみ。親フォームを送信しない |
| キャンセルボタンにフォーカスがあるときの Enter | キャンセルのみ |
| Escape | submit しない。子 UI とダイアログの閉じ方は現状維持 |

## 根拠

### implicit submission はフィールド数で挙動が変わる

HTML の implicit submission は、フォーム内に submit ボタンが無い場合、**implicit submission を阻む field がちょうど 1 つのときだけ**発火する。submit ボタンをフッターに置いてフォームの外に出すと、フィールドが 1 つのうちは動いて見え、条件付きの入力欄(「新規フォルダ」など)が現れた瞬間に黙って止まる。壊れ方が状態依存なので、実装時のテストを通り抜ける。

`form` 属性(`<form id>` + `<button form={id}>`)でフォームに所有させれば実ブラウザでは動くが、テストで検出できない(次節)。ボタンをフォームの子孫にするのが、実ブラウザとテストの両方で成立する唯一の形である。

阻害 field の数はソースを読んだだけでは数え違える。実ブラウザで確認すること。2026-09-15 の実測では、フィード追加ダイアログは既定状態で既に `feed-url`(type=url)と `feed-folder`(type=text)の 2 つを持っており、「新規フォルダを選んだときだけ 2 つになる」という事前の読みは誤りだった。つまり Enter は条件付きではなく常に効いていなかった。

### user-event の Enter は実ブラウザの implicit submission ではない

`@testing-library/user-event` 14.6.7 の `event/behavior/keypress.js` は Enter に対して:

```js
const submit = form?.querySelector('input[type="submit"], button:not([type]), button[type="submit"]');
if (submit) return () => instance.dispatchUIEvent(submit, 'click');
else if (form && SubmitSingleInputOnEnter.includes(target.type) && form.querySelectorAll('input').length === 1)
  return () => instance.dispatchUIEvent(form, 'submit');
```

2 点が HTML 仕様と食い違う。

- submit ボタンの探索が `form.querySelector(...)` = **子孫検索**。`form` 属性で関連付けただけのフォーム外ボタンは見つからない
- fallback 分岐の `querySelectorAll('input').length === 1` は **radio も数える**。仕様上 radio は阻害 field ではないので、色ピッカーのような radio 群があるフォームは仕様では implicit submission が成立するのに user-event では成立しない

したがって Enter の契約テストは、**実ブラウザ確認とセットでなければ完結しない**。テストだけで閉じると、1 入力のフォームは関連付けが壊れていても緑になる。

### `fireEvent.submit` を証拠に使わない

`fireEvent.submit(form)` はフォームの submit イベントを直接投げるだけで、「Enter がそこへ到達するか」を何も確かめていない。契約テストは必ず実キー入力(`user.keyboard("{Enter}")` / `user.type`)で書く。

## 例

### 正しい

```jsx
// submit ボタンがフォームの子孫。スクロール領域は内側の div が持つ
<form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
  <DialogFooter>
    <FormActionButtons submitType="submit" />{/* onSubmit prop は渡さない */}
  </DialogFooter>
</form>
```

```ts
// IME は共有ヘルパーで除外する
if (isImeCommitKeyEvent(event.nativeEvent)) {
  return;
}
if (event.key === "Enter") { /* ... */ }
```

### 不正

```jsx
// submit ボタンが form の兄弟。implicit submission 頼みで、フィールドが 2 つになると止まる
<form onSubmit={handleSubmit}>{children}</form>
<DialogFooter>
  <FormActionButtons onSubmit={submitWithGuard} />
</DialogFooter>
```

```ts
// macOS WKWebView では候補確定の Enter が isComposing === false で届く
if (event.nativeEvent.isComposing) {
  return;
}
```

## 強制

- [x] 契約テスト(`src/__tests__/components/form-dialog-shell.test.tsx`、`confirm-dialog-view.test.tsx`)
- [x] 実画面確認([ui-design-review-loop.md](./ui-design-review-loop.md) の必須フロー)
- [x] 手動レビュー

## 関連ルール

- [ui-browser-prep.md](./ui-browser-prep.md): 実画面で確認する手順
- [ui-design-review-loop.md](./ui-design-review-loop.md): 完了前の観点別チェック
- [shadcn-ui.md](./shadcn-ui.md): `src/components/ui/` を直接編集しない
- [contract-test-policy.md](./contract-test-policy.md): 新しいガードが実際に落ちることを先に確かめる
