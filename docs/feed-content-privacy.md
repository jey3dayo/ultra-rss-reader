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

Native file selection policy:

- OPML import should accept `.opml` and `.xml` files selected through a native open dialog; directory selection and unsupported extensions must fail before parsing.
- OPML export and database backup flows must use native save dialogs, append the expected extension only when the user did not provide one, and show a clear overwrite confirmation before replacing an existing file.
- Dialog cancellation is a neutral result, not an error. It must not create, delete, or overwrite files and must leave progress state idle.
- Database backup save locations must be treated as private user-chosen paths and must not be logged or shown in support copy unless redacted.

OPML account ownership contract:

- Imported OPML feeds are owned by the account selected for the import operation. The parser may read outline folders and feed metadata, but it must not infer or switch account ownership from OPML text, remote feed content, provider metadata, feed URLs, or duplicate feed titles.
- Cross-account duplicate detection may warn that the same normalized feed URL already exists in another account, but it must not silently merge, move, overwrite, or de-duplicate across account boundaries.
- Moving a subscription between accounts is a separate explicit move flow. It must show source account, destination account, affected feed/folder scope, and whether read/star/tag/history state is copied, moved, or left behind before mutation.
- Same-account duplicate import should use the existing account-scoped duplicate policy. Cross-account duplicates remain separate subscriptions unless the user chooses a reviewed move flow.
- Import diagnostics may record account-scope class and duplicate class, but must not log raw feed URLs, account names, local paths, credentials, tokens, or cookies.

OPML export privacy comment decision:

- OPML export must not add a privacy summary comment by default.
- The export artifact should stay a subscription interchange file, not a support artifact or privacy report. Inserting a comment can reveal app identity, export timing, privacy assumptions, or account/export intent to downstream OPML consumers.
- Privacy guidance belongs in the UI before export and in support docs, not as a generated XML comment inside the OPML file.
- A future opt-in annotated export mode must be versioned separately and must keep comments free of account names, local paths, support codes, environment details, credentials, tokens, cookies, and raw private URLs.

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

### Import/Export Progress Cancellation

Decision: destructive or ambiguous cancellation confirmation must happen before canceling an import/export operation, not after progress has already been torn down.

Progress cancellation contract:

- OPML import: confirmation is required after parsing or preview has started and before canceling a running import that may have written feeds or folders.
- OPML export: confirmation is required after the destination path has been chosen and before canceling a running write that may leave a partial artifact.
- Database backup/restore: confirmation is required before canceling any running copy or restore step that may leave a partial backup set or restore target.
- Future app settings export/import: confirmation timing must follow the same before-cancel rule and must state whether no changes, partial changes, or cleanup will result.
- A cancel request made before a file is selected or before an operation starts must close without a confirmation prompt.
- If cancellation cannot guarantee cleanup of a partial artifact, the UI must say the artifact may remain and direct the user to delete or retry it manually.

### Support/Debug Environment Fingerprint

Decision: do not include a stable app/environment fingerprint in support or debug copy by default.

Support handoff may ask the user to provide app version, OS family, CPU architecture, locale, and timezone offset as separate fields. It must not automatically include hostname, local filesystem paths, OS username, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, or a stable device identifier.

A future diagnostics dump may include a non-secret environment summary only after a user consent and redaction preview flow exists. That summary should be generated per export, avoid stable cross-ticket identifiers, and keep hostname and local paths excluded.

### Support Dump Consent And Redaction Preview

Decision: any support dump or diagnostics export must require explicit user consent and a redaction preview before the artifact is generated.

The preview must list the artifact classes that will be included, the redaction classes that were applied, and the items the user must review manually before sharing. It must not expose raw local paths, account names, feed URLs, article URLs, server URLs, credentials, tokens, cookies, hostname, OS username, or a stable device identifier. If the preview cannot be produced, support dump generation must fail closed and direct the user to share a manually redacted app.log excerpt instead.

Bug report attachments follow the same privacy boundary. Public issues should prefer redacted log excerpts, screenshots with private fields hidden, or copied support codes. Raw database backups, full app data directories, keychain exports, and unreviewed support dumps must stay out of public issue attachments.

Diagnostics size contract:

- Support/debug copy must cap a single diagnostics event at 16 KiB before it is added to any preview or export.
- Runtime diagnostics history must use a 256 KiB ring buffer. Oldest diagnostics are dropped before newest diagnostics are rejected.
- Release log collection must assume a 35 MB maximum retained log surface from 5 MB files retained for 7 days.
- Emergency truncation must insert `[ultra-rss-reader:diagnostics-truncated]` and keep the consent, redaction preview, and artifact class list visible.
- If clipboard copy or support dump generation fails after truncation, the fallback is a manually redacted app.log excerpt, not an unbounded retry or raw app data directory.

Clipboard support-copy contract:

- Clipboard payloads are plain text only and must be rejected when empty, whitespace-only, over 2048 user-visible characters, over 8192 UTF-8 bytes, or containing control characters.
- Newlines, carriage returns, tabs, and NUL/control characters are rejected rather than normalized for clipboard support copy.
- Clipboard permission denial must use action-specific recovery copy and must not include raw payload text in the user-visible error.
- Clipboard failure diagnostics must record failure class and payload size class only. They must not store the copied payload, feed URLs, article URLs, server URLs, credentials, tokens, cookies, local paths, or account names.

Storage quota contract:

- Browser storage quota exhaustion must not cascade into additional local storage writes for preferences, sidebar expanded-folder state, command history, or debug diagnostics.
- Preferences, sidebar, history, and debug surfaces must continue with in-memory fallback and preserve recovery UI when persistence fails.
- A warning-once diagnostic may be emitted only by the diagnostics owner and must not require a successful local storage write to suppress repeats.

### User-Facing Error Correlation

Decision: user-facing copy may show a stable support code for the error category, but diagnostics identifiers are ephemeral log-correlation values and must not be treated as stable user or device identifiers.

Support codes should identify broad recovery areas such as network, account auth, keyring, database recovery, or migration recovery. Diagnostics IDs may be generated per event or per export for support correlation, but they must not encode private data and must not be reused across unrelated support tickets. User-facing copy must keep recovery guidance separate from raw diagnostic detail.

### Local App Action Diagnostics

Decision: do not add telemetry for app actions. A local-only, redacted, size-capped action sequence may be kept as runtime diagnostics for support correlation, but it must remain inside the existing diagnostics/support-copy consent and redaction boundary.

Action diagnostics may record action id, surface class, success/failure class, and coarse timing/order. They must not store account names, feed names, article titles, raw URLs, server URLs, local paths, credentials, tokens, cookies, clipboard payloads, or raw menu/shortcut payloads. Support copy may include the redacted action sequence only after explicit consent and preview, and it must follow the same 16 KiB per-event and 256 KiB history caps as other runtime diagnostics.

If action sequencing is needed before a diagnostics export exists, support should ask for a manually redacted app.log excerpt or reproduction steps rather than adding remote telemetry.

### Destructive Action Copy And Private Names

Decision: destructive delete/reset copy must consistently say when undo is unavailable, and dense lists must not expose more private user-created names through tooltips than the visible UI already justifies.

Destructive copy contract:

- Delete account, delete feed, delete tag, clear history, private data reset, and orphan cleanup prompts must include the target name when one is known.
- The same prompt must state that undo is unavailable when the operation cannot be rolled back by the app.
- Delete account and clear history copy must recommend making or preserving a private backup first when the operation can remove private reading or subscription history.
- Cleanup orphans copy must distinguish dry-run preview from destructive cleanup and must not imply undo when only a backup restore could recover data.
- When the target name cannot be loaded or parsed safely, the destructive action must be disabled or shown as a recovery-only action with the unavailable reason, not enabled with a generic target.
- Account recovery copy must keep credential reset, server URL or username fix, and account-scoped cache clear as separate recovery paths. Credential reset handles keyring material, server URL or username fix handles connection metadata and verification, and cache clear handles stale `sync_state` or `pending_mutations`.
- Account delete copy must treat the database account and OS keyring credential as separate privacy surfaces. If the database account is deleted but credential cleanup fails, report partial cleanup instead of claiming a complete reset.

Dense list name display contract:

- User-created names include account names, folders, tags, feeds renamed by the user, and future user-authored list labels.
- Dense rows may truncate these names with an ellipsis, but the action's accessible name still needs the full target name when the action is destructive or ambiguous.
- Tooltips and `title` attributes must not reveal credentials, tokens, cookies, full local paths, or full private URLs.
- A tooltip for a truncated user-created name may show the full name only when that same full name is already necessary to identify the row and does not include a secret-bearing URL or local path.
- Feed URLs, server URLs, log paths, and article URLs use redacted display and redacted tooltip copy; do not use a tooltip as a hidden full-value escape hatch.
- Middle truncation is preferred for URL-like values where both host and suffix are useful after redaction. End truncation is acceptable for normal names.
- Bidi control characters and isolated direction changes in user-created names must be sanitized or isolated for display so truncation cannot spoof adjacent action text.

## Future Feature Contracts

### System Tray And Background Resident Mode

Decision: do not ship tray or background resident mode until app lifecycle semantics are explicit for close, quit, updater restart, sync, and dirty settings state.

Today, closing the app is treated as ending the interactive session. A resident mode would keep sync and other native work alive after the main window closes, so it changes privacy expectations, battery use, error surfacing, and shutdown drain behavior.

Before tray or resident mode is enabled, the feature contract must define:

- the distinction between close-to-tray, quit, updater restart, OS shutdown, and force quit
- whether sync scheduler, updater checks, file export, and database backup may run while the main window is hidden
- how dirty settings forms, pending imports, pending exports, and in-flight backups block close, quit, and update restart
- visible user controls for disabling background activity and for quitting completely
- battery and network limits for repeated sync failure, offline state, many accounts, and low-power mode
- lock-screen-safe or in-app-only error surfacing when the app is resident
- packaged-build verification on macOS and Windows for close, reopen, quit, restart after update, and relaunch after OS login if login-start is introduced

Until this contract exists, closing the app must not be reinterpreted as background operation, and native notification, updater, or sync work must not rely on a tray-only recovery path.

### Sleep And Long-Running Native Operation Cancellation

Decision: long-running updater download, file export, and database backup flows must be cancellation-aware before they are expected to survive OS sleep or resume.

Laptop sleep can interrupt network streams, filesystem writes, progress events, and SQLite backup reads. A resumed app must not treat a partial artifact or stale progress value as a successful download, export, or backup.

Before these flows claim sleep/resume support, the contract must define:

- an operation generation or cancellation token that is checked before writing completion state, toast copy, or diagnostics
- partial artifact cleanup or quarantine for updater downloads, OPML exports, and database backups
- updater artifact invalidation on user cancel, failed install, failed restart, and app restart, so a stale downloaded artifact cannot become pending install state without fresh manifest, signature, and database compatibility validation
- progress reset behavior after sleep, cancellation, failed write, failed install, and app restart
- retry rules that distinguish user cancellation, OS sleep interruption, network failure, permission denied, and disk full
- database backup consistency requirements, including complete `.db` plus matching `-wal` / `-shm` handling where relevant
- focused packaged-build verification for sleep during updater download, sleep during export, sleep during backup, resume cleanup, and manual retry

Until that contract exists, docs and release notes must not promise that downloads, exports, or backups continue across OS sleep.

### Native Notification Permission And Quiet Hours

Decision: do not ship native notifications for sync, update, or error events until permission, privacy, quiet-hours, and disable controls are designed together.

Native notifications can appear on lock screens, in OS notification centers, or in shared-screen situations. Notification copy must therefore assume feed titles, article titles, account names, provider URLs, server URLs, and detailed error payloads are private by default.

Before native notifications are enabled, the feature contract must define:

- the exact events that may notify, separated by sync result, update, error, and recovery classes
- an explicit user opt-in or OS permission prompt path before the first non-critical notification
- a global disable setting and per-event-class controls before notification delivery
- quiet hours behavior, including whether urgent errors may bypass it and how that exception is presented
- lock-screen-safe copy that redacts account names, feed titles, article titles, server URLs, credentials, tokens, cookies, and local paths
- how notification click actions route back into the app without exposing private content in the notification payload
- focused packaged-build verification on macOS and Windows before release

Until this contract exists, sync/update/error feedback must stay in-app or in redacted logs rather than native OS notifications.

### Custom Protocol And Deep Link Routing

Decision: do not add a custom protocol or deep links until the URL schema, action allowlist, validation behavior, and single-instance routing are fixed as a contract.

External links are untrusted input. A future protocol must not accept arbitrary article URLs, feed URLs, local paths, provider endpoints, or app action names from the URL without explicit parsing and allowlisting.

Before a custom protocol is registered, the feature contract must define:

- the protocol scheme and versioned route shape, including reserved routes and unknown-version behavior
- a closed allowlist of actions such as opening settings, starting a safe import preview, or focusing an existing view
- strict parsing for malformed links, userinfo URLs, mixed scheme casing, percent-encoding, oversized payloads, and repeated parameters
- validation for private hosts, local paths, external provider URLs, and import sources before any state mutation
- a security confirmation prompt for actions that can import, navigate to remote content, reveal private state, or change settings
- single-instance behavior: the first running app instance receives the route, validates it, focuses the main window, and applies the action only after the app is ready
- logging and diagnostics that record route class and failure reason without storing the raw deep link when it can contain private data

Until this contract exists, external URLs must continue to use normal OS/browser handling and must not dispatch app actions through a custom protocol.

### Browser Webview And Article Reader Origin Boundaries

Decision: treat the embedded browser webview and the article reader as separate origin and state boundaries.

The embedded browser webview represents a remote publisher origin. The article reader renders sanitized article content inside the app-controlled local DOM. Reader state such as selected article, read/star status, focus target, and article-list position must not be inferred from the embedded browser's DOM origin, navigation state, cookies, or script context.

The current same-origin assumptions are:

- browser webview state may track URL, loading, back/forward availability, and host bounds, but must not expose remote DOM, cookies, storage, credentials, or injected script results to reader state
- article reader state may use sanitized `content_sanitized`, local app metadata, and app-controlled focus state, but must not treat remote publisher pages as same-origin app content
- focus bridging between reader controls and the embedded browser must be command-based and explicit; remote page scripts must not call app actions or Tauri IPC
- browser history tracking is browser-surface state only and must not mutate article read/star state without an app-controlled user action
- app scripts stay limited to `'self'`; any future script injection surface for preview automation requires a separate security review and packaged-build verification

Future changes that merge reader and browser state, add cross-origin messaging, or expose webview navigation data to app actions must update this contract before implementation.

### Provider Response Trust Boundary

Decision: provider responses have two trust classes. Authenticated provider API
DTOs are trusted backend data only after provider-specific parsing and schema
validation. Feed HTML, feed entry content, discovered metadata, article URLs,
favicon URLs, and error payload text remain untrusted feed data even when they
arrive through a trusted backend connection.

Trust boundary contract:

- Trusted backend DTO types may represent account-scoped provider state such as
  subscription ids, folder ids, sync cursors, read/star flags, and capability
  snapshots after strict provider parsing.
- Trusted backend DTO types must not carry unsanitized article HTML as trusted
  display content. Entry content from RSS, Atom, GReader, or FreshRSS remains
  untrusted feed HTML until the Rust sanitizer produces `content_sanitized`.
- Provider metadata such as title, author, feed title, category, icon URL, and
  alternate article URL is publisher-controlled display data. It must be
  escaped or sanitized at the display boundary and must not drive destructive
  actions without stable app ids or validated URLs.
- Provider error payloads are untrusted diagnostics input. User-visible errors
  and logs may use status class, refusal class, capability class, and redacted
  URL/server class, but must not persist raw provider error bodies.
- Schema strictness belongs at the provider/backend DTO boundary. HTML
  sanitization belongs at the untrusted feed content boundary. A type named or
  documented as trusted must not be used as proof that feed content is safe to
  render.
- Remote feed content and provider metadata must never suggest filesystem
  names, save paths, backup paths, export names, import destination names, or
  temporary-file prefixes. Filename/path suggestions must come only from
  app-owned constants, native dialog defaults, user-selected paths, or locally
  generated timestamps/ids.
- If a publisher title, feed title, article title, URL path segment, enclosure
  filename, favicon URL, `Content-Disposition`, or parser error text resembles
  a useful filename, it remains display-only untrusted text. It must not be
  joined into a path, normalized into a save filename, or used to decide where
  an import/export/backup artifact is written.

### Feed Parser Error Sample Policy

Decision: do not save feed parser response samples in support-safe diagnostics
by default.

Parser failures may involve private feed bodies, article excerpts, internal
publisher URLs, authenticated endpoint responses, or user-specific feed
metadata. Support-safe diagnostics may record only parse failure class,
provider/source class, content-type class, HTTP status class, response size
class, and an optional per-event hash for deduplication. They must not persist
raw response prefixes, article text, feed XML/JSON/HTML samples, raw feed URLs,
server URLs, credentials, tokens, cookies, local paths, account names, or stable
cross-ticket identifiers.

If future support tooling needs a response sample, it must be a separate
user-opt-in export after the support dump consent and redaction preview flow.
That flow must show the sample class before generation, cap the sample size,
fail closed when redaction cannot prove safety, and keep the resulting artifact
out of public issue attachments.

### Article Link Opener Policy

Decision: article links are untrusted publisher-controlled URLs and must be opened without granting an opener relationship, leaking full private URLs through diagnostics, or bypassing the same private-host policy used by feed discovery and feed fetch.

Link opener contract:

- Reader-mode article links must use `rel="noopener noreferrer"` when rendered as anchors. If opened through a native command instead of normal anchor navigation, the native opener must behave as an external navigation with no app-action dispatch, no script bridge, and no opener-style callback into the app.
- Article URLs, feed URLs, server URLs, and link tooltips must use redacted display and redacted diagnostics. Query strings, fragments, userinfo, credentials, tokens, cookies, and private path segments must not appear in logs, support copy, `title` attributes, or error toasts.
- Private, loopback, link-local, unspecified, credentialed, malformed, and unsupported-scheme article links must not be auto-opened from reader content. If a future UI allows the user to override a blocked article link, it must show a distinct warning state before navigation and must not store the raw blocked URL in diagnostics.
- Link policy changes must be verified against sanitized article content and external opener behavior separately from embedded Web Preview navigation.

### Credential-Bearing URL Persistence Policy

Decision: URLs containing userinfo or credential-like material are rejected at
persistence boundaries. Redaction is a diagnostics fallback, not permission to
store secret-bearing URLs.

Persistence boundary contract:

- Feed add, OPML import, provider server URL save, article URL normalization,
  browser history persistence, support dump generation, database backup/export
  metadata, and OPML export must reject or strip credential-bearing URLs before
  writing durable state.
- `http:` / `https:` URLs with `username:password@host` or any non-empty
  userinfo are credential-bearing and must not be stored as feed URLs, server
  URLs, article URLs, favicon URLs, history entries, or export metadata.
- Query parameters or fragments that are known credential carriers, including
  token, access token, auth, key, password, session, cookie, and signature
  fields, must not be copied into diagnostics or support copy. If a feature
  needs to persist such a URL for compatibility, it requires a separate reviewed
  allowlist and user-facing warning before implementation.
- OPML export must omit any feed whose persisted URL validation fails closed at
  export time rather than serializing a raw credential-bearing URL.
- Browser history may keep only a redacted display URL or failure class for a
  rejected credential-bearing navigation candidate. It must not persist the raw
  rejected URL for later retry.
- Database backups can contain historical rows from older builds, so backup and
  support guidance must continue to treat backups as private even after the
  current write path rejects credential-bearing URLs.

### Article Content Image Loading Policy

Decision: reader-mode image loading remains compatibility-first for this release, but it is a privacy and performance contract rather than an incidental CSP side effect.

Image loading contract:

- Sanitized reader content may load remote `http:` / `https:` images so article bodies and thumbnails remain readable.
- Remote image requests can disclose IP address, user agent, request timing, and the image URL path/query to publisher or third-party image hosts. User-facing privacy copy and support guidance must not describe reader mode as offline or tracker-free.
- Reader image rendering must not introduce script execution, app-action dispatch, Tauri IPC access, or same-origin assumptions with the embedded Web Preview.
- Broken, blocked, oversized, or slow images must leave text content readable and must not trigger unbounded retry loops.
- Future reader-only privacy modes may block remote images or tracking-pixel candidates, but they must be measured with the privacy hardening checklist before changing sanitizer, CSP, or frontend rendering behavior.

### Reduced Data And Low Power Policy

Decision: Ultra RSS Reader does not currently integrate with OS reduced-data or
low-power signals. Until an OS/user preference contract exists, the app must
keep compatibility-first reader image behavior, suppress automatic background
work only when an explicit app setting or scheduler policy says so, and keep
manual user actions available.

Reduced-data contract:

- Reader remote images continue to load in the default mode so saved articles
  remain readable. A future reduced-data setting may block reader remote images,
  but it must not change Web Preview behavior unless that separate browser
  surface is explicitly included in the setting copy.
- Feed favicon fetching is non-essential remote metadata. A future reduced-data
  or low-power mode should skip automatic favicon fetches and use local fallback
  initials/icons until the user manually refreshes metadata.
- Automatic background sync may be delayed or skipped while low-power,
  reduced-data, offline, repeated-failure, or many-account guardrails are active.
  Manual sync remains a user override and must record the native provider
  result instead of being silently suppressed.
- Suppressed automatic sync must surface as stale or suppressed state in-app,
  not as a successful fresh sync. Diagnostics should record suppression class
  without account names, feed URLs, or raw provider URLs.
- Settings copy must describe reduced-data behavior as "limits automatic remote
  loading and background work" rather than "offline", "tracker-free", or
  "private browsing".

### Feed Favicon Fetch Policy

Decision: feed favicons are optional remote metadata and must use a stricter
privacy contract than article content. Favicon fetch behavior must not inherit
browser defaults accidentally.

Favicon fetch contract:

- Favicon requests must send no `Referer` header. Frontend image rendering must
  use a no-referrer policy, and any native/proxy fetcher must set the equivalent
  no-referrer behavior explicitly.
- The user agent must be the app provider user agent declared in
  `src-tauri/src/infra/provider/http_defaults.rs` when native code fetches the
  favicon. Frontend-only image loading must not spoof browser, search-engine, or
  provider-specific crawler identities.
- Private, loopback, link-local, unspecified, malformed, unsupported-scheme,
  credential-bearing, and redirect-to-private favicon URLs must be rejected
  before fetch and before persistence.
- Favicon lookup must avoid sending feed path/query data to third-party
  endpoints. Prefer origin-level site URLs or a reviewed privacy-preserving
  proxy contract over raw feed URLs.
- Favicon cache entries must be scoped by normalized account/feed or normalized
  site origin, use a bounded TTL, and be evicted or ignored after feed deletion,
  account deletion, site URL change, or feed URL change.
- Failure cache must be bounded and resettable. A failed favicon must fall back
  without retry loops, and manual refresh may clear the failure entry for that
  feed/site origin only.
- Favicon diagnostics may record fetch class, status class, and redacted host
  class, but must not record raw feed paths, query strings, credentials, tokens,
  cookies, or account names.

### Feed Discovery Result Trust Levels

Decision: feed discovery results are untrusted metadata until the add action validates and normalizes the selected URL.

Discovery can receive titles, feed URLs, site URLs, content types, and redirects from arbitrary publisher-controlled pages. UI display may show this metadata for user choice, but add action must not treat it as trusted account or subscription state.

Trust level contract:

| Surface | Trust level | Allowed behavior |
| --- | --- | --- |
| Discovery result display | Untrusted preview | Show title, URL, and warning state with escaping and truncation |
| Add action candidate | Validated candidate | Re-validate scheme, host, redirect target, private-host policy, and mixed-content policy before mutation |
| Stored feed | Trusted app state | Store only normalized values returned by the validated add flow |

Display and action rules:

- Spoofable publisher titles must not be used as proof that a feed is safe.
- HTTP, mixed-content, private-host, credentialed, oversized, malformed, or redirecting URLs must show a distinct warning or blocked state before add.
- Add action must use the normalized feed URL selected by validation, not only the display label.
- If validation changes the URL, follows a redirect, or rejects a private host, the user-visible result must explain that before storing the feed.
- Debug logs and support copy must record discovery failure class without storing raw token-bearing URLs.

### Fixture Domain Name Policy

Decision: new fixtures, mock data, screenshots, and documentation examples should use RFC-reserved domains unless a real external service is the behavior under test.

Reserved-domain migration plan:

- Prefer `example.com`, `example.net`, `example.org`, `example.jp`, and `.test` hostnames for generic feeds, articles, thumbnails, favicons, and provider endpoints. Use `.test` for local fake services that must never resolve externally.
- Keep real domains only when the test is explicitly about an integration allowlist, provider compatibility, public release metadata, or a documented user-facing external service. Such fixtures must name why the real domain is required.
- Replace accidental real domains in dev mock data, frontend/Rust test fixtures, Storybook examples, and docs screenshots in small batches. Start with fixtures that can trigger network fetches, then display-only screenshots and static examples.
- Migration must preserve fixture intent by mapping old host classes to reserved equivalents: public article host, private-host rejection candidate, provider server, favicon host, redirect target, and malformed URL candidate.
- Screenshots should avoid showing real organizations, account names, feed URLs, or article URLs unless the screenshot is explicitly a redacted live-service verification artifact.
- During migration, do not rewrite stored user data examples or release verification notes that intentionally document a live service. Redact or annotate them instead.
- Any remaining real-domain fixture should be easy to inventory with a text search and should be reviewed before adding network-enabled tests or screenshots.

### Feed Discovery Crawl Policy

Decision: feed discovery is a bounded user-requested fetch, not a general crawler.

Robots and user-agent contract:

- Discovery and local feed fetch requests must use the provider user agent declared in `src-tauri/src/infra/provider/http_defaults.rs`.
- Discovery must not spoof browser, search-engine, or provider-specific crawler identities.
- `robots.txt` handling is currently policy-only: Ultra RSS Reader does not perform background crawling or recursive site indexing during feed discovery. If discovery is expanded beyond a direct user-requested page/feed fetch, robots fetching, robots result caching, and per-host politeness limits must be implemented before release.
- A `robots.txt` disallow or explicit provider block must be treated as a provider-controlled refusal, not as proof that the URL is invalid or that credentials are wrong.

Provider refusal handling contract:

- Provider rate limiting, including HTTP 429 and valid `Retry-After`, is sync backoff input and may be retried automatically after the scheduler's backoff window.
- Provider authorization refusals such as HTTP 401/403 require user action for credential, account, or server configuration review. They must not be hidden as normal sync backoff or retried in a tight loop.
- Robots or crawl-policy refusals require user action or a visible blocked state. They must not be collapsed into generic offline/network failure copy.
- Diagnostics for refusals must record only the refusal class, status class, and redacted URL/server class, not raw private feed or article URLs.

### Feed And Article Identity Policy

Decision: feed item identity is account/feed-scoped before it is article-scoped. A publisher GUID is not globally unique across an account, so the app must not merge two entries only because different feeds emit the same GUID.

Identity contract:

- Article identity priority is trimmed GUID, normalized article URL, then title fallback.
- Non-empty GUID identity must include the account boundary and the feed boundary. The selected article URL may change without changing identity when the same account/feed/GUID tuple is present.
- Empty or whitespace-only GUID values are ignored and fall back to normalized article URL, then title.
- URL-only and title-only fallback identities must include the account and feed boundary so two feeds cannot share unread, starred, tag, or history state accidentally.
- Feed URL redirects or feed URL edits need a migration decision before preserving old item identities across the old and new feed boundary.

### Article URL Normalization Policy

Decision: provider article URLs are normalized only enough to make stored links safe and stable. They are not canonicalized for tracking removal or semantic URL equivalence.

Normalization contract:

- RSS/Atom feed entry links prefer `alternate` HTML links over feed self links and enclosures.
- GReader entries prefer `alternate` links before `canonical` fallback links.
- Article URLs accept only `http:` and `https:`.
- Leading/trailing whitespace, URL userinfo, and fragments are removed before storage.
- Host and scheme casing follow URL parser canonicalization, while path and query casing and query parameters are preserved.
- Malformed URLs, unsupported schemes, empty links, oversized links, and links with control characters are ignored.
- Canonical URL and feed entry link normalization must use the same provider article URL normalizer before storing `Article.url`.

### Spoofable Name Display Policy

Decision: article, feed, folder, tag, and account names are stored as publisher/user text, but destructive or target-identifying UI must treat bidi controls and zero-width controls as spoofing risk indicators.

Display contract:

- Display labels are trimmed at the display boundary.
- Do not apply NFKC or other compatibility normalization to stored names or normal display labels; full-width and other intentional typography must remain visible.
- Bidi controls and zero-width controls must not silently decide action targets. Confirmation labels, destructive actions, and rename/delete review surfaces must show a distinct warning or escaped/annotated representation before acting.
- Confusable characters are a display risk, not a duplicate-key rule, unless a future task defines normalized uniqueness for a specific entity type.
- Diagnostics and support copy must not rely on raw spoofable names alone; include stable IDs or redacted entity classes where needed.

## Guardrails

- Reader HTML must continue to come from sanitized `content_sanitized` fields.
- Any future CSP tightening must preserve `script-src 'self'` unless there is an explicit, reviewed reason to change it.
- Privacy changes that affect remote images, frames, or preview loading must be verified in reader mode, preview mode, and packaged Tauri builds before release.
- Private data reset and uninstall guidance must cover database, credentials, preferences/local app state, release logs, stale support/debug logs, support dumps, and backups as separate retention surfaces.
- Installer, updater, uninstall, and reinstall copy must say that app data can persist across app binary removal and app reinstall.
- Support artifacts must be redacted before sharing and deleted manually when they are no longer needed.
- Support dumps must not be generated before explicit user consent and redaction preview.
- Native notifications, custom protocols, deep links, and cross-origin browser/reader bridges must not ship before their privacy and routing contracts are defined and verified.
- Feed discovery preview metadata must stay separate from validated add-feed state.
- Import/export cancel actions must confirm before canceling once partial writes or state mutations are possible.

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
