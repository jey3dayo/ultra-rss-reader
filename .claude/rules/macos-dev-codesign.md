# macOS 開発用コード署名

## 問題

`cargo tauri dev` は毎回バイナリを再ビルドするため、macOS が未署名の新しいアプリとして扱い、Keychain アクセスのたびに許可ダイアログが表示される。

## 解決策

自己署名証明書 `UltraRSSReader-Dev` で dev バイナリに署名する。

### セットアップ（初回のみ）

```bash
# 1. 自己署名コード署名証明書を作成
openssl req -x509 -newkey rsa:2048 \
  -keyout /tmp/codesign-key.pem -out /tmp/codesign-cert.pem \
  -days 3650 -nodes \
  -subj "/CN=UltraRSSReader-Dev" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning"

# 2. p12 に変換してキーチェーンにインポート
openssl pkcs12 -export -out /tmp/codesign.p12 \
  -inkey /tmp/codesign-key.pem -in /tmp/codesign-cert.pem \
  -passout pass:dev -legacy
security import /tmp/codesign.p12 -k ~/Library/Keychains/login.keychain-db \
  -P "dev" -T /usr/bin/codesign -T /usr/bin/security

# 3. コード署名用に信頼
security add-trusted-cert -d -r trustRoot -p codeSign \
  -k ~/Library/Keychains/login.keychain-db /tmp/codesign-cert.pem

# 4. 確認
security find-identity -v -p codesigning
# → "UltraRSSReader-Dev" が表示されれば OK

# 5. 一時ファイルを削除
rm -f /tmp/codesign-key.pem /tmp/codesign-cert.pem /tmp/codesign.p12
```

### 使い方

```bash
mise run app:dev:signed   # ビルド → 署名 → 実行（Keychain ダイアログなし）
mise run app:dev          # 従来通り（署名なし、ダイアログあり）
```

## 注意

- 証明書は開発専用。配布用ビルドには使わない
- `app:dev:signed` はファイル監視なし（ワンショット実行）。コード変更時は再実行が必要
