---
type: runbook
title: Microsoft Store Distribution
description: How the MSIX build for the Microsoft Store differs from the direct download, how to ship an update through Partner Center, and the known runtime constraints of the packaged app.
resource: urn:ultra-rss-reader:docs:microsoft-store-distribution
tags: [category/release, audience/maintainer, environment/windows]
timestamp: 2026-11-15
audience: maintainer
owner: project-maintainers
---

# Microsoft Store Distribution

## Purpose

Ultra RSS Reader ships on Windows through two channels that run side by side:

- **Direct download**: the NSIS/MSI installers attached to GitHub Releases, updated through the Tauri updater.
- **Microsoft Store**: an MSIX package submitted through Partner Center, updated only by resubmitting.

This document covers the Store channel: what differs in the build, how to ship an update, and the runtime constraints found while verifying the package on Windows 11. Screenshot rules for the listing live in [store-screenshots.md](./store-screenshots.md). The full history of the first submission is in Issue [#57](https://github.com/jey3dayo/ultra-rss-reader/issues/57).

## Identity

| Key | Value |
| --- | --- |
| Store ID | `9N85DQ7XKQ20` |
| Store page | <https://apps.microsoft.com/detail/9N85DQ7XKQ20> |
| Package/Identity/Name | `jey3dayo.UltraRSSReader` |
| Package Family Name | `jey3dayo.UltraRSSReader_1118ryywbg0y2` |

The Publisher value and the rest of the Product Identity are in `msix/Package.appxmanifest` and in the 1Password item "Ultra RSS Reader | Microsoft Store Product Identity".

## Build Differences

| Piece | Source | What it does |
| --- | --- | --- |
| `src-tauri/tauri.store.conf.json` | Merged over `tauri.conf.json` with `--config` | Turns off updater artifacts and replaces the updater config with an empty one |
| `msix/Package.appxmanifest`, `msix/Assets/` | Generated once by `winapp manifest generate`, then committed | MSIX identity, version, capabilities, and tile assets |
| `.github/workflows/store-msix.yml` | Manual `workflow_dispatch` | Builds the exe with the Store config, packs it with `winapp pack`, and uploads the `store-msix` artifact |

The manifest lives under `msix/` instead of the repository root because `Assets/` would collide with the existing `assets/` directory on case-insensitive file systems.

The workflow does not sign the package. Partner Center re-signs it with a Microsoft certificate. Sign only for local sideload testing, with a self-signed certificate from `winapp cert generate`.

### Updater must be an empty config, not `null`

`plugins.updater: null` panics at startup (exit code 101), because the updater plugin cannot deserialize `null` into its `Config`. The Store config uses `{"endpoints": [], "pubkey": ""}` instead. JSON Merge Patch replaces arrays and strings, so the real endpoint URL and public key do not reach the binary. `is_updater_manual_check_configured()` then returns false, and the native "Check for Updates" menu item is disabled (grayed out, not hidden).

A repo-contracts test (`keeps store config updater disabled via empty config instead of null`) guards this. A build-time check is not enough: the first Store config passed a "strings are gone from the binary" check on macOS and still panicked on launch.

### WebView2Loader.dll is not needed in the package

The MSIX contains only the exe, `Assets/`, and the PRI file. `WebView2Loader.dll` is produced in `src-tauri/target/release/` but is not packed, and this is correct: `webview2-com` links the loader statically (`WebView2LoaderStatic.lib`). The main window and the child Web Preview webview both work in the packaged app. Do not add the DLL to the package on a review bot's suggestion.

`src-tauri/build_support/webview2_loader.rs` still has to find the DLL for the non-Store build. Cargo 1.100 changed the build-cache layout from `build/<pkg-hash>/out/` to `build/<package>/<hash>/out/`, and the helper searches both.

## Shipping an Update

The Store version does not update itself. Each new version is a resubmission.

1. Bump the version with `node scripts/release/bump-version.ts <version>`. It updates `msix/Package.appxmanifest` `Identity Version` to `<version>.0` together with the other four version sources. The contract test and the release preflight fail if they disagree.
2. Run the **Store MSIX** workflow on the release commit and download the `store-msix` artifact.
3. In Partner Center, open the submission, remove the old package, upload the new `.msix`, and confirm it shows as Validated.
4. Check that every section still carries over (pricing, markets, category, age rating, listings, submission options), then submit for certification.
5. Publishing is set to manual. After certification passes, press "Publish now" in Partner Center.

Partner Center allows only one pending submission. If a certified submission is waiting to be published and you want to ship a newer package instead, use "Cancel certification" to return it to draft, then replace the package in that same submission.

A sideloaded package with the same version cannot overwrite an installed one. Raise the manifest version, or remove the installed package first. If you used `winapp run`, run `winapp unregister` before `Add-AppxPackage`.

## Runtime Constraints

### AppData is shared with the direct download when it already exists

MSIX AppData virtualization passes through to a real directory when one exists. It is not copy-on-write. Measured on Windows 11:

| User state | Database location |
| --- | --- |
| `%APPDATA%\com.jey3dayo.ultra-rss-reader\` already exists (existing direct-download user) | That directory, shared with the direct-download build |
| Directory does not exist (new Store user) | `%LOCALAPPDATA%\Packages\jey3dayo.UltraRSSReader_1118ryywbg0y2\LocalCache\Roaming\com.jey3dayo.ultra-rss-reader\`, isolated |

So an existing user who installs the Store version keeps their data with no migration. The shared case carries two open risks:

- **Concurrent launch**: `tauri-plugin-single-instance` works only within one package identity, so the direct-download build and the Store build can run at the same time against the same SQLite database.
- **Downgrade block**: if the Store build is newer and raises the schema (`LATEST_VERSION`), an older direct-download build can no longer start against that database. See the downgrade note in [../.claude/rules/release-workflow.md](../.claude/rules/release-workflow.md).

These are accepted as known constraints for now. When triaging a Windows data problem, first ask which channel the user runs and whether both are installed.

### Verified behavior in the package

Checked on a sideloaded package: feed sync, SQLite writes, reading existing credentials from Windows Credential Manager, opening links in the default browser, Web Preview, and the disabled update menu item.

Not yet verified: saving a new credential from inside the package, and launching on a machine without the WebView2 runtime.

### Command palette update action

The native menu item is disabled in the Store build, but the command palette still offers "Check for Updates", and running it shows a failure toast. The frontend surface is not yet gated on the Store build.

## Listing Notes

- `runFullTrust` is a restricted capability and needs a justification in the submission options. The submitted text explains that the app is a classic Win32 Tauri process that hosts WebView2, stores data in local SQLite, saves credentials in Credential Manager, and opens links in the default browser.
- The privacy policy URL points to [../PRIVACY.md](../PRIVACY.md) on GitHub.
- The listing is paid, in English (en-US) and Japanese (ja-JP). Paid distribution needs both a tax profile and a payout profile assigned in Partner Center.
- Screenshots must not show a third-party product name as the headline of the screen (policy 10.1.1.3). See [store-screenshots.md](./store-screenshots.md).
