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

## Checklist

### 1. FreshRSS Live Verification

Run `mise run test:live`.

Confirm:

- FreshRSS authentication succeeds with real credentials.
- Initial sync completes without manual DB cleanup.
- Basic article read/unread and star actions still round-trip correctly.

### 2. Native Keyring Verification

Run the packaged app on the target OS with normal credentials storage enabled.

Confirm:

- Adding a FreshRSS or Inoreader account stores credentials without falling back to dev storage.
- Restarting the app keeps the account usable without re-entering the password.
- Editing account settings does not silently lose the stored secret.
- Removing the account leaves the app in a clean state and does not block re-adding it.

### 3. Packaged Updater Verification

Use an installed older build plus a signed draft release.

Confirm:

- The app can detect the new version from the packaged build.
- Download starts and completes without a stuck progress state.
- Install/restart applies the new version successfully.
- If updater verification fails, the app stays on the current version and surfaces a useful error.

### 4. Log and Recovery Sanity Check

From the packaged build, use the in-app log-directory flow or `get_log_dir`.

Confirm:

- Release logs are written to disk.
- You can locate the logs needed for updater or sync troubleshooting.
- Any failure observed during this checklist leaves enough logs to debug it later.

## Record the Result

Write down:

- OS and build version verified
- Whether `mise run test:live` passed
- Whether native keyring verification passed
- Whether packaged updater verification passed
- Where the supporting logs or screenshots were saved, if any
