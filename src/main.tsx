import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/i18n";
import { setupDevMocks } from "@/dev/mocks";
import { App } from "./App";
import "./styles/global.css";

export const APP_ROOT_MISSING_FALLBACK_TEXT = "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。";

export function renderAppRootMissingFallback(ownerDocument: Document = document) {
  const fallback = ownerDocument.createElement("div");
  fallback.setAttribute("role", "alert");
  fallback.setAttribute("data-app-root-missing-fallback", "");
  fallback.textContent = APP_ROOT_MISSING_FALLBACK_TEXT;
  ownerDocument.body.append(fallback);
  return fallback;
}

export function mountApp(rootElement: HTMLElement | null = document.getElementById("root")) {
  if (!rootElement) {
    console.error("Root element #root was not found.");
    renderAppRootMissingFallback();
    return;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Inject mock IPC when running in browser (not inside Tauri)
setupDevMocks();
mountApp();
