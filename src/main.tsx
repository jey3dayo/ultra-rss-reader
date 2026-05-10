import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/i18n";
import { setupDevMocks } from "@/dev/mocks";
import { App } from "./App";
import "./styles/global.css";

export const APP_ROOT_MISSING_FALLBACK_TEXT = "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。";
const APP_ROOT_SELECTOR = "#root";

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

export function mountApp(rootElement: HTMLElement | null = resolveAppRoot()) {
  if (!rootElement) {
    return;
  }

  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    console.error("Failed to render app root.", error);
    renderAppRootMissingFallback(rootElement.ownerDocument);
  }
}

// Inject mock IPC when running in browser (not inside Tauri)
setupDevMocks();
mountApp();
