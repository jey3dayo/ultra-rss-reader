---
type: runbook
title: Native Dev Verification
description: Local Tauri dev app process capture, screenshots, keyboard input, and Debug HUD verification.
resource: urn:ultra-rss-reader:docs:native-dev-verification
tags: [category/testing, audience/agent, audience/developer, environment/local, tool/tauri]
timestamp: 2026-06-29
audience: agent, developer
owner: project-maintainers
---

# Native Dev Verification

Use this runbook when Codex or Computer Use needs to operate the Tauri dev app and keep visual evidence. It is for local dev verification only, not release sign-off.

## Tool Choice

- Use Computer Use for visible window state, human-eye checks, and interacting with native chrome when accessibility state matters.
- Use `tauri-mcp-server` for main WebView DOM, computed style, element lookup, keyboard input into the main WebView, and IPC-oriented checks.
- Use shell commands for stable process capture and saved screenshots. Prefer `screencapture` for PNG evidence because it can capture one native window rectangle without relying on an automation tool's current viewport.

## Capture The Target Process

Start from the running dev app, then make sure the target is the Tauri dev binary before sending keys or taking evidence.

```bash
osascript \
  -e 'tell application "System Events" to tell process "ultra-rss-reader" to set frontmost to true' \
  -e 'delay 0.2' \
  -e 'tell application "System Events"' \
  -e 'set p to process "ultra-rss-reader"' \
  -e 'set winPos to position of window 1 of p' \
  -e 'set winSize to size of window 1 of p' \
  -e 'return (unix id of p as string) & "|" & (winPos as string) & "|" & (winSize as string)' \
  -e 'end tell'
```

Then verify the PID points at the dev executable:

```bash
ps -p "$PID" -o pid=,comm=
```

Expected command path contains `target/debug/ultra-rss-reader`. If the frontmost app is Slack, Finder, Codex, or another app, bring `ultra-rss-reader` forward again before continuing.

## Window Screenshot Evidence

Save screenshots under `tmp/screenshots/` unless the artifact is intentionally temporary and will not be referenced later.

AppleScript may print `position` and `size` as comma-separated values in some environments and as compact digit strings in others. If the output is ambiguous, query `position` and `size` separately or inspect the resulting screenshot before trusting it.

```bash
mkdir -p tmp/screenshots
screencapture -x -R"$LEFT,$TOP,$WIDTH,$HEIGHT" tmp/screenshots/native-dev-window.png
```

Use the captured PNG to verify that only the Ultra RSS Reader Dev window is visible. Re-capture after each important input sequence instead of relying on a stale screenshot.

## Key Input

Use `key code` for special keys and `keystroke` for printable shortcuts:

```bash
osascript \
  -e 'tell application "System Events" to tell process "ultra-rss-reader" to set frontmost to true' \
  -e 'delay 0.1' \
  -e 'tell application "System Events" to key code 53' \
  -e 'delay 0.5' \
  -e 'tell application "System Events" to keystroke "j"' \
  -e 'delay 0.3' \
  -e 'tell application "System Events" to keystroke "k"'
```

Common keys:

| Action | Input |
| --- | --- |
| Escape | `key code 53` |
| Enter | `key code 36` |
| Next article | `keystroke "j"` |
| Previous article | `keystroke "k"` |
| Open in-app browser | `keystroke "v"` |
| Reload app | `keystroke "r" using command down` |

Before sending keys, state which focus surface is under test: main WebView, child browser WebView, native chrome, or another app. WebView focus is not the same as main WebView focus. When the child browser WebView owns focus, key events may be handled by the page or the native shortcut bridge before the main React keyboard hook sees them.

## Debug HUD Reading

When the Debug HUD is visible, use it as the first sanity check after keyboard verification:

- `PANE`: current reader keyboard target. After closing browser preview, expected value is usually `LIST`.
- `MODE`: current content mode. Browser close should leave `READER` or `EMPTY`, not `BROWSER`.
- Target summary: confirms whether focus is on a row, content pane, `body`, editable field, or stale overlay element.
- `CLOSING`: browser close in-flight state. It must return to `FALSE` after close completes.
- `PENDING`: buffered action while browser close is in-flight. It must return to `NONE` after flush.
- Recent events: look for `window-key j -> navigate-article`, `window-key k -> navigate-article`, `flush none`, or queued pending actions.

For the WebView Escape close contract, the useful evidence sequence is:

1. Child WebView or page body is focused.
2. Send `Escape`.
3. Screenshot shows `MODE=READER`, `CLOSING=FALSE`, and `PENDING=NONE`.
4. Send `j`, then `k`.
5. Screenshot or HUD recent events show `navigate-article` and the selected row/article changes.

## Common Failure Modes

- Another app is frontmost: System Events sends keys to the wrong process. Re-run the process capture step and verify the PID.
- The dev app is running an old bundle or stale store action after HMR. Use `Cmd+R`; if store actions are still stale, restart `mise run app:dev`.
- The child browser WebView has focus. This is expected for WebView-specific tests, but main WebView DOM tools and global React key handlers may not observe those events.
- A screenshot rectangle captures the wrong monitor or app. Re-read window position and size, then capture again.
- Debug HUD shows `MODE=BROWSER`, `CLOSING=TRUE`, or non-empty `PENDING` after a close wait. Treat that as a failed close-finalization path, not as successful Escape handling.
