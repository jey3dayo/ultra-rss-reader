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
5. Attach diagnostics only after redacting usernames, hostnames, local filesystem paths, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, and stable device identifiers.

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
| runtime database recovery | User-facing support code plus packaged release log | A read or write command reports corruption after startup succeeded |
| account credentials / keyring | Packaged release log plus OS keyring behavior notes | Credentials cannot be saved or reloaded with `DEV_CREDENTIALS` disabled |
| sync | Packaged release log plus account name and toast/warning text | The same account repeatedly reports failure, partial failure, or retry-pending warnings |
| WebView / browser preview | Debug HUD geometry rows plus packaged release log when available | Native and layout bounds disagree, content is blank, or the embedded preview cannot be recreated |

Do not mix app UI debug actions with log collection in the same note. Record which button or command was used, then attach the corresponding diagnostic source separately.

Attachment contract:

- Prefer the smallest artifact that proves the failure: a redacted log excerpt, a screenshot of the prompt, or a copied support code.
- Do not attach raw app data directories, full database backups, keychain exports, or unreviewed support dumps to public issues.
- If a database backup set or support dump is needed, share it only through a private support channel after confirming consent and redaction preview requirements from [feed-content-privacy.md](./feed-content-privacy.md).
- Screenshots of OS prompts, SmartScreen, Gatekeeper, or permission dialogs must hide local usernames, local paths, account names, feed URLs, and server URLs.

### Database Backups

- Migration recovery keeps the relevant backup artifacts for manual investigation.
- Check the migration error output first to find the backup path that was created for the failed startup.
- Do not delete backup files until you have confirmed the app can reopen the database safely.
- Treat the main `.db` file and any matching `-wal` / `-shm` sidecars as a backup set.
- Treat database backup sets as private, unencrypted user data. They may contain subscription history, article metadata/content, tags, folders, read/star state, and sync metadata even though production credentials live in the OS keyring.
- Before a manual installer upgrade, app replacement, or updater test against a profile you care about, make an OS-level copy of the complete database backup set or app data directory and store it somewhere private.
- On Windows, close the app before copying or replacing any database files; file locks can make partial restores look successful.
- If restore fails, preserve the failed database, backup set, and release log before trying another restore path.

### Private Data Reset And Uninstall

Use private data reset only after preserving any logs or backups needed for an active incident. Reset and uninstall are not the same privacy operation: removing the app binary may leave app data, credentials, logs, support/debug logs, support dumps, and backups behind.

Retention contract:

- Uninstall or app binary deletion removes the application bundle only; it must not be described as deleting local app data.
- Reinstalling the same version or a newer version may reuse the existing app data, database, preferences, logs, and OS keyring credentials.
- App data removal is a separate privacy operation that must verify each retained surface below.
- A reset is complete only when all applicable surfaces are removed or intentionally preserved for an active incident. If any surface cannot be checked or removed, the result is incomplete.

Before telling a user that private data has been cleared, verify each surface separately:

- local app database and any `-wal` / `-shm` sidecars
- OS keyring credentials
- preferences, window state, and local app settings
- release logs opened by the in-app log-directory flow
- stale support/debug logs and support dumps created during troubleshooting
- migration backups or manually copied database backup sets

If any surface cannot be removed because of OS permissions, file locks, or an unknown platform path, report the reset as incomplete and preserve the error plus the remaining artifact type. Do not ask users to share raw app data directories as proof of deletion.

### Export And Settings Portability

- OPML export is a subscription list export. It should not contain credentials, tokens, cookies, article content, read/star state, sync metadata, local paths, or database backup metadata, but feed titles, folder names, and feed URLs can still be private.
- App settings export/import is not a supported recovery promise until a schema version, source app identifier, secret exclusion list, import conflict behavior, and encryption decision are defined.
- Do not recommend exporting settings as an uninstall/reinstall backup unless that versioned contract exists for the build being tested.

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

### 2. Runtime Database Recovery

Use this path when startup succeeded but a later read or write command reports corruption.

1. Stop write-heavy actions and keep the app in read-only degraded mode when available.
2. Save the packaged release log and the user-facing support code or diagnostics ID.
3. Run the app-provided integrity check action before attempting manual database edits.
4. If corruption is confirmed, preserve the current database and matching `-wal` / `-shm` sidecars before restore.
5. Restore only from a complete backup set, then restart the app and confirm the same command no longer reports corruption.
6. Treat DB lock failure, permission denied, and disk full as separate recovery categories. Do not present them as corruption unless the integrity check confirms corruption.

### 3. Updater Failure

1. Confirm whether the failure happened during:
   - update check
   - download
   - install / restart
2. Save the packaged-build logs.
3. Before retrying an install/restart against a profile you care about, preserve the current app data or complete database backup set as private user data.
4. Verify the current app version did not unexpectedly change.
5. Re-run the updater path only after confirming the signed release and packaged build pair you are testing.
6. If restart failed, capture the toast/error message and log output together.

### 4. Account Credentials / Keyring Failure

1. Confirm whether the issue is:
   - saving credentials
   - reloading credentials after restart
   - deleting or replacing stored credentials
2. Check whether the build is using `DEV_CREDENTIALS=1`.
3. For packaged builds, verify behavior against the OS-native keyring, not the dev credential file path.
4. Save logs before removing and re-adding the account.

### 5. Sync Failure

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
- whether each attached diagnostic artifact was redacted before sharing
