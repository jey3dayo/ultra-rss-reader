import {
  BooleanResponseSchema,
  BrowserWebviewStateSchema,
  checkBrowserEmbedSupportArgs,
  createOrUpdateBrowserWebviewArgs,
  NullResponseSchema,
  openExternalUrlArgs,
  openInBrowserArgs,
  setBrowserWebviewBoundsArgs,
} from "@/api/schemas";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";
import { safeInvoke } from "./runtime";

export const openInBrowser = (url: string, background?: boolean) =>
  safeInvoke("open_in_browser", { response: NullResponseSchema, args: openInBrowserArgs }, { url, background });

// Runtime is owned by the Rust tauri-plugin-opener registration; TS only needs the invoke command contract.
export const openExternalUrl = (url: string) =>
  safeInvoke("plugin:opener|open_url", { response: NullResponseSchema, args: openExternalUrlArgs }, { url });

export const checkBrowserEmbedSupport = (url: string) =>
  safeInvoke(
    "check_browser_embed_support",
    { response: BooleanResponseSchema, args: checkBrowserEmbedSupportArgs },
    { url },
  );

export const createOrUpdateBrowserWebview = (url: string, bounds: BrowserWebviewBounds) =>
  safeInvoke(
    "create_or_update_browser_webview",
    {
      response: BrowserWebviewStateSchema,
      args: createOrUpdateBrowserWebviewArgs,
    },
    { url, bounds },
  );

export const setBrowserWebviewBounds = (bounds: BrowserWebviewBounds) =>
  safeInvoke(
    "set_browser_webview_bounds",
    { response: NullResponseSchema, args: setBrowserWebviewBoundsArgs },
    { bounds },
  );

export const focusBrowserWebview = () => safeInvoke("focus_browser_webview", { response: NullResponseSchema });

export const goBackBrowserWebview = () =>
  safeInvoke("go_back_browser_webview", {
    response: BrowserWebviewStateSchema,
  });

export const goForwardBrowserWebview = () =>
  safeInvoke("go_forward_browser_webview", {
    response: BrowserWebviewStateSchema,
  });

export const reloadBrowserWebview = () => safeInvoke("reload_browser_webview", { response: BrowserWebviewStateSchema });

export const closeBrowserWebview = () => safeInvoke("close_browser_webview", { response: NullResponseSchema });
