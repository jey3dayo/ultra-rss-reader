import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import "./helpers/i18n-setup";
import { teardownTauriMocks } from "./helpers/tauri-mocks";

afterEach(() => {
  cleanup();
  teardownTauriMocks();
});
