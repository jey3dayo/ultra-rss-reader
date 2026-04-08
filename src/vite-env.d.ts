/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_INTENT?: string;
  readonly VITE_DEV_WEB_URL?: string;
  readonly VITE_ULTRA_RSS_DEV_INTENT?: string;
  readonly VITE_ULTRA_RSS_DEV_WEB_URL?: string;
}

interface Window {
  __TAURI_INTERNALS__?: unknown;
  __DEV_BROWSER_MOCKS__?: boolean;
  __ULTRA_RSS_BROWSER_MOCKS__?: boolean;
}
