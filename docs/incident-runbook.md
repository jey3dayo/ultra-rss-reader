# Incident Runbook

Use this page when the app is already failing and you need the fastest path to the right logs, backups, or manual checks.

## First Triage

1. Identify which area is failing:
   - startup / migration
   - updater
   - account credentials / keyring
   - sync
2. Capture:
   - app version
   - OS
   - whether this is a dev build or packaged build
3. If this is a packaged build, open the log directory first.
4. Do not paste secrets into tickets or chat. Mask credentials, tokens, cookie values, and account passwords before sharing logs.

## Where To Look

### Release Logs

- Packaged builds write file logs.
- Use the in-app "Open log directory" flow or `get_log_dir`.
- `open_log_dir` opens the native folder picker and intentionally does not expose the resolved filesystem path to the webview.
- Keep the log bundle before retrying destructive recovery steps.
- When escalating, share the saved log file or redacted snippets, not an unredacted full user data directory.
- Treat old release logs, support/debug logs, and support dumps as private data even after the database or credentials have been reset.

### Diagnostic Sources

Use the source that matches the failure mode before collecting broader artifacts:

| Failure area | First diagnostic source | Escalate when |
| --- | --- | --- |
| startup / migration | Packaged release log plus reported database or backup path | The app cannot reopen the database after preserving backup artifacts |
| account credentials / keyring | Packaged release log plus OS keyring behavior notes | Credentials cannot be saved or reloaded with `DEV_CREDENTIALS` disabled |
| sync | Packaged release log plus account name and toast/warning text | The same account repeatedly reports failure, partial failure, or retry-pending warnings |
| WebView / browser preview | Debug HUD geometry rows plus packaged release log when available | Native and layout bounds disagree, content is blank, or the embedded preview cannot be recreated |

Do not mix app UI debug actions with log collection in the same note. Record which button or command was used, then attach the corresponding diagnostic source separately.

### Database Backups

- Migration recovery keeps the relevant backup artifacts for manual investigation.
- Check the migration error output first to find the backup path that was created for the failed startup.
- Do not delete backup files until you have confirmed the app can reopen the database safely.
- Treat the main `.db` file and any matching `-wal` / `-shm` sidecars as a backup set.
- On Windows, close the app before copying or replacing any database files; file locks can make partial restores look successful.
- If restore fails, preserve the failed database, backup set, and release log before trying another restore path.

### Private Data Reset And Uninstall

Use private data reset only after preserving any logs or backups needed for an active incident. Reset and uninstall are not the same privacy operation: removing the app binary may leave app data, credentials, logs, support/debug logs, support dumps, and backups behind.

Before telling a user that private data has been cleared, verify each surface separately:

- local app database and any `-wal` / `-shm` sidecars
- OS keyring credentials
- preferences, window state, and local app settings
- release logs opened by the in-app log-directory flow
- stale support/debug logs and support dumps created during troubleshooting
- migration backups or manually copied database backup sets

If any surface cannot be removed because of OS permissions, file locks, or an unknown platform path, report the reset as incomplete and preserve the error plus the remaining artifact type. Do not ask users to share raw app data directories as proof of deletion.

### Manual Verification Checklist

- For release validation or packaged-build handoff, use [release-manual-verification.md](./release-manual-verification.md).
- That checklist is the source of truth for FreshRSS live verification, native keyring verification, and packaged updater verification.

## Failure-Specific Steps

### 1. Startup / Migration Failure

1. Read the startup error as-is and note the reported database or backup path.
2. Open the release log directory and save the latest log file.
3. Check whether a backup was created before the failed migration.
4. If the failure happened after an upgrade, stop and preserve the backup before retrying.
5. Confirm whether a matching `-wal` or `-shm` file exists for either the current database or the backup.
6. If manual restore is needed, restore the complete backup set with the app closed, then reopen once and capture the result.
7. If needed, continue from the migration recovery docs and issue tracking instead of improvising manual DB edits.

### 2. Updater Failure

1. Confirm whether the failure happened during:
   - update check
   - download
   - install / restart
2. Save the packaged-build logs.
3. Verify the current app version did not unexpectedly change.
4. Re-run the updater path only after confirming the signed release and packaged build pair you are testing.
5. If restart failed, capture the toast/error message and log output together.

### 3. Account Credentials / Keyring Failure

1. Confirm whether the issue is:
   - saving credentials
   - reloading credentials after restart
   - deleting or replacing stored credentials
2. Check whether the build is using `DEV_CREDENTIALS=1`.
3. For packaged builds, verify behavior against the OS-native keyring, not the dev credential file path.
4. Save logs before removing and re-adding the account.

### 4. Sync Failure

1. Distinguish between:
   - full failure
   - partial failure
   - warning / retry-later behavior
2. Save logs before retrying repeated sync attempts.
3. Note which account names appear in the toast or warning output.
4. If the failure suggests retry/backoff behavior, preserve the first error rather than hammering manual retries.

## Escalation Notes

When handing the issue off, include:

- app version and OS
- whether it was a dev build or packaged build
- exact toast / error message
- relevant account name
- path to saved logs
- path to backup artifacts, if migration was involved
- whether stale support/debug logs or support dumps were created and whether they were deleted after the incident
