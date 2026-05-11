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

## Release Path Decision

Use this table before choosing the amount of manual verification. It separates
release process decisions from implementation work; do not change signing,
notarization, updater, or artifact generation behavior during this checklist.

| Path | Use When | Required Manual Entry | Evidence |
| --- | --- | --- | --- |
| Normal release | A scheduled release, feature release, or mixed fix release | Run the full checklist sections that match the changed surface | OS, artifact name, release URL, digest, logs, and screenshots for each platform in scope |
| Hotfix release | A patch fixes a released regression and should avoid unrelated scope | Start with [Hotfix Release Checklist](#hotfix-release-checklist), then run only the smoke checks affected by the regression | Affected version, regression summary, focused tests, skipped checks with reasons, and artifact evidence |
| Rollback or republish | A published artifact is broken, unsafe, or must be replaced | Record the old artifact, the replacement or rollback decision, and the user-facing guidance before changing release state | Old release URL, old digest, replacement digest if any, and rollback or upgrade note |
| Manual native smoke only | No release is being cut, but packaged OS behavior changed | Run the short smoke checklist for the affected OS and feature only | Expected result, redacted log note, and screenshot for any OS prompt or warning |

## Short Manual Smoke Checklist

Use these short checks to decide whether a release candidate needs the detailed
sections below. Record `not in scope` with a reason instead of forcing checks for
platforms or surfaces that did not change.

### Normal Release Smoke

- OS: macOS and Windows for the platforms being released.
- Expected result: published artifacts install, launch, report the expected
  version, and can reach the first usable app screen without dev credentials.
- Evidence: artifact name, release URL, SHA-256 digest, app version, and one
  redacted startup log note per OS.

### Hotfix Release Smoke

- OS: every OS affected by the released regression; include both macOS and
  Windows when the regression is in updater, startup, keyring, or packaging.
- Expected result: the regression is fixed without introducing unrelated
  release-surface changes, and any narrower quality gate is explicitly recorded.
- Evidence: affected release version, fixed tag or commit, focused test command,
  changed manual sections, skipped manual sections with reasons, and artifact
  digest for every replaced artifact.

### macOS Notarization And Quarantine Smoke

- OS: macOS, using a published artifact downloaded through the normal browser or
  GitHub Releases path.
- Expected result: Gatekeeper accepts the signed/notarized app, quarantine does
  not require manual removal, and launching from `/Applications` uses the
  expected app data and log locations.
- Evidence: `codesign` result, `spctl` result, quarantine attribute note,
  notarization or Gatekeeper prompt screenshot if shown, and a redacted log note.

### Windows SmartScreen Smoke

- OS: Windows clean profile or VM, using the published installer artifact.
- Expected result: installer signature is valid, SmartScreen behavior is known,
  install does not require developer mode or local rebuild steps, and the app
  launches with the expected version.
- Evidence: `Get-AuthenticodeSignature` result, publisher/certificate summary,
  SmartScreen prompt screenshot if shown, artifact digest, and install/uninstall
  result.

### First-Run Permission Prompt Smoke

- OS: target OS with a clean profile or reset permissions for the packaged app.
- Expected result: first-run prompts appear only after user-initiated actions,
  denial leaves retryable UI, and no prompt reveals credentials or private URLs.
- Evidence: screenshot of each OS prompt with private data redacted, action that
  triggered it, deny/retry result, and redacted release log note.

### Updater Smoke

- OS: every platform whose updater path is being verified.
- Expected result: an installed previous release detects the draft or published
  update, downloads it, restarts into the expected version, and can recheck after
  a failed or canceled update.
- Evidence: previous version, target version, release URL, updater log note,
  success or failure screenshot, and app data backup confirmation before testing
  an existing profile.

## Checklist

Use the currently published release, workflow run, and packaged artifact names
as observed evidence. Do not treat examples in this document as required file
names or workflow internals unless the release contract already requires them.

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
- Published release artifact name and release URL
- Release asset digest, for example `sha256:<digest>`
- Updater signature sidecar asset name, source release URL, and whether the
  sidecar matches the published artifact being installed
- Codesign result, for example `codesign --verify --deep --strict --verbose=2 <app>`
- Gatekeeper result, for example `spctl --assess --type execute --verbose <app>`
- Gatekeeper assessment result
- Installed app identifier or bundle identifier observed from the packaged app
- Installed app version shown by the packaged app
- Quarantine and first-launch result from the published artifact path, or the
  reason those checks are not in scope for the target OS
- Update check smoke result from the installed published artifact, including
  whether it reports no update, offers the expected update, or fails safely

`mise run app:install` is only a local build/install helper. It rebuilds from the current checkout and may re-sign the local macOS app after copying it into `/Applications`; it is not evidence that the published release artifact, notarization, or Gatekeeper path works.

### 2a. Release Provenance And SBOM Record

Record this for every release before publishing the draft release.

Confirm and record:

- Release tag and tag target SHA.
- Annotated tag object SHA, tag target SHA, and confirmation that the tag exists
  on `origin` before the workflow creates artifacts.
- Source commit SHA and the PR, merge commit, or release note that explains the
  user-visible change set.
- PR number or merge commit subject for the source commit.
- Source commit SHA checked out by the release workflow.
- Release automation run id or URL, including the triggering ref when available.
- GitHub workflow run id and run URL.
- For each published app artifact: target platform, release URL, SHA-256 digest,
  and the matching updater checksum/signature evidence when the platform uses
  updater sidecars.
- Updater checksum sidecar asset.
- Updater signature sidecar asset.
- Provenance, license, dependency, or SBOM evidence attached to the release, or
  the explicit reason that no such record exists for this release.
- SBOM or dependency provenance record.
- Draft release attachment inventory before publishing, grouped by platform and
  evidence type so missing or mismatched artifacts are visible without relying
  on hard-coded file names.
- Draft release attachment list before publishing.
- If release signing secrets are unavailable, the workflow must stop before
  artifact build or draft Release upload. Record the missing secret names shown
  by the workflow copy, or record that `workflow_dispatch` used `dry_run=true`
  and intentionally skipped artifact publication.

### 2b. Release Dev-Only Contamination Record

Confirm this from the release workflow static gate and, when inspecting packaged artifacts, from the release artifact being published.

Confirm and record:

- The release workflow used `src-tauri/tauri.release.conf.json`, not `src-tauri/tauri.dev.conf.json`.
- The release workflow did not set `DEV_CREDENTIALS` or `ULTRA_RSS_DEV_CREDENTIALS`.
- The release capability did not include debug-only MCP bridge permissions.
- dev mocks were not used as evidence for release install, updater, signing, or startup verification.
- Debug scenario state was either absent from the packaged release path or explicitly user-gated as a normal app debug setting, not preloaded release state.

### 2c. Windows Installer Signing And SmartScreen Verification

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

### 2d. macOS Quarantine And App Translocation Verification

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

### 2e. First-Run Permission Prompt Verification

Run this from a clean OS profile or after resetting only the relevant OS permissions and app data for the packaged app. The goal is to record the first-run user experience for release artifacts, not development builds.

Confirm and record:

- First account setup reaches native keyring access without falling back to dev credentials or showing an unexplained OS prompt.
- First OPML import or database restore file-open dialog appears as a user-initiated action and handles cancel as a neutral result.
- First OPML export or database backup save dialog applies the expected extension and overwrite-confirmation policy.
- First clipboard copy action succeeds or reports permission denial with action-specific recovery copy.
- First network sync or account test uses the configured provider URL and reports offline, TLS, auth, or permission failure as distinct outcomes.
- Denying any prompt that the OS allows denying leaves the app in a retryable state and writes enough redacted release log context to debug the denial.
- Screenshots of OS permission prompts redact local usernames, local paths, account names, feed URLs, server URLs, and credential material.

For permission-denied results, verify the user-facing copy gives one concrete next action for the denied surface:

- File or folder access: ask the user to choose another readable or writable location, or reopen the picker after changing OS file permissions.
- Native open/save dialog access: ask the user to retry the same import, export, backup, or restore action from the visible app control; cancel remains neutral.
- Keyring access: ask the user to unlock or allow the OS credential prompt and retry account setup, edit, or sync without switching to dev credential storage.
- Clipboard access: ask the user to grant clipboard permission or use the visible fallback action to copy, open, or inspect the same value.

If a release adds a new permission prompt, record the user-visible feature that triggers it, the fallback when denied, and whether the prompt appears before the user takes an action that explains why access is needed.

### 2f. Windows Hidden Console And Crash Visibility Verification

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
- The installed app reports the expected app identifier and release update
  endpoint for the platform being verified.
- The updater signature sidecar from the draft or published release belongs to
  the target app artifact and is not reused from another artifact or platform.
- The app can detect the new version from the packaged build.
- Manual update check smoke from the installed published artifact reaches a
  terminal state: no update available, expected update available, or a
  user-visible safe failure.
- Record whether packaged updater verification passed, failed safely, or was
  skipped with a release-surface reason.
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
- If a future identifier change is required, the release plan documents old identifier detection, a user-visible database migration prompt or backup/copy prompt, the fact that OS keyring credentials cannot be copied automatically, and rollback steps. OS keyring credentials may need user re-entry. Log paths change with the identifier namespace and must be called out in release notes and support handoff.
- If a release changes the identifier, manual verification must prove the old app data directory remains preserved until the user accepts the documented copy or backup path. Skipping native migration is acceptable only when the release notes and support handoff explicitly say database, logs, and credentials remain in the old namespace.
- Rollback after an identifier change must return users to the old identifier namespace or restore from the preserved backup; rollback guidance must not tell users to delete the old app data, log, or keyring namespace as a repair step.

### 6a. macOS Sandbox Entitlements And Access Policy

Current policy: Ultra RSS Reader does not expand macOS sandbox entitlements opportunistically. Any future change to file, network, or keychain access must be reviewed as a release-native contract change before shipping.

Confirm before a release that changes Tauri configuration, signing, keyring behavior, import/export, diagnostics, or local file access:

- The intended macOS sandbox mode and entitlements are documented in the release plan.
- Network access is limited to the app's RSS/provider, update, favicon, article media, and Web Preview behavior described by current product policy.
- File access remains user-initiated or app-owned unless a reviewed feature explicitly needs broader paths.
- Native file dialogs apply the same extension, cancel, directory, and overwrite-confirmation policy across OPML import/export and database backup/restore flows.
- Log, backup, export, settings, and dev credential recovery surfaces follow the same filesystem contract: native path normalization at the boundary, no raw app-owned recovery paths exposed to the webview, and temporary-file-then-rename writes where the surface writes a recoverable artifact.
- Keychain access remains limited to provider credentials and does not create a new shared access group without migration and rollback notes.
- Diagnostics, support dumps, and logs do not require broad filesystem access to collect private data by default.
- Any new entitlement lists the user-visible feature, expected prompt or OS behavior, fallback behavior when denied, and manual verification evidence.

If a release changes import/export/backup dialogs, confirm and record:

- OPML import filters `.opml` and `.xml` and rejects unsupported extensions or directories before parsing.
- OPML export and database backup save dialogs auto-append only the missing expected extension.
- Existing-file replacement requires explicit overwrite confirmation before any write starts.
- Canceling a dialog leaves no file mutation, error toast, or stuck progress state.
- Database backup and restore evidence includes pre/post `integrity_check` behavior and the WAL checkpoint policy; migration evidence states that DDL runs transactionally and partial migration failure rolls back before automatic backup restore.
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
- Release log timestamps use the packaged app's local timezone policy (`TimezoneStrategy::UseLocal`). When sharing logs across timezones, record the verifier's OS timezone and UTC offset together with the log.
- Do not convert local release log timestamps to UTC in support notes unless the converted value is labeled separately; keep the original local timestamp available for comparison with the user's app UI and OS event history.
- If a log excerpt crosses a DST boundary, record that boundary explicitly with the OS timezone and UTC offset observed on each side.
- Treat release log filenames as rotation labels only. Support notes must correlate incidents by the log line timestamp plus OS timezone context, not by inferring UTC or local display time from the filename.
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
- Support dumps are not generated before explicit user consent and a redaction preview; if the preview cannot be produced, generation fails closed.
- If any artifact cannot be removed because of OS permissions, file locks, or an unknown path, the user-facing result says the reset is incomplete.
- Support/debug copy does not automatically include hostname, local filesystem paths, OS username, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, or a stable device identifier.
- If support needs environment context, ask for app version, OS family, CPU architecture, locale, and timezone offset as separate non-secret fields instead of adding a stable fingerprint to default debug copy.
- App action sequencing must stay telemetry-free. If a release adds action diagnostics, verify it is local-only, redacted, size-capped, and included in support copy only after consent and preview.

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

- Release path: normal, hotfix, rollback/republish, or manual native smoke only.
- Platforms verified, app version observed, and the published artifact URL and
  digest for each platform.
- Artifact pairing evidence for updater checksum/signature sidecars when the
  platform uses them.
- Installed app identifier, signing/notarization or installer signature result,
  and first-launch result for each platform in scope.
- Live service, native keyring, updater, packaged startup, icon/badge, uninstall
  or data-reset, and permission-prompt results that were in scope.
- Checks intentionally skipped, with the reason and owner for any follow-up.
- Supporting log or screenshot location, with OS timezone and UTC offset for
  shared release logs.

If something fails during this checklist, continue from [incident-runbook.md](./incident-runbook.md) instead of improvising ad-hoc recovery steps.
