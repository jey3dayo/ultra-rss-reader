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
- Packaged release log timestamps use local time (`TimezoneStrategy::UseLocal`). When escalating logs across timezones, record the OS timezone, UTC offset, and whether the excerpt crosses a DST boundary instead of converting timestamps in place.
- Treat release log filenames as retention/rotation labels, not as the canonical event timezone. Use the log line timestamp plus the recorded OS timezone context for support correlation.
- Keep the log bundle before retrying destructive recovery steps.
- When escalating, share the saved log file or redacted snippets, not an unredacted full user data directory.
- Treat old release logs, support/debug logs, and support dumps as private data even after the database or credentials have been reset.

### Diagnostic Sources

Use the source that matches the failure mode before collecting broader artifacts:

| Failure area                  | First diagnostic source                                                             | Escalate when                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| startup / migration           | Packaged release log plus reported database or backup path                          | The app cannot reopen the database after preserving backup artifacts                             |
| runtime database recovery     | User-facing support code plus packaged release log                                  | A read or write command reports corruption after startup succeeded                               |
| account credentials / keyring | Packaged release log plus OS keyring behavior notes                                 | Credentials cannot be saved or reloaded with `DEV_CREDENTIALS` disabled                          |
| sync                          | Packaged release log plus account name and toast/warning text                       | The same account repeatedly reports failure, partial failure, or retry-pending warnings          |
| WebView / browser preview     | Debug HUD geometry rows plus packaged release log when available                    | Native and layout bounds disagree, content is blank, or the embedded preview cannot be recreated |
| test temp directory cleanup   | Rust test output plus cleanup warning and redacted temp root class                  | A temp database, keyring fixture, or profile directory cannot be removed after retry             |
| CI frontend failure           | Vitest or Playwright output plus gate-specific screenshot/log artifact              | The failure cannot be reproduced locally from logs alone                                         |
| CI Rust failure               | Rust test output plus `RUST_LOG` output and sanitized fixture class                 | The failure involves temp database state, filesystem permissions, or platform-only behavior      |
| CI native smoke failure       | Native app log plus platform, bundle/executable class, and screenshot when relevant | The app starts differently on macOS or Windows CI than in local dev                              |

Do not mix app UI debug actions with log collection in the same note. Record which button or command was used, then attach the corresponding diagnostic source separately.

Attachment contract:

- Prefer the smallest artifact that proves the failure: a redacted log excerpt, a screenshot of the prompt, or a copied support code.
- Do not attach raw app data directories, full database backups, keychain exports, or unreviewed support dumps to public issues.
- If a database backup set or support dump is needed, share it only through a private support channel after confirming consent and redaction preview requirements from [feed-content-privacy.md](./feed-content-privacy.md).
- Screenshots of OS prompts, SmartScreen, Gatekeeper, or permission dialogs must hide local usernames, local paths, account names, feed URLs, and server URLs.

User-facing error correlation contract:

- User-facing copy may show a stable support code for the broad recovery area, such as network, account auth, keyring, database recovery, or migration recovery.
- Diagnostics IDs are ephemeral log-correlation values generated per event or export. They must not encode private data and must not be reused as stable user, device, account, or environment identifiers.
- Recovery guidance must stay separate from raw diagnostic detail. If a support code or diagnostics ID is shown, the visible copy still needs an action the user can take.

CI failure artifact contract:

- Frontend gate artifacts are UI evidence. Keep Vitest logs, browser console output, and Playwright screenshots/videos/traces scoped to the failed gate; browser-mode E2E and Storybook smoke artifacts must stay in separate directories.
- Rust gate artifacts are diagnostics evidence. Keep test output, `RUST_LOG` output when enabled, sanitized fixture class names, and temp-dir cleanup warnings; avoid uploading raw temp databases or private-looking paths.
- Native smoke artifacts are packaged-runtime evidence. Upload debug app logs, platform class, startup command class, and screenshots only on failure. Do not upload native smoke debug bundles on success.
- Artifact names must include gate family (`frontend`, `rust`, or `native-smoke`), platform when relevant, and whether the artifact is a log, screenshot, report, or sanitized fixture.
- Retention days must be declared at upload time. Increase retention only for release-blocking native smoke or packaging failures, not for routine frontend failures.

Size and truncation contract:

- Packaged release logs are capped at 5 MB per file and retained for 7 days, so the effective maximum retained release-log surface is 35 MB.
- Runtime diagnostics events must be capped at 16 KiB per event before they enter support/debug copy.
- In-memory diagnostics history must behave as a 256 KiB ring buffer and evict oldest entries before writing new diagnostics.
- If support/debug copy still exceeds the cap or cannot be copied, truncate from the middle, include `[ultra-rss-reader:diagnostics-truncated]`, and direct the user to share a manually redacted app.log excerpt instead.
- Truncation must not remove the redaction preview, artifact class list, or warning that support artifacts are private.
- Feed parser failure samples must be support-safe by default. Do not save raw feed responses, article bodies, feed URLs, article URLs, credentials, tokens, cookies, or local paths in diagnostics; record only the parser boundary, status/content-type class, cap class, coarse account/provider class, and consent/redaction state unless a private support flow explicitly accepts a raw sample.

Storage pressure contract:

- Treat browser storage quota exhaustion as a diagnostics boundary failure, not as a reason to write more warning state into browser storage.
- Preferences, sidebar expanded-folder state, command history, and debug diagnostics must all continue with in-memory fallback when local storage writes fail.
- Only the diagnostics owner may emit a warning-once event for storage quota exhaustion, and that warning-once state must not depend on another local storage write.
- Recovery UI and destructive-action fallback copy must remain visible even when preferences, sidebar state, command history, or debug storage persistence failed.
- When triaging command/action persistence failures, classify the failing surface before recovery: `shortcut_*` preference keys require preference migration or quarantine handling, command palette recent actions require history cleanup or explicit stale-entry ignore behavior, and debug input trace strings are evidence for the current build rather than data that should be migrated.

Platform permission denied copy contract:

- File permission denied: ask the user to choose a writable location or allow file access in the OS privacy settings.
- Dialog permission denied: ask the user to allow the OS file dialog and choose the file again.
- Keyring permission denied: ask the user to allow keyring access, then save or reconnect the account again.
- Clipboard permission denied: ask the user to allow clipboard access, or copy the redacted log excerpt manually.
- Permission errors must record only the failure class and artifact class needed for support. They must not expose raw local paths, credentials, clipboard payloads, account names, feed URLs, article URLs, or server URLs in user-facing copy.

### Database Backups

- Migration recovery keeps the relevant backup artifacts for manual investigation.
- Check the migration error output first to find the redacted database or backup label and backup directory label for the failed startup.
- Do not delete backup files until you have confirmed the app can reopen the database safely.
- Treat the main `.db` file and any matching `-wal` / `-shm` sidecars as a backup set.
- Treat database backup sets as private, unencrypted user data. They may contain subscription history, article metadata/content, tags, folders, read/star state, and sync metadata even though production credentials live in the OS keyring.
- App-created database backups run `integrity_check` before copying, checkpoint WAL with `TRUNCATE` before the copy, write through a temporary file plus rename, write metadata, and run `integrity_check` again on the backup before reporting success.
- Automatic restore runs `integrity_check` on the backup before staging files, restores the `.db` plus matching `-wal` / `-shm` set through temporary files and rollback files, checkpoints WAL with `TRUNCATE`, and runs `integrity_check` on the restored database before reopening it.
- Migrations run inside one SQLite transaction. If any migration step fails, the transaction rolls back to the original schema version; startup then restores the preserved pre-migration backup when one exists, otherwise the failed database and logs must be preserved for manual recovery.
- Before a manual installer upgrade, app replacement, or updater test against a profile you care about, make an OS-level copy of the complete database backup set or app data directory and store it somewhere private.
- On Windows, close the app before copying or replacing any database files; file locks can make partial restores look successful.
- If restore fails, preserve the failed database, backup set, and release log before trying another restore path.

### Private Data Reset And Uninstall

Use private data reset only after preserving any logs or backups needed for an active incident. Reset and uninstall are not the same privacy operation: removing the app binary may leave app data, credentials, logs, support/debug logs, support dumps, and backups behind.

Retention contract:

- Uninstall or app binary deletion removes the application bundle only; it must not be described as deleting local app data.
- Reinstalling the same version or a newer version may reuse the existing app data, database, preferences, logs, and OS keyring credentials.
- App data removal is a separate privacy operation that must verify each retained surface below.
- A bundle identifier change creates a different OS app data, log, and keyring namespace. Treat any apparent "missing data after update" report after an identifier change as a migration-path incident, not as a private data reset.
- A reset is complete only when all applicable surfaces are removed or intentionally preserved for an active incident. If any surface cannot be checked or removed, the result is incomplete.

Before telling a user that private data has been cleared, verify each surface separately:

- local app database and any `-wal` / `-shm` sidecars
- OS keyring credentials
- preferences, window state, and local app settings
- release logs opened by the in-app log-directory flow
- stale support/debug logs and support dumps created during troubleshooting
- migration backups or manually copied database backup sets

If any surface cannot be removed because of OS permissions, file locks, or an unknown platform path, report the reset as incomplete and preserve the error plus the remaining artifact type. Do not ask users to share raw app data directories as proof of deletion.

Destructive recovery copy contract:

- Before private data reset, clear history, cleanup orphans, or delete account recovery actions, show the target scope, whether undo is unavailable, and whether a backup should be preserved first.
- If the action has a dry-run or preview mode, present the preview before the destructive run and keep the destructive run as a separate confirmation.
- If the app cannot identify the target account/feed/tag/history scope, disable the destructive action and show a recovery reason instead of allowing a generic delete.
- Retry copy after a failed destructive action must say whether nothing changed, the result is unknown, or a partial result may require backup restore.

Account recovery contract:

- Credential reset means re-entering and saving the account password. If saving the account update fails after writing the new credential, restore the previous keyring entry; if the previous credential cannot be read, leave the account unchanged and ask the user to re-enter credentials.
- Server URL or username fix means updating account credentials metadata and then testing the connection. When either value changes, clear account-scoped `sync_state` and `pending_mutations`; when they do not change, keep the cache and pending queue.
- Cache clear means removing stale account-scoped sync state or pending mutations, not rewriting credentials. If the UI cannot expose a separate cache clear action, describe it as unavailable rather than folding it into credential reset.
- Delete account removes the database account first, then attempts to remove the matching OS keyring entry by account id. A keyring cleanup failure makes privacy cleanup incomplete, but must not resurrect the deleted database account.
- Rename account does not rename keyring entries because credentials are keyed by stable account id, not display name.

App data namespace migration contract:

- The current production bundle identifier is `com.jey3dayo.ultra-rss-reader`; normal startup must not rename the app data directory automatically.
- If a future release changes the identifier, triage must check the old identifier's app data, log, and keyring namespace before declaring data lost.
- Database migration across identifiers requires an explicit release plan with a user-visible database migration prompt or backup/copy prompt, rollback steps, and clear copy that OS keyring credentials cannot be copied automatically. OS keyring credentials may need to be re-entered.
- Log paths change with the identifier namespace. Support must collect the release log from the namespace that actually launched, and preserve the old namespace logs before any cleanup.
- Rollback across an identifier change must use the old identifier namespace or a preserved database backup; do not tell users to delete the old app data, log, or keyring namespace as a repair step.
- Do not move logs, backups, support dumps, or credentials between identifier namespaces during incident response unless the release plan says exactly which artifact class is safe to copy.

### Export And Settings Portability

- OPML export is a subscription list export. It should not contain credentials, tokens, cookies, article content, read/star state, sync metadata, local paths, or database backup metadata, but feed titles, folder names, and feed URLs can still be private.
- OPML export must not include a generated privacy summary comment by default. Privacy guidance belongs in the export UI and docs, not in the OPML artifact.
- Imported OPML feeds are owned by the account selected for import. Cross-account duplicates may be reported, but they must not be silently merged, moved, overwritten, or de-duplicated across account boundaries.
- A cross-account subscription move is a separate explicit recovery/action flow. Record source account, destination account, affected feed/folder scope, and whether read/star/tag/history state was copied, moved, or left behind.
- Import/export/backup file dialogs must treat cancel as a neutral result, require explicit overwrite confirmation for existing targets, and reject unsupported extensions or directory selections before parsing or writing.
- Filesystem paths must use native path APIs at their boundary: app-owned log, backup, and dev credential paths stay app-owned and are not exposed as raw webview recovery copy; user-selected export paths keep the selected native path only for the write surface; settings export/import remains unsupported until a versioned contract exists.
- Remote feed content and provider metadata must never provide filename or path suggestions for import, export, backup, log, or temporary artifacts. Treat publisher titles, article titles, URL path segments, enclosure filenames, favicons, `Content-Disposition`, and parser error text as display-only untrusted data.
- Atomic writes must use a temporary file in the target directory followed by rename for export, database backup/restore, and the dev credential store. A stale temporary file is not a successful artifact and must be ignored or cleaned before retry.
- If OS sleep, app restart, permission denial, or disk full interrupts an updater download, export, or backup, preserve logs and treat any partial artifact as untrusted until the flow reports a clean retry or cleanup.
- App settings export/import is not a supported recovery promise until a schema version, source app identifier, secret exclusion list, import conflict behavior, and encryption decision are defined.
- Do not recommend exporting settings as an uninstall/reinstall backup unless that versioned contract exists for the build being tested.
- If import/export cancellation is reported, record whether the user confirmed before canceling, which phase was running, and whether a partial artifact or partial feed/folder mutation may remain.
- If feed discovery added the wrong feed, record the displayed title, normalized URL class, redirect/private-host warning state, and add action result separately. Do not treat the discovery title as trusted evidence.

### Manual Verification Checklist

- For release validation or packaged-build handoff, use [release-manual-verification.md](./release-manual-verification.md).
- That checklist is the source of truth for FreshRSS live verification, native keyring verification, and packaged updater verification.

### Provider Sync Triage

Use the provider sync contract in [feed-content-privacy.md](./feed-content-privacy.md) before treating a sync issue as data loss.

- Remote missing feeds or folders are not automatic local deletes for FreshRSS. Check whether local starred articles, OPML-exportable subscription metadata, or pending read/star mutations still exist before advising unsubscribe cleanup.
- FreshRSS token expiry is server-defined and not reported. A sync that gets HTTP 401 or 403 after reauthentication should be handled as account auth recovery with scheduler backoff, not as a repeated background refresh loop.
- Many-account freshness issues should be triaged per account. One slow or retry-delayed account should not block another ready account; collect the account that is retry-pending separately from the account that is stale.
- Partial sync success must stay visible. Account detail, sidebar/feed list, and article list evidence should agree on whether the state is all-success, partial-success, all-failed, or stale cached content.
- Manual sync can bypass automatic-scheduler suppression, but it must still report the provider result and must not clear stale or partial indicators for unrelated accounts or feeds.

### Release / Update Safety Contract

Treat the app binary version, database schema version, and pending updater state as one recovery boundary. A user profile is safe to continue only when all three agree on the same completed release state or when the app stops in a user-visible recovery state before opening the database for normal writes.

Database schema compatibility:

- Starting an older app against a newer database schema is a downgrade attempt and must be blocked before normal startup writes. Do not describe this as a repairable migration.
- The supported recovery paths for a newer schema are installing an app version that supports that schema or restoring a compatible private database backup set with the app closed.
- A release rollback is allowed only when the rollback app declares compatibility with the existing schema version or when the rollback instructions include an explicit backup restore path.
- Stale update install must be rejected or surfaced as recovery-required when the update artifact's app version cannot support the profile's current database schema version.
- If migration starts and then fails, preserve the pre-migration backup, restore it when the app-created backup path is available, and keep the schema version at the pre-migration value.

Update/install failure consistency:

- After download failure or cancellation, the current app binary and database schema must remain unchanged, and pending update state must be cleared or marked retry-only so install cannot use a stale artifact.
- After install or restart failure, confirm the app binary version first, then check whether a schema migration ran. If the binary stayed old but the schema is newer, stop normal use and follow the newer-app-or-compatible-backup recovery path.
- If the binary changed but pending update state remains, clear the pending state before another check/download so the next install uses a freshly verified artifact.
- If pending update state exists but the downloaded artifact is missing, partial, unsigned, or from a different release than the manifest being tested, ignore it and redownload after preserving logs.
- Never retry a failed install by manually editing `schema_version`, deleting updater state, or copying only part of a database backup set.

Downloaded artifact cleanup:

- Canceling an updater download must leave no installable pending artifact. A partial file may be deleted or quarantined, but it must not be reused by install.
- Failed install must clear or invalidate the downloaded artifact before another install attempt unless the updater can prove the exact same signed artifact is still complete and matches the current manifest.
- App restart must not resurrect an old downloaded artifact as pending install state. On startup, stale updater artifacts are cleanup candidates unless they are revalidated against the current manifest, signature, and app/database compatibility gate.
- Preserve logs before cleanup when the failure is being investigated; downloaded release artifacts themselves are not a substitute for logs, signatures, or manifest evidence.

Single-instance and deep-link triage:

- Treat normal second launch as a focus/restore request unless a reviewed single-instance route contract says otherwise. Do not use a second launch to clear dirty forms, cancel sync, retry an updater install, or recover a partial export or backup.
- If the first instance is syncing, downloading an update, waiting on dirty settings or add-feed drafts, or running an import/export/backup, the second launch may restore focus and report the blocked lifecycle route, but it must leave the pending operation owned by the first instance.
- If a custom protocol or deep link is involved in an incident, record only the route class, app scheme, version, validation failure reason, and focus result. Do not paste raw deep links that may contain private URLs, account names, feed titles, local paths, or import sources into public issues.

## Failure-Specific Steps

### 1. Startup / Migration Failure

1. Read the startup error as-is and note the redacted database or backup label and backup directory label.
2. Open the release log directory and save the latest log file.
3. Check whether a backup was created before the failed migration.
4. If the failure happened after an upgrade, stop and preserve the backup before retrying.
5. Confirm whether a matching `-wal` or `-shm` file exists for either the current database or the backup.
6. If manual restore is needed, restore the complete backup set with the app closed, then reopen once and capture the result.
7. If needed, continue from the migration recovery docs and issue tracking instead of improvising manual DB edits.
8. If the error says the database schema is newer than the app supports, treat it as a blocked downgrade. Install a newer compatible app or restore a compatible backup; do not edit `schema_version`.

### 2. Runtime Database Recovery

Use this path when startup succeeded but a later read or write command reports corruption.

1. Stop write-heavy actions and keep the app in read-only degraded mode when available.
2. Save the packaged release log and the user-facing support code or diagnostics ID.
3. Run the app-provided integrity check action before attempting manual database edits.
4. If corruption is confirmed, preserve the current database and matching `-wal` / `-shm` sidecars before restore.
5. Restore only from a complete backup set, then restart the app and confirm the same command no longer reports corruption.
6. Treat DB lock failure, permission denied, and disk full as separate recovery categories. Do not present them as corruption unless the integrity check confirms corruption.

### 2a. Rust Test Temp Directory Cleanup Failure

Use this path when a Rust integration test cannot remove its temporary database, keyring fixture, app profile, or nested temp directory.

1. Record the owning test name, platform, temp artifact class, and cleanup phase.
2. Preserve the first cleanup error, including permission denied, path not found, directory not empty, or open-handle style errors.
3. Redact user names and full local paths before sharing diagnostics. Prefer temp root class and basename over absolute paths.
4. Retry cleanup once after dropping test-owned handles and background tasks. Do not hide the first error if the retry succeeds.
5. If retry fails, leave a warning in test output that names the artifact class, platform, cleanup attempt count, and suggested manual cleanup class.
6. On Windows, treat open handles and delayed file release as their own cleanup category instead of collapsing them into generic filesystem failure.
7. CI may retain cleanup diagnostics on failure, but it must not upload raw temp databases or keyring material.

### 3. Updater Failure

1. Confirm whether the failure happened during:
   - update check
   - download
   - install / restart
2. Save the packaged-build logs.
3. Before retrying an install/restart against a profile you care about, preserve the current app data or complete database backup set as private user data.
4. Verify the current app version did not unexpectedly change.
5. If OS sleep or restart happened during download, confirm any downloaded artifact was cleaned up or ignored before retrying.
6. Re-run the updater path only after confirming the signed release and packaged build pair you are testing.
7. If restart failed, capture the toast/error message and log output together.
8. After any failed install/restart, record the app binary version, database schema version, and pending update state before retrying.
9. If those three states disagree, stop normal update retry and follow the release/update safety contract above.

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
5. Record freshness state separately for account, affected feeds, and the current article list:
   - all success
   - partial success
   - all failed
   - offline detected
6. Separate automatic sync backoff from user-action-required refusal:
   - HTTP 429 or `Retry-After` is backoff input.
   - HTTP 401/403, robots disallow, and explicit provider block require credential/account/server review or a visible blocked state.
   - Manual sync can bypass automatic-scheduler suppression, but it must not bypass provider HTTP timeout, body caps, private-host validation, redirect validation, same-instance local sync concurrency, or `Retry-After` classification.
   - Feed discovery is a user-initiated single URL probe, not a crawler; do not diagnose discovery failures as automatic sync freshness unless the chosen feed was later added and synced.
7. Treat frontend offline/online state as a trigger hint, not as the native network failure category:
   - `online === false` may suppress automatic background attempts or label stale content as offline, but manual retry should still record the native command result.
   - `online === true` does not prove provider reachability. DNS failure, timeout, TLS failure, connection reset, captive portal, and HTTP status classification come from the native provider error.
   - If frontend and native signals disagree, preserve both signals in the incident notes and use the native provider error for recovery category and retry/backoff decisions.
8. If sync behavior changed after OS sleep, app resume, or a manual clock change, record whether the retry window had already expired, whether many accounts were due at once, and whether manual sync succeeded after resume.
9. If stale content is still readable, capture whether a stale content banner was shown in the account, feed, or article view. Do not report readable stale articles as a successful fresh sync.
10. If automatic sync was suppressed for low-power, reduced-data, offline, repeated-failure, or many-account guardrails, record the suppression class and whether manual sync was attempted. Do not treat suppressed automatic sync as fresh content.

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
