# Feed Content Privacy And CSP Policy

This document is the source of truth for how Ultra RSS Reader treats remote article content, privacy, and Tauri CSP decisions.

## Current Product Decision

Ultra RSS Reader is currently compatibility-first for feed content.

- The reader renders Rust-sanitized article HTML only.
- App scripts remain locked to `'self'`.
- Remote `http:` / `https:` images are allowed so normal article bodies and thumbnails can render.
- Remote `http:` / `https:` frames are allowed because Web Preview is an explicit embedded-browser feature.

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

## Guardrails

- Reader HTML must continue to come from sanitized `content_sanitized` fields.
- Any future CSP tightening must preserve `script-src 'self'` unless there is an explicit, reviewed reason to change it.
- Privacy changes that affect remote images, frames, or preview loading must be verified in reader mode, preview mode, and packaged Tauri builds before release.

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
