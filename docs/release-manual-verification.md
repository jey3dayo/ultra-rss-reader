# Release Manual Verification

`mise run ci` is the repository gate, but it intentionally stops before live-service and packaged-app checks.
Use this checklist before cutting a release tag or shipping a packaged build to someone else.

## When to Run It

- Before tagging `v*`
- Before sharing a packaged build for external verification
- After changing updater, keyring, account auth, or packaged-app startup behavior
- After changing uninstall, private data reset, support dump, or diagnostics retention behavior

## Prerequisites

1. `mise run ci` passes on the release commit.
2. A packaged build is available for the target OS.
3. FreshRSS live credentials are available in `.env` if the build still supports FreshRSS.
4. A signed draft release exists if you are verifying the updater install path.
5. The previous release build is available when verifying updater install and restart behavior.

## Checklist

### 1. FreshRSS Live Verification

Run `mise run test:live`.

Confirm:

- FreshRSS authentication succeeds with real credentials.
- Initial sync completes without manual DB cleanup.
- Basic article read/unread and star actions still round-trip correctly.
- The verification record contains only pass/fail status and sanitized account labels, not credential values.

### 2. Published Release Install Verification

Install the published release artifact downloaded from GitHub Releases. Do not use `mise run app:install` for this step.

Confirm and record:

- Release artifact name and source release URL
- Release asset digest, for example `sha256:<digest>`
- Codesign result, for example `codesign --verify --deep --strict --verbose=2 <app>`
- Gatekeeper result, for example `spctl --assess --type execute --verbose <app>`
- Installed app version shown by the packaged app

`mise run app:install` is only a local build/install helper. It rebuilds from the current checkout and may re-sign the local macOS app after copying it into `/Applications`; it is not evidence that the published release artifact, notarization, or Gatekeeper path works.

### 3. Native Keyring Verification

Run the packaged app on the target OS with normal credentials storage enabled.

Confirm:

- Adding a FreshRSS or Inoreader account stores credentials without falling back to dev storage.
- Restarting the app keeps the account usable without re-entering the password.
- Editing account settings does not silently lose the stored secret.
- Removing the account leaves the app in a clean state and does not block re-adding it.
- A failed credential save leaves the account list and keyring in a retryable state.

### 4. Packaged Updater Verification

Use an installed older build plus a signed draft release.

Confirm:

- The app can detect the new version from the packaged build.
- Download starts and completes without a stuck progress state.
- Install/restart applies the new version successfully.
- If updater verification fails, the app stays on the current version and surfaces a useful error.
- After a failed download or install, a manual recheck can start a fresh updater flow.

### 5. Packaged Startup Verification

Start the packaged app from a clean user data profile when possible, then repeat once with an existing profile from the previous release.

Confirm:

- The first window appears without requiring a dev server or dev credentials path.
- The main window opens on a visible display after disconnecting any external monitor used by the previous run.
- Saved negative or off-screen window coordinates are not restored; the fallback is the platform default visible placement.
- Existing accounts, preferences, and last selected reader state load without schema errors.
- A migration failure message points to the backup location and tells the verifier to preserve logs before retrying.
- Quitting and reopening the app does not require manual cleanup of `-wal` or `-shm` files.

### 6. App Data and Bundle Identifier Migration Policy

Keep the release bundle identifier stable at `com.jey3dayo.ultra-rss-reader`.
Changing it changes the OS-owned app data, log, and credential namespaces, so a release that changes the identifier must not ship without an explicit migration plan.

Confirm before release:

- `src-tauri/tauri.conf.json` and `src-tauri/tauri.release.conf.json` both use `com.jey3dayo.ultra-rss-reader`.
- No automatic app data directory rename is attempted during normal startup.
- If a future identifier change is required, the release plan documents old identifier detection, database copy or backup guidance, the fact that OS keyring credentials may need user re-entry, log path changes, and rollback steps.

### 7. Packaged App Icon and Badge Verification

Run the packaged app on the target OS. This is a visual OS integration check; do not change icon assets or icon design as part of this pass.

Confirm:

- On macOS, unread badge changes are reflected on the Dock icon and clear when unread badge display is disabled.
- On Windows, unread badge changes are reflected on the taskbar icon and clear when unread badge display is disabled.
- Runtime window icon replacement follows the selected light, dark, or system theme when the platform reports support for it.
- Runtime icon or badge failures do not block startup, account sync, article reading, or later badge/theme updates.

### 8. Log and Recovery Sanity Check

From the packaged build, use the in-app log-directory flow or `get_log_dir`.

Confirm:

- Release logs are written to disk.
- Release log timestamps use the packaged app's local timezone policy (`TimezoneStrategy::UseLocal`). When sharing logs across timezones, record the verifier's OS timezone and local offset together with the log.
- You can locate the logs needed for updater or sync troubleshooting.
- The log-directory action opens the native folder without showing a raw path in the webview.
- Any shared logs are redacted for credentials, tokens, cookies, and passwords.
- Any failure observed during this checklist leaves enough logs to debug it later.

### 9. Uninstall, Private Data Reset, and Support Artifact Retention

Verify this when a release changes installer/uninstaller behavior, private data reset, diagnostics export, support/debug copy, or app data paths.

Confirm and record:

- Uninstalling or deleting the app binary does not get described as deleting all private data unless app data, credentials, logs, support/debug logs, support dumps, and backups were checked separately.
- Reinstalling the same or a newer version does not silently depend on stale support/debug logs or support dumps.
- Private data reset guidance covers the local database, `-wal` / `-shm` sidecars, OS keyring credentials, preferences/local app state, release logs, stale support/debug logs, support dumps, and migration backups.
- Manual log deletion and support dump deletion are documented as separate cleanup steps after an incident is resolved.
- If any artifact cannot be removed because of OS permissions, file locks, or an unknown path, the user-facing result says the reset is incomplete.
- Support/debug copy does not automatically include hostname, local filesystem paths, OS username, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, or a stable device identifier.
- If support needs environment context, ask for app version, OS family, CPU architecture, locale, and timezone offset as separate non-secret fields instead of adding a stable fingerprint to default debug copy.

## Record the Result

Write down:

- OS and build version verified
- Published release artifact name and release URL
- Release asset digest
- Codesign verification result
- Gatekeeper assessment result
- Whether `mise run test:live` passed
- Whether native keyring verification passed
- Whether packaged updater verification passed
- Whether packaged app icon and badge verification passed
- Whether uninstall/private data reset/support artifact retention verification passed, if in scope
- Where the supporting logs or screenshots were saved, if any
- OS timezone and local offset for any shared release logs

If something fails during this checklist, continue from [incident-runbook.md](./incident-runbook.md) instead of improvising ad-hoc recovery steps.
