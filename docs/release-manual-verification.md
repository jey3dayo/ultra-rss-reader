# Release Manual Verification

`mise run ci` is the repository gate, but it intentionally stops before live-service and packaged-app checks.
Use this checklist before cutting a release tag or shipping a packaged build to someone else.

## When to Run It

- Before tagging `v*`
- Before sharing a packaged build for external verification
- After changing updater, keyring, account auth, or packaged-app startup behavior

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

### 2. Native Keyring Verification

Run the packaged app on the target OS with normal credentials storage enabled.

Confirm:

- Adding a FreshRSS or Inoreader account stores credentials without falling back to dev storage.
- Restarting the app keeps the account usable without re-entering the password.
- Editing account settings does not silently lose the stored secret.
- Removing the account leaves the app in a clean state and does not block re-adding it.
- A failed credential save leaves the account list and keyring in a retryable state.

### 3. Packaged Updater Verification

Use an installed older build plus a signed draft release.

Confirm:

- The app can detect the new version from the packaged build.
- Download starts and completes without a stuck progress state.
- Install/restart applies the new version successfully.
- If updater verification fails, the app stays on the current version and surfaces a useful error.
- After a failed download or install, a manual recheck can start a fresh updater flow.

### 4. Packaged Startup Verification

Start the packaged app from a clean user data profile when possible, then repeat once with an existing profile from the previous release.

Confirm:

- The first window appears without requiring a dev server or dev credentials path.
- Existing accounts, preferences, and last selected reader state load without schema errors.
- A migration failure message points to the backup location and tells the verifier to preserve logs before retrying.
- Quitting and reopening the app does not require manual cleanup of `-wal` or `-shm` files.

### 5. Log and Recovery Sanity Check

From the packaged build, use the in-app log-directory flow or `get_log_dir`.

Confirm:

- Release logs are written to disk.
- You can locate the logs needed for updater or sync troubleshooting.
- The log-directory action opens the native folder without showing a raw path in the webview.
- Any shared logs are redacted for credentials, tokens, cookies, and passwords.
- Any failure observed during this checklist leaves enough logs to debug it later.

## Record the Result

Write down:

- OS and build version verified
- Whether `mise run test:live` passed
- Whether native keyring verification passed
- Whether packaged updater verification passed
- Where the supporting logs or screenshots were saved, if any

If something fails during this checklist, continue from [incident-runbook.md](./incident-runbook.md) instead of improvising ad-hoc recovery steps.
