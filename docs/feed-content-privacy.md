# Feed Content Privacy And CSP Policy

This document is the source of truth for how Ultra RSS Reader treats remote article content, privacy, and Tauri CSP decisions.

## Current Product Decision

Ultra RSS Reader is currently compatibility-first for feed content.

- The reader renders Rust-sanitized article HTML only.
- App scripts remain locked to `'self'`.
- Remote `http:` / `https:` images are allowed so normal article bodies and thumbnails can render.
- Remote `http:` / `https:` frames are allowed because Web Preview is an explicit embedded-browser feature.
- The local app database is not encrypted by Ultra RSS Reader at rest in this release.
- Support/debug copy must not include a stable app or environment fingerprint by default.

This means the app does not currently promise that opening an article avoids all third-party network requests.

## What Users Should Expect

- Opening a sanitized article in reader mode can still load remote images from publisher-controlled hosts.
- Opening Web Preview should be treated as visiting the publisher page in an embedded browser.
- Script execution is still blocked by CSP for app content, but remote media requests may expose IP address, user agent, and timing to third-party hosts.

## Why We Keep This Policy For Now

The current priority is preserving article readability and preview compatibility across supported providers.

Blanket blocking of remote images or frames would currently risk:

- broken article bodies that depend on inline remote media
- missing thumbnails and feed imagery
- degraded Web Preview behavior
- provider-specific regressions that are hard to detect from CI alone

## Local Data Privacy Decisions

### Local Database Encryption At Rest

Decision: do not add app-managed local database encryption at rest for this release.

Ultra RSS Reader stores feed, article, folder, tag, read/star state, and sync metadata in the local app database. Credentials remain outside the database in the OS keyring for production builds. The current local database privacy boundary relies on OS account isolation and OS disk encryption such as FileVault or BitLocker, not an app-managed database key.

Rationale:

- App-managed encryption would require key generation, recovery, migration, backup, and cross-platform keyring behavior that are not yet designed.
- Search, sync, migration recovery, and support backup flows would all need new failure modes and performance checks.
- Portable database backups would still need separate sharing guidance because decrypting or exporting them can expose the same private feed/article history.
- Adding encryption without a clear recovery model risks making user data unrecoverable during migration or keyring failures.

Future work may revisit this decision with a scoped threat model, backup/export encryption rules, migration tests, and user-facing recovery copy. Until then, privacy docs and support flows must describe the local database as private user data that may remain on disk after uninstall or reset steps unless explicitly removed.

### Backup And Export Privacy Levels

Decision: database backups are private user data and are not app-encrypted by Ultra RSS Reader in this release. OPML exports are shareable only after user review because feed titles and URLs can reveal subscriptions, organizations, or private endpoints.

Database backups include the SQLite database and any matching `-wal` / `-shm` sidecars. They can contain account names, feed URLs, article titles, saved article content, read/star state, folder and tag names, sync metadata, and local preferences stored in the database. Production credentials remain outside the database in the OS keyring, but a backup can still reveal private reading and subscription history. Backup files must be treated as confidential support artifacts, kept only as long as needed for recovery or incident triage, and deleted manually when no longer needed.

OPML export must keep credential values, cookies, tokens, local paths, article content, read/star state, sync metadata, and database backup metadata out of the generated file. OPML may still contain private feed URLs and user-visible feed or folder names, so the user-facing flow must describe it as a subscription list export rather than an anonymous or sanitized privacy export.

Encryption decision:

- Ultra RSS Reader does not encrypt database backups or OPML exports with an app-managed key in this release.
- Users who need encrypted storage or transfer must use OS disk encryption, an encrypted archive, or another external secure channel.
- Any future app settings export/import or backup export feature must define its schema version, secret exclusion policy, encryption behavior, restore compatibility, and redaction preview before shipping.

### App Settings Export/Import Preconditions

Decision: do not introduce app settings export/import until the export contract is versioned and excludes secrets by design.

Before app settings export/import is implemented, the contract must define:

- a top-level schema version and source app identifier
- strict import behavior for unknown future schema versions
- a clear list of included preference keys and excluded runtime-only state
- exclusion of credentials, tokens, cookies, OS keyring references, local filesystem paths, account passwords, and provider session material
- whether account identifiers, feed URLs, folder names, tags, and mute keywords are included, redacted, or mapped during import
- how conflicts are previewed before overwriting local settings
- whether the export is plaintext, externally encrypted by the user, or app-encrypted by a reviewed key-management design

Until that contract exists, support and release docs must not promise portable app settings export/import.

### Support/Debug Environment Fingerprint

Decision: do not include a stable app/environment fingerprint in support or debug copy by default.

Support handoff may ask the user to provide app version, OS family, CPU architecture, locale, and timezone offset as separate fields. It must not automatically include hostname, local filesystem paths, OS username, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, or a stable device identifier.

A future diagnostics dump may include a non-secret environment summary only after a user consent and redaction preview flow exists. That summary should be generated per export, avoid stable cross-ticket identifiers, and keep hostname and local paths excluded.

### Support Dump Consent And Redaction Preview

Decision: any support dump or diagnostics export must require explicit user consent and a redaction preview before the artifact is generated.

The preview must list the artifact classes that will be included, the redaction classes that were applied, and the items the user must review manually before sharing. It must not expose raw local paths, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, hostname, OS username, or a stable device identifier. If the preview cannot be produced, support dump generation must fail closed and direct the user to share a manually redacted app.log excerpt instead.

### User-Facing Error Correlation

Decision: user-facing copy may show a stable support code for the error category, but diagnostics identifiers are ephemeral log-correlation values and must not be treated as stable user or device identifiers.

Support codes should identify broad recovery areas such as network, account auth, keyring, database recovery, or migration recovery. Diagnostics IDs may be generated per event or per export for support correlation, but they must not encode private data and must not be reused across unrelated support tickets. User-facing copy must keep recovery guidance separate from raw diagnostic detail.

## Guardrails

- Reader HTML must continue to come from sanitized `content_sanitized` fields.
- Any future CSP tightening must preserve `script-src 'self'` unless there is an explicit, reviewed reason to change it.
- Privacy changes that affect remote images, frames, or preview loading must be verified in reader mode, preview mode, and packaged Tauri builds before release.
- Private data reset and uninstall guidance must cover database, credentials, preferences/local app state, release logs, stale support/debug logs, support dumps, and backups as separate retention surfaces.
- Installer, updater, uninstall, and reinstall copy must say that app data can persist across app binary removal and app reinstall.
- Support artifacts must be redacted before sharing and deleted manually when they are no longer needed.
- Support dumps must not be generated before explicit user consent and redaction preview.

## Follow-Up Direction

Future privacy hardening should be incremental instead of a single CSP clamp-down.

Recommended order:

1. Measure which article and preview flows break when remote media is restricted.
2. Separate reader-mode privacy controls from Web Preview behavior instead of treating them as one switch.
3. Consider mitigations such as explicit privacy modes, remote-image blocking in reader mode, or tracking-pixel countermeasures only after the compatibility impact is understood.

## Privacy Hardening Measurement Plan

Use this as the minimum design batch before changing CSP, sanitizer behavior, or
settings UI.

### Reader Mode Remote Images

- Record whether sanitized reader articles load remote `http:` / `https:`
  images for each supported provider fixture or live account.
- Include normal inline images, thumbnails used inside article bodies, missing
  image fallbacks, and 1x1 or otherwise invisible tracking-pixel candidates.
- Compare readability before and after any proposed reader-only image
  restriction; do not treat Web Preview success as evidence that reader mode is
  unaffected.
- Keep provider compatibility notes separate from privacy-risk notes so one
  provider-specific breakage does not force a global CSP decision.

### Frames And Web Preview

- Treat app-content frames and Web Preview as separate surfaces when measuring
  impact.
- For reader mode, confirm whether sanitized content can introduce frame-like
  embeds after Rust sanitization and whether those embeds are rendered by the
  frontend article pane.
- For Web Preview, verify publisher pages still load, navigate, and expose the
  expected browser controls when `frame-src` behavior is changed in an isolated
  experiment.
- Do not use a Web Preview regression as direct evidence against a reader-mode
  privacy control; record it as embedded-browser compatibility impact.

### Sanitizer Version And Migration

- Record the current `SANITIZER_VERSION`, the tested sanitizer rule set, and
  whether existing saved articles require re-sanitization.
- Measure new-sync articles and previously saved articles separately; saved
  content can keep older `content_sanitized` until a migration or re-sanitize
  path updates it.
- Keep text extraction and search-index behavior in scope only as compatibility
  checks; do not mix search ranking changes into a privacy hardening batch.
- If a privacy mode requires sanitizer changes, design the settings UI,
  frontend rendering behavior, and Rust sanitizer versioning as separate
  implementation steps.

## Verification Checklist

Use the checklist entries below as the execution units for P3 feed content
privacy hardening measurement. Keep the reader thumbnail, reader sanitized
body, and Web Preview checks as separate records so manual verification results
do not merge reader-mode privacy impact with embedded-browser compatibility.

- [ ] Reader thumbnail: accepted thumbnail schemes, rejected mixed-content or
  credentialed thumbnails, referrer policy, and broken-image readability are
  recorded per provider.
- [ ] Reader sanitized body: remote image loads, blocked-image readability, and
  tracking-pixel candidates are recorded per provider.
- [ ] Reader sanitized body: frame-like embeds are checked independently from
  Web Preview.
- [ ] Web Preview: publisher page load, navigation, and browser controls are
  checked separately from reader-mode thumbnails and sanitized article
  rendering.
- [ ] Feed favicon: favicon requests use an HTTPS proxy, send no referrer, strip
  feed path/query data, and fall back without retry loops after image failures.
- [ ] Sanitizer: `SANITIZER_VERSION`, saved-article behavior, new-sync behavior,
  and re-sanitize needs are recorded before implementation.
- [ ] Packaging: any privacy change that affects remote content is verified in a
  packaged Tauri build before release.

## Related Files

- `src-tauri/tauri.conf.json`
- `src-tauri/src/infra/sanitizer.rs`
- `src/components/reader/article-content-view.tsx`
- `src/__tests__/components/article-content-view.test.tsx`
- `README.md`
- `docs/release-manual-verification.md`
