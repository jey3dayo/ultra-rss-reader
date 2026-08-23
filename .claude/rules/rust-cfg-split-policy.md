# Rust cfg ゲート付きコードの分割

`#[cfg(target_os = ...)]` や `#[cfg(test)]` でゲートされたコードを含むファイルを分割するときのルール。

## 制約

- ゲートされたアイテムを別ファイルへ移すとき、**その `use` にも同じ cfg を付ける**。使用箇所だけがゲートされ import が無条件だと、そのターゲットで未使用 import になる。
- 分割後に `mise run check` が緑でも、それは**開発機のターゲットで通っただけ**。cfg 分岐を含む分割は、CI の `Lint (ubuntu-latest)` と `Lint (windows-latest)` が両方 green になるまで merge しない。
- clippy は CI で `-D warnings` のため、unused import は warning ではなく **error でビルドを止める**。

## 根拠

macOS の開発機では `#[cfg(target_os = "macos")]` のアイテムがコンパイルされるので、無条件 import も「使われている」と判定される。pre-push フルゲートも同じ機械で走るため通過する。Linux / Windows で初めて未使用になり、CI の lint で落ちる。ローカル緑を merge の根拠にすると必ず踏む。

実例(いずれも 2026-08-23):

- PR #104 browser_webview 分割 — cfg-gate した close-bridge import が定義側と不一致。
- PR #128 keyring_store 分割 — `macos_security_cli.rs` の import 3 行が無条件で、使用箇所は `#[cfg(any(target_os = "macos", test))]`。Lint (ubuntu/windows) 両方で 3 error。

## 例

### 正しい

```rust
#[cfg(any(target_os = "macos", test))]
use super::redaction::redact_diagnostic_text;

#[cfg(any(target_os = "macos", test))]
fn spawn_security_cli() -> DomainResult<()> {
    redact_diagnostic_text(/* ... */);
    // ...
}
```

### 不正

```rust
// import が無条件。macOS 以外では未使用となり clippy -D warnings で error
use super::redaction::redact_diagnostic_text;

#[cfg(any(target_os = "macos", test))]
fn spawn_security_cli() -> DomainResult<()> { /* ... */ }
```

## 対処の向き

未使用 import を**消さない**。消すと開発機側のターゲットでビルドが壊れる。使用箇所と同じ cfg を付けるのが正しい対処。使用箇所そのものが分割で欠落しているケースもあるため、cfg を付ける前に「その関数が呼ばれるはずの場所が移動漏れしていないか」を先に確認する。

## 関連ルール

- `rust-test-unwrap-policy.md`: テストコードの扱い
- `quality-policy.md`: lint 抑制の方針(inline disable でなく設定側で対処)
