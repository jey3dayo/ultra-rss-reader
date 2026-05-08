import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/i18n";
import { App } from "./App";
import { setupDevMocks } from "./dev-mocks";
import "./styles/global.css";

// Inject mock IPC when running in browser (not inside Tauri)
setupDevMocks();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
