# Release Manual Verification

`mise run ci` is the repository gate, but it intentionally stops before live-service and packaged-app checks.
Use this checklist before cutting a normal release tag or shipping a packaged build to someone else.

For an urgent patch that only fixes a released regression, use the [Hotfix Release Checklist](#hotfix-release-checklist) first, then run only the manual checks that match the changed surface.

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

### 2a. Windows Installer Signing And SmartScreen Verification

Run this on a clean Windows profile or VM before publishing a Windows installer broadly. This is a manual reputation and trust-path check; do not treat local CI success as evidence that SmartScreen behavior is acceptable.

Confirm and record:

- Installer artifact name, release URL, and SHA-256 digest.
- Authenticode signature result, for example `Get-AuthenticodeSignature <installer>`.
- Publisher name, certificate subject, certificate issuer, and timestamp status shown by Windows.
- Whether SmartScreen shows no prompt, a reputation warning, or an unknown-publisher warning.
- Screenshot of any SmartScreen or Windows Security prompt, with usernames, local paths, account names, feed URLs, and server URLs redacted.
- Whether installing from the signed artifact completes without requiring developer mode, bypass scripts, or local rebuild steps.
- Whether the installed app launches, reports the expected version, and can be uninstalled through the normal Windows app flow.

If SmartScreen reputation is missing but the signature is valid, record it as a release risk instead of re-signing locally. Future policy work should define the EV/OV certificate, timestamping, and publisher reputation strategy before changing installer signing behavior.

### 2b. macOS Quarantine And App Translocation Verification

Run this with the published macOS artifact downloaded through the normal browser or GitHub Releases flow, before manually clearing quarantine attributes or moving support files. This verifies the path users get after downloading the release, not a locally rebuilt or re-signed app.

Confirm and record:

- Downloaded artifact name, release URL, SHA-256 digest, and whether the downloaded artifact has the `com.apple.quarantine` extended attribute.
- Gatekeeper and notarization result before first launch, including any warning or confirmation prompt.
- Whether launching directly from the mounted DMG works or is intentionally blocked by policy.
- Whether launching after copying to `/Applications` opens the same app version and does not require removing quarantine manually.
- Whether the app appears to run from a translocated path on direct launch, and whether that path changes after moving the app to `/Applications`.
- Whether the app data directory, release log directory, updater cache, and packaged resources resolve to the expected app-owned locations in both direct-launch and `/Applications` launch paths.
- Whether the in-app log-directory flow opens the same release log namespace after relaunching from `/Applications`.
- Screenshot or log note for Gatekeeper, notarization, quarantine, or translocation evidence, with usernames and local paths redacted.

If translocation changes resource resolution, log directory behavior, or app data visibility, stop the release handoff and treat it as a packaged-startup issue. Do not work around it by clearing quarantine on the verifier machine.

### 2c. First-Run Permission Prompt Verification

Run this from a clean OS profile or after resetting only the relevant OS permissions and app data for the packaged app. The goal is to record the first-run user experience for release artifacts, not development builds.

Confirm and record:

- First account setup reaches native keyring access without falling back to dev credentials or showing an unexplained OS prompt.
- First OPML import or database restore file-open dialog appears as a user-initiated action and handles cancel as a neutral result.
- First OPML export or database backup save dialog applies the expected extension and overwrite-confirmation policy.
- First clipboard copy action succeeds or reports permission denial with action-specific recovery copy.
- First network sync or account test uses the configured provider URL and reports offline, TLS, auth, or permission failure as distinct outcomes.
- Denying any prompt that the OS allows denying leaves the app in a retryable state and writes enough redacted release log context to debug the denial.
- Screenshots of OS permission prompts redact local usernames, local paths, account names, feed URLs, server URLs, and credential material.

If a release adds a new permission prompt, record the user-visible feature that triggers it, the fallback when denied, and whether the prompt appears before the user takes an action that explains why access is needed.

### 2d. Windows Hidden Console And Crash Visibility Verification

Run this on the Windows packaged release artifact. This is a manual packaged-app check for the production window subsystem and startup failure surface; do not use a dev build as evidence.

Confirm and record:

- Normal launch does not leave an unexpected console window behind the app.
- Startup, account sync, updater check, and normal quit write release logs without requiring a visible console.
- A controlled startup failure or known crash-reproduction build, when available, leaves a user-visible failure surface such as a dialog, error window, or supportable OS crash record.
- The same failure writes a redacted release log entry or crash artifact that support can correlate without exposing credentials, tokens, account names, feed URLs, server URLs, or local paths.
- The process exit behavior is recorded when launch fails before the main window opens.
- If Windows hides the console, crash visibility still includes a support path that does not require the user to run the app from PowerShell.

If crash visibility depends on a code change, skip that part for the current release and record the missing behavior as release risk instead of changing native code during manual verification.

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

Before verifying the updater UI, classify the release notes, `CHANGELOG.md`
entry, and in-app updater message from the same user-visible change set.
The updater message can stay shorter than the release notes, but it must not
hide a change that affects update urgency.

Use these release copy classes consistently:

- Security or privacy fix: mention it in release notes and the updater message
  when users should update promptly. Keep exploit details, secrets, private
  URLs, and account identifiers out of both surfaces.
- Data migration or storage compatibility change: mention the migration in
  release notes and the updater message, including whether the app must restart
  and whether downgrade or rollback is unsupported after launch.
- Manual action required: mention the action in both surfaces and link to the
  public recovery or verification guidance. Do not rely on an internal TODO as
  the only instruction.
- Known issue: include it in release notes and, when it changes update urgency,
  in the updater message. State the affected surface, user-visible impact, and
  workaround or mitigation.
- Rollback impossible or unsafe: state it explicitly in release notes and the
  updater message before users start the update path.
- Internal-only maintenance: keep it in `CHANGELOG.md` or internal task notes
  only when there is no user-visible behavior, privacy, data, installer,
  updater, or recovery impact.

Known-issue policy:

- User-visible risk, data-loss risk, privacy risk, failed migration risk, broken
  updater/install path, or a required user workaround must be public release
  note material for the affected release.
- Internal-only risk may stay in `TODO.md` when it has no expected user-facing
  behavior and no user action can reduce the risk.
- If a TODO risk is mentioned publicly, describe the risk in user terms and link
  to stable public docs or issue references when available. Do not link release
  notes directly to `TODO.md`; it is an internal planning file and may be
  rewritten or removed.
- If no public link exists, keep the release note self-contained and record the
  internal TODO name in the release handoff or verification notes.
- A known issue should include a workaround when one exists. If no workaround
  exists, say that plainly and include the expected fixed-version or follow-up
  tracking path when known.

Confirm:

- Before testing against an existing profile, the verifier has preserved a private OS-level copy of the app data directory or complete database backup set.
- The app can detect the new version from the packaged build.
- Download starts and completes without a stuck progress state.
- If OS sleep is introduced during download, resume does not leave a partial artifact, stale progress, or stale success state; manual recheck starts a fresh flow.
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

### 6a. macOS Sandbox Entitlements And Access Policy

Current policy: Ultra RSS Reader does not expand macOS sandbox entitlements opportunistically. Any future change to file, network, or keychain access must be reviewed as a release-native contract change before shipping.

Confirm before a release that changes Tauri configuration, signing, keyring behavior, import/export, diagnostics, or local file access:

- The intended macOS sandbox mode and entitlements are documented in the release plan.
- Network access is limited to the app's RSS/provider, update, favicon, article media, and Web Preview behavior described by current product policy.
- File access remains user-initiated or app-owned unless a reviewed feature explicitly needs broader paths.
- Native file dialogs apply the same extension, cancel, directory, and overwrite-confirmation policy across OPML import/export and database backup/restore flows.
- Keychain access remains limited to provider credentials and does not create a new shared access group without migration and rollback notes.
- Diagnostics, support dumps, and logs do not require broad filesystem access to collect private data by default.
- Any new entitlement lists the user-visible feature, expected prompt or OS behavior, fallback behavior when denied, and manual verification evidence.

If a release changes import/export/backup dialogs, confirm and record:

- OPML import filters `.opml` and `.xml` and rejects unsupported extensions or directories before parsing.
- OPML export and database backup save dialogs auto-append only the missing expected extension.
- Existing-file replacement requires explicit overwrite confirmation before any write starts.
- Canceling a dialog leaves no file mutation, error toast, or stuck progress state.
- Sleeping during updater download, OPML export, or database backup either cancels cleanly or resumes through a documented operation generation without accepting partial artifacts.
- Permission denied, disk full, and OS sleep interruption are reported as distinct outcomes.

If a release adds tray or background resident behavior, confirm and record:

- Close-to-tray, full quit, updater restart, OS shutdown, and force quit have separate user-visible behavior.
- Dirty settings forms, pending imports/exports, in-flight backups, and sync writes can block close or restart with clear copy.
- Background sync, updater checks, file export, and database backup are either disabled while the window is hidden or explicitly documented as resident operations.
- Users can disable background activity and can quit the app completely.
- Reopen from tray, quit, update restart, and relaunch after OS login if enabled were verified in a packaged build.

Evidence to save:

- Signed packaged app path and build version.
- Relevant entitlements output, for example `codesign -d --entitlements :- <app>`.
- Screenshot or log note for any macOS permission prompt.
- Result of adding, restarting, editing, and removing an account through the packaged app when keychain behavior changed.

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
- Reinstalling the same or newer version is allowed to reuse existing app data, preferences, logs, and OS keyring credentials; this must be described as retention, not as a clean install.
- Reinstalling the same or a newer version does not silently depend on stale support/debug logs or support dumps.
- Private data reset guidance covers the local database, `-wal` / `-shm` sidecars, OS keyring credentials, preferences/local app state, release logs, stale support/debug logs, support dumps, and migration backups.
- Database backup/export copy says backups are private and not app-encrypted, and OPML export copy says subscription titles and URLs may be private even when secrets are excluded.
- App settings export/import is not presented as supported unless the build includes a schema version, source app identifier, strict future-version import behavior, secret exclusion policy, conflict preview, and encryption decision.
- Manual log deletion and support dump deletion are documented as separate cleanup steps after an incident is resolved.
- If any artifact cannot be removed because of OS permissions, file locks, or an unknown path, the user-facing result says the reset is incomplete.
- Support/debug copy does not automatically include hostname, local filesystem paths, OS username, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, or a stable device identifier.
- If support needs environment context, ask for app version, OS family, CPU architecture, locale, and timezone offset as separate non-secret fields instead of adding a stable fingerprint to default debug copy.

### 9a. Import/Export Cancellation Verification

Verify this when a release changes OPML import/export, database backup/restore, settings data portability, file dialogs, or long-running operation progress.

Confirm and record:

- Cancel before choosing a file or destination closes without a confirmation prompt.
- Cancel after OPML import preview or running import asks for confirmation before canceling.
- Cancel after OPML export destination selection asks for confirmation before canceling a running write.
- Cancel during database backup/restore asks for confirmation before canceling any copy or restore step.
- The confirmation copy states whether cancellation leaves no changes, partial changes, or a partial artifact that may need manual cleanup.
- After a canceled export or backup, a retry does not silently reuse a stale partial artifact.
- After a canceled import, the UI reports whether no feeds changed or a partial mutation may need review.

## Hotfix Release Checklist

Use this checklist only for a patch that fixes a released regression and should avoid unrelated release scope. Normal feature releases should use the full checklist above.

1. Define the hotfix scope in one sentence: affected version, regression, user impact, and rollback option.
2. Confirm the patch branch contains only the fix, required tests, and release notes for that regression.
3. Run the repo quality gate required by the PR template. If time forces a narrower gate, record the skipped gate and the reason in the release notes or handoff.
4. Re-run focused tests for the changed surface and one packaged smoke for each affected OS.
5. If the regression affects installer, updater, notarization, keyring, file access, network access, or app startup, run the matching section from this manual checklist.
6. If the hotfix replaces a broken release artifact, preserve the old release URL, old artifact digest, replacement artifact digest, and user-facing rollback or upgrade guidance.
7. If the hotfix is abandoned, leave the existing release untouched and continue from [incident-runbook.md](./incident-runbook.md).

Hotfix record:

- affected release version
- fixed commit and tag
- changed files or packages
- focused tests run
- manual checks run or intentionally skipped
- artifact digest and signature/notarization evidence for replaced artifacts
- rollback or republish decision

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
- Whether Windows installer signing and SmartScreen verification passed, if in scope
- Whether macOS sandbox entitlement/access verification passed, if in scope
- Whether uninstall/private data reset/support artifact retention verification passed, if in scope
- Whether this was a normal release or hotfix release
- Where the supporting logs or screenshots were saved, if any
- OS timezone and local offset for any shared release logs

If something fails during this checklist, continue from [incident-runbook.md](./incident-runbook.md) instead of improvising ad-hoc recovery steps.
