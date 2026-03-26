import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { teardownTauriMocks } from "./helpers/tauri-mocks";

afterEach(() => {
  cleanup();
  teardownTauriMocks();
});
