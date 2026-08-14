import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/i18n";
import { createReactErrorHandlers, initMonitoring } from "@/lib/runtime/monitoring";
import { App } from "./App";
import "./styles/global.css";

const monitoringEnabled = initMonitoring();

export const APP_ROOT_MISSING_FALLBACK_TEXT = "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。";
const APP_ROOT_SELECTOR = "#root";

type BrowserMockBootstrapOptions = {
  isDev?: boolean;
  ownerWindow?: Window;
};

export function shouldSetupBrowserMocks({
  isDev = import.meta.env.DEV,
  ownerWindow = window,
}: BrowserMockBootstrapOptions = {}): boolean {
  return isDev || ownerWindow.__TAURI_INTERNALS__ == null;
}

export function renderAppRootMissingFallback(ownerDocument: Document = document) {
  const fallback = ownerDocument.createElement("div");
  fallback.setAttribute("role", "alert");
  fallback.setAttribute("data-app-root-missing-fallback", "");
  fallback.textContent = APP_ROOT_MISSING_FALLBACK_TEXT;
  ownerDocument.body.append(fallback);
  return fallback;
}

export function resolveAppRoot(ownerDocument: Document = document): HTMLElement | null {
  const rootElements = ownerDocument.querySelectorAll<HTMLElement>(APP_ROOT_SELECTOR);

  if (rootElements.length === 1) {
    return rootElements.item(0);
  }

  console.error(`Expected exactly one ${APP_ROOT_SELECTOR} element, found ${rootElements.length}.`);
  renderAppRootMissingFallback(ownerDocument);
  return null;
}

export function mountApp(
  rootElement: HTMLElement | null = resolveAppRoot(),
  { errorHandlersEnabled = monitoringEnabled }: { errorHandlersEnabled?: boolean } = {},
) {
  if (!rootElement) {
    return;
  }

  try {
    // Only wire Sentry's React root error hooks when monitoring actually initialized.
    // Passing them unconditionally would replace React 19's default root error console
    // reporting with a no-op handler whenever Sentry is disabled (missing DSN, dev, test).
    const root = errorHandlersEnabled
      ? ReactDOM.createRoot(rootElement, createReactErrorHandlers())
      : ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    console.error("Failed to render app root.", error);
    renderAppRootMissingFallback(rootElement.ownerDocument);
  }
}

if (shouldSetupBrowserMocks()) {
  const { setupDevMocks } = await import("@/dev/mocks");
  setupDevMocks();
}
mountApp();
