---
name: tauri-icon-gen
description: "Use when an existing app image should be converted into Tauri-ready icons, including transparency cleanup, square source normalization, and `pnpm tauri icon` generation. Do not use for skill directory moves, path fixes, distribution, or marketplace packaging even if the path contains `tauri-icon-gen`; use `skill-creator` instead."
version: 1.0.0
tags: [tauri, icon, png, transparency, image-processing]
triggers:
  - アイコン生成
  - アイコン変換
  - 透過PNG
  - tauri icon
  - app icon
---

# Tauri App Icon Generation

Tauri アプリ用のアイコン生成ワークフロー。ソース画像の白背景除去から全プラットフォーム向けアイコン一式の生成まで。

## First Step

作業の最初に、リポジトリルートへ移動し、入力画像が正方形かどうか確認する。非正方形なら、先に余白追加やトリミングで正方形化してから進める。

Codex では bundled script の root を `~/.agents/skills` として扱う。

```bash
SKILL_ROOT="$HOME/.agents/skills/tauri-icon-gen"
cd /path/to/tauri-project
```

## Prerequisites

- Python 3 + Pillow (`pip install Pillow`)
- pnpm + Tauri CLI (`pnpm tauri icon`)

## Source Policy

- 元画像は design master として扱い、白背景除去やトリミングで直接上書きしない。
- Tauri に渡す作業用 PNG を明示的に作る。例: `assets/app-icon-tauri-source.png` や `tmp/icon-work/source.png`。
- `src-tauri/icons/` は生成物として扱う。レビューはするが、正規の編集元にしない。
- SVG が意匠の source of truth だと明示されていない限り、既存ラスターデザインを SVG から再生成しない。SVG 近似は質感、エッジ、影、角丸の意図を壊しやすい。

### Platform Mask Policy

- macOS はアプリアイコン表示時に外側のマスクや角丸処理を行う。画像側に外側角丸、枠、影、透明余白を焼き込むと、二重角丸、過剰な余白、切り落とし、Dock での縮小感が起きる。
- ただし、角丸カードや外側影がブランド上の意図したアイコン本体である場合は、勝手に削除しない。まず「カード表現を残すのか」「OS ネイティブなフルブリードアイコンにするのか」を確認する。
- macOS ネイティブな見え方を優先する場合は、Tauri 入力を 1024x1024 のフルブリード正方形にし、外側角丸、枠、外側影、透明 padding を入れない。
- カード型の完成アイコンを維持する場合は、Tauri 入力の角 alpha と生成後の `src-tauri/icons/icon.png` の角 alpha が 0 であることを確認する。

## Workflow

### Step 0: ソース画像を正方形にする

- Tauri の元画像は正方形前提で扱う
- 非正方形画像は、この skill の script では補正しない
- 必要なら画像編集ツールや別コマンドで余白を足し、中心を保った正方形 PNG にする
- 角丸カード、枠線、影、背景ハイライトがある場合、それが意図したブランド表現か、生成 AI やスクリーンショット由来の不要な外側プレゼンテーションかを先に判定する。

### Step 1: ソース画像の透過化

白背景のソース PNG をアルファ透過に変換する。

```bash
python3 "$SKILL_ROOT/scripts/remove_white_bg.py" <input.png> [output.png]
```

- `threshold=235`: この値以上の RGB は完全透過 (alpha=0)
- `soft_threshold=215`: threshold 未満でもこの値以上なら半透過（エッジのスムージング）
- output を省略すると input を上書き
- 白いカード、白いバッジ、ライトテーマの背景が意図したデザインである場合は、白背景除去を盲目的に実行しない。作業用コピーで試し、目視比較してから採用する。

### Step 2: 透過確認

```bash
sips -g hasAlpha <output.png>
```

`hasAlpha: yes` であることを確認。目視でも透過が正しいか確認する。

### Step 3: Tauri アイコン一式生成

```bash
pnpm tauri icon <source.png>
```

`pnpm tauri icon` は Tauri プロジェクトのルートで実行する。

生成先: `src-tauri/icons/`

生成されるもの:

- PNG: 32x32, 64x64, 128x128, 128x128@2x, icon.png (512x512)
- ICNS: macOS 用 (icon.icns)
- ICO: Windows 用 (icon.ico)
- iOS: AppIcon 各サイズ
- Android: mipmap 各密度
- Windows Store: Square ロゴ各サイズ

### Step 4: 生成結果確認

```bash
sips -g hasAlpha -g pixelWidth -g pixelHeight src-tauri/icons/icon.png
magick identify -format '%f %wx%h channels=%[channels] trim=%@ corner=%[pixel:p{0,0}]\n' <source.png> src-tauri/icons/icon.png
```

確認するもの:

- Tauri に渡した source PNG
- `src-tauri/icons/icon.png`
- macOS の Finder、Dock、または `.app` bundle 表示

チェック観点:

- 外側角丸や枠が意図せず二重になっていない
- 主要モチーフが macOS 側のマスクで切れていない
- 透明 padding で小さく痩せて見えない
- 白背景除去や SVG 再生成で元デザインの質感が壊れていない
- カード型アイコンを維持する場合は source と generated icon の角 alpha が 0 になっている

## Typical Usage (Ultra RSS Reader)

```bash
SKILL_ROOT="$HOME/.agents/skills/tauri-icon-gen"
cd /path/to/tauri-project

# 元ラスターデザイン master は上書きしない
# Tauri 入力用 source を作業ファイルとして明示する
magick assets/app-icon.png -crop 1116x1116+69+69 +repage -resize 1024x1024 \
  -background none -gravity center -extent 1024x1024 \
  assets/app-icon-tauri-source.png

# 明示 source から全プラットフォーム向けに生成
pnpm tauri icon assets/app-icon-tauri-source.png

# 確認
sips -g hasAlpha -g pixelWidth -g pixelHeight src-tauri/icons/icon.png
magick identify -format '%f %wx%h channels=%[channels] trim=%@ corner=%[pixel:p{0,0}]\n' \
  assets/app-icon-tauri-source.png src-tauri/icons/icon.png
```

## Notes

- ソース画像は 1024x1024 以上を推奨（Tauri が各サイズにリサイズ）
- macOS の `.icns` と Windows の `.ico` も自動生成される
- 元画像が既に透過であれば Step 1 はスキップ可
- Pillow がない場合: `pip install Pillow`
- 生成 AI 由来の画像は外側カード、影、背景ハイライトが混ざりやすい。除去する前に、それが意図したアイコン本体か不要なプレゼンテーションかを明確にする。
