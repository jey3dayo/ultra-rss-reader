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

## Where To Look

### Release Logs

- Packaged builds write file logs.
- Use the in-app "Open log directory" flow or `get_log_dir`.
- Keep the log bundle before retrying destructive recovery steps.

### Database Backups

- Migration recovery keeps the relevant backup artifacts for manual investigation.
- Check the migration error output first to find the backup path that was created for the failed startup.
- Do not delete backup files until you have confirmed the app can reopen the database safely.

### Manual Verification Checklist

- For release validation or packaged-build handoff, use [release-manual-verification.md](./release-manual-verification.md).
- That checklist is the source of truth for FreshRSS live verification, native keyring verification, and packaged updater verification.

## Failure-Specific Steps

### 1. Startup / Migration Failure

1. Read the startup error as-is and note the reported database or backup path.
2. Open the release log directory and save the latest log file.
3. Check whether a backup was created before the failed migration.
4. If the failure happened after an upgrade, stop and preserve the backup before retrying.
5. If needed, continue from the migration recovery docs and issue tracking instead of improvising manual DB edits.

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
