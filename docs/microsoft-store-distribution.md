---
type: runbook
title: Microsoft Store Distribution
description: How the MSIX build for the Microsoft Store differs from the direct download, how to ship an update through Partner Center, and the known runtime constraints of the packaged app.
resource: urn:ultra-rss-reader:docs:microsoft-store-distribution
tags: [category/release, audience/maintainer, environment/windows]
timestamp: 2026-11-19
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
| `.github/workflows/store-msix.yml` | Successful tag-push Release workflow completion, published stable GitHub Release, or manual `workflow_dispatch` | Builds and uploads the `store-msix` artifact. For an eligible release, calls `scripts/release/submit-store.ps1` to submit through the Store API |

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

1. Bump the version with `node scripts/release/bump-version.ts <version>`; it updates the MSIX manifest and the other version sources.
2. Publishing a stable GitHub Release starts **Store MSIX**. A successful tag-push Release workflow also starts it, but submission is skipped unless the release is already published. A Release workflow dispatch does not start this fallback. The workflow verifies the tag, source SHA, and built MSIX version, then saves the `store-msix` artifact before attempting Store submission.
3. For an eligible release with credentials configured, the workflow creates a draft, uploads the package, and commits it through the submission API for certification. The API value `targetPublishMode: Immediate` requests automatic publication after certification. The workflow immediately reads back the same submission and checks the exact configured price tier, package filename, release version (`X.Y.Z.0`), and publish mode. Package ingestion is asynchronous, so the workflow polls for up to five minutes for the version and `Uploaded` status. Certification and public availability can finish after those checks pass.
4. Manual dispatch keeps the following modes. Submission requires `ref: refs/tags/vX.Y.Z` for a published stable release. The submission script comes from the exact workflow commit, so a workflow run from main can also build an older release tag.

   | `submit` | `auto_commit` | Result |
   | --- | --- | --- |
   | `false` (default) | Either | Build and save the MSIX artifact |
   | `true` | `true` (default) | Create a draft, commit for certification, and publish automatically after certification |
   | `true` | `false` | Create an API-managed draft and leave it pending with `targetPublishMode: Manual` |

   Missing credentials skip Store submission. For a requested, eligible submission, the workflow saves the artifact and then fails before contacting the Store if `MSSTORE_PRICE_ID` is unset or malformed, including when credentials are missing. The accepted format is case-sensitive ASCII `Tier` followed by one or more digits, with no whitespace. Partner Center validates whether the tier is available for the product when the script updates the draft. A rejected update stops before commit and leaves the draft for inspection.
5. Configure these secrets and the variable under **Settings → Environments → microsoft-store**:

   | Secret | Partner Center / Microsoft Entra value |
   | --- | --- |
   | `MSSTORE_TENANT_ID` | Microsoft Entra tenant ID |
   | `MSSTORE_CLIENT_ID` | Microsoft Entra application client ID |
   | `MSSTORE_CLIENT_SECRET` | Microsoft Entra application client secret |

   | Variable | Value |
   | --- | --- |
   | `MSSTORE_PRICE_ID` | Base price tier of the product, such as `Tier1052`. See [Base price tier](#base-price-tier) |

   The Entra application needs submission permissions. Authentication uses the Entra client-credentials token endpoint and the `https://manage.devcenter.microsoft.com` resource. `MSSTORE_SELLER_ID` is not used by the submission API. Tokens, signed upload URLs, request bodies, and API error bodies are excluded from script output.
6. For the first automatic release, monitor the created submission through the API until it is `Published` and verify its package version again. Confirm public Store availability and the installed package version.

### Existing draft and status guard

The script reads the exact application and verifies its ID and last published submission before creating a new draft. Any `pendingApplicationSubmission` stops the run. Creating a submission can also fail with HTTP 409 if a pending submission appears after the read. The script never deletes or reuses a pending submission and only updates and commits the new ID returned by its own create request.

After creation, failures preserve the submission for inspection. A rerun stops while it remains pending. Handle drafts from earlier releases separately. Coordinate Partner Center work with automated runs.

The script follows the [submission API sequence](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions): create a clone of the last published submission, mark its old MSIX `PendingDelete`, register the new MSIX as `PendingUpload`, update the draft, upload a ZIP to its Azure Blob SAS URL, and commit the new submission ID. It refuses an unexpected cloned package set instead of removing additional packages. It preserves the cloned metadata and listings, including privacy, website, and support links. Only the package entries, explicit base price tier, and publish mode change.

### Base price tier

The Store submission API has returned this product's base price as `priceId = "Base"` because it is managed per market. That value cannot be sent back as a base price tier. The submission API replaces the whole submission on update, and an empty `priceId` can turn the product free without an error. Every run therefore requires an explicit `MSSTORE_PRICE_ID` (currently `Tier1052`) and verifies that exact value before and after commit.

- The script changes only `pricing.priceId`, preserving the cloned `marketSpecificPricings`, sales, and other pricing fields. It checks the inherited market-specific price map before commit and on every post-commit read. The [pricing resource documentation](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions#pricing-resource) defines these entries as overrides of the base price. Confirm the actual market prices in Partner Center when changing the configured tier.
- Microsoft's [base price tier table](https://learn.microsoft.com/windows/apps/publish/msstore-dev-cli/ci-cd-environments#pricing-configuration-for-msix-packaged-apps) includes `Tier1052` ($4.99). Confirm current market prices in Partner Center under **Pricing and availability** before setting the variable.
- Update `MSSTORE_PRICE_ID` whenever the base price changes in Partner Center. A stale value resets the draft to the old price.

#### Inspecting a draft or failed run

For `submit: true, auto_commit: false`, the package remains `PendingUpload` until the API commit starts ingestion. The API may omit its version until then. The workflow checks the registered filename, price tier, and manual publish mode before leaving the draft. Commit it only through `POST /v1.0/my/applications/9N85DQ7XKQ20/submissions/{submissionId}/commit`, then read that same ID back to verify `ultra-rss-reader.msix`, version `X.Y.Z.0`, `Uploaded`, and the configured tier. Manual publish mode still requires a separate publication step after certification.

Inspect package and pricing details through the API. Submitting from Partner Center dropped the pending replacement package and certified the old version in [#667](https://github.com/jey3dayo/ultra-rss-reader/issues/667). Microsoft also advises using the API for subsequent edits to an API-created draft. Review any mismatch or ingestion timeout before deciding how to recover. Reruns stop while the submission is pending. [Microsoft Store submission API](https://learn.microsoft.com/en-us/windows/uwp/monetize/manage-app-submissions)

After a price change or a tier correction, update `MSSTORE_PRICE_ID` before the next run. If there is already a draft, inspect it and decide whether to update its price through the API or abandon it.

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

The Store build reports whether the updater has a configured endpoint and public key through `get_platform_info`. The command palette only offers "Check for Updates" when that flag is true; it also drops a stored history entry for the action when unavailable. The direct-download build keeps the action. The native menu item continues to be disabled in the Store build.

## Listing Notes

- `runFullTrust` is a restricted capability and needs a justification in the submission options. The submitted text explains that the app is a classic Win32 Tauri process that hosts WebView2, stores data in local SQLite, saves credentials in Credential Manager, and opens links in the default browser.
- The privacy policy URL points to [../PRIVACY.md](../PRIVACY.md) on GitHub.
- The listing is paid, in English (en-US) and Japanese (ja-JP). Paid distribution needs both a tax profile and a payout profile assigned in Partner Center.
- Screenshots must not show a third-party product name as the headline of the screen (policy 10.1.1.3). See [store-screenshots.md](./store-screenshots.md).
