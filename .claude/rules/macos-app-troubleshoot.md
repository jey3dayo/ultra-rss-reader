---
paths:
  - "src-tauri/**"
---

# macOS ビルド後のアプリ起動トラブルシューティング

## 対象

`pnpm tauri build` で生成した `.app` が macOS で開けない場合の対処。
`pnpm tauri dev` では不要。リリースビルドは CI 署名で対応。

## 症状と対処

### 「壊れているため開けません」と表示される場合

署名が壊れている・存在しない場合、アドホック再署名を行う:

```bash
codesign --force --deep --sign - "/Applications/Ultra RSS Reader.app"
```

### 「開発元が未確認」「悪質なソフトウェア」と表示される場合

ダウンロードやコピー時に付与される隔離属性（`com.apple.quarantine`）を除去する:

```bash
xattr -cr "/Applications/Ultra RSS Reader.app"
```

### 両方が必要な場合

隔離属性の除去を先に行い、その後に再署名する:

```bash
xattr -cr "/Applications/Ultra RSS Reader.app"
codesign --force --deep --sign - "/Applications/Ultra RSS Reader.app"
```
