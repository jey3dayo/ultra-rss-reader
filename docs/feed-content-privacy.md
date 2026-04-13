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

## Related Files

- `src-tauri/tauri.conf.json`
- `README.md`
- `docs/release-manual-verification.md`
