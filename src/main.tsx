import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { setupDevMocks } from "./dev-mocks";
import "./styles/global.css";

// Inject mock IPC when running in browser (not inside Tauri)
setupDevMocks();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
