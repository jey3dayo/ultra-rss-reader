# GitHub Releases によるバイナリ配布

## 概要

Git タグ (`v*`) プッシュをトリガーに、GitHub Actions で macOS (Intel + Apple Silicon) と Windows のバイナリをビルドし、GitHub Release に自動アップロードする。

## ワークフロー構成

**新規ファイル:** `.github/workflows/release.yml`

```
v* タグ push
  -> 3 並列ジョブ (macOS-arm64, macOS-x86_64, Windows-x86_64)
    -> 各 OS で tauri build
      -> tauri-action が GitHub Release を作成 & アーティファクト添付
```

## ビルドマトリクス

| ターゲット            | runner                 | 成果物                 |
| --------------------- | ---------------------- | ---------------------- |
| macOS (Apple Silicon) | `macos-latest` (arm64) | `.dmg`                 |
| macOS (Intel)         | `macos-13` (x86_64)    | `.dmg`                 |
| Windows               | `windows-latest`       | `.msi` + `.exe` (NSIS) |

## 使用アクション

- **`tauri-apps/tauri-action@v0`** — Tauri 公式。ビルド + GitHub Release 作成 + アーティファクト添付を一括で行う
- 既存 CI (`ci.yml`) はそのまま維持。リリースワークフローは独立

## トリガー

```yaml
on:
  push:
    tags: ["v*"]
```

## Release の内容

- タグ名がリリースタイトル (e.g. `v0.1.0`)
- Draft リリースとして作成（手動で公開に切り替え）
- 各プラットフォームの成果物が自動添付

## スコープ外（将来追加可能）

- コード署名
- 自動アップデーター (`tauri-plugin-updater`)
- Linux ビルド
