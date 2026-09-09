/**
 * The legacy `keyCode` macOS WebKit keeps reporting for a keystroke the IME owns.
 */
const IME_LEGACY_KEY_CODE = 229;

export type ImeCandidateKeyEvent = {
  isComposing?: boolean;
  keyCode?: number;
};

/**
 * True while an IME candidate owns the keystroke, so the handler must not act on it.
 *
 * `isComposing` alone is not enough. macOS WebKit — the engine behind WKWebView, which is what
 * Tauri runs on macOS — fires `compositionend` before the commit `keydown` on purpose for IE
 * compatibility, so the Enter that confirms a candidate arrives with `isComposing === false`. The
 * legacy `keyCode` stays 229 for that keystroke, which is the only signal left to recognise it.
 *
 * WebKit bug 165004 tracks the ordering; the fix (WebKit 311717) is still behind an unstable flag
 * as of Safari 26.3 per mdn/browser-compat-data#29998, so the fallback has to stay.
 *
 * The structural event type lets this helper accept both native keyboard events and the native
 * events carried by React synthetic keyboard events.
 */
export function isImeCommitKeyEvent(event: ImeCandidateKeyEvent): boolean {
  return event.isComposing === true || event.keyCode === IME_LEGACY_KEY_CODE;
}
