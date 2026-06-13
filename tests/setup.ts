import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { resetCommandHistoryStorageFailureWarnings } from "@/lib/command-palette/command-history-storage";
import { resetStartupSyncStorageFailureWarnings } from "@/lib/sync/startup-sync-storage";
import {
  clearWorkingStorage,
  ensureGetAnimations,
  ensureWorkingStorage,
  readWorkingWindowStorage,
  restoreProcessEnv,
  restoreStorageDescriptors,
} from "./helpers/browser-test-globals";
import {
  flushMutationObservers as flushTestMutationObservers,
  flushResizeObservers as flushTestResizeObservers,
  getMutationObserverMocks as getTestMutationObservers,
  getResizeObserverMocks as getTestResizeObservers,
  installTestObserverMocks,
  resetTestObserverMocks,
} from "./helpers/observer-mocks";

export {
  flushTestMutationObservers,
  flushTestResizeObservers,
  getTestMutationObservers,
  getTestResizeObservers,
  installTestObserverMocks,
  resetTestObserverMocks,
};

ensureWorkingStorage();
ensureGetAnimations();

import "./helpers/i18n-setup";
import { teardownTauriMocks } from "./helpers/tauri-mocks";
import { resetTauriRuntimeFlags } from "./helpers/tauri-runtime";

configure({ asyncUtilTimeout: 10_000 });
installTestObserverMocks();

beforeEach(() => {
  installTestObserverMocks();
});

afterEach(() => {
  cleanup();
  // Base UI dialogs/popovers lock scrolling by writing inline styles onto
  // document.body (e.g. overflow: hidden, padding-right). Their restore can be
  // deferred past a test file boundary, leaking the locked state into the next
  // file and causing order-dependent flaky failures in scroll/layout-sensitive
  // suites. Reset the document-level inline styles after every test.
  document.body.style.cssText = "";
  document.documentElement.style.cssText = "";
  teardownTauriMocks();
  resetTauriRuntimeFlags();
  resetCommandHistoryStorageFailureWarnings();
  resetStartupSyncStorageFailureWarnings();
  resetTestObserverMocks();
  vi.useRealTimers();
  restoreProcessEnv();
  clearWorkingStorage(readWorkingWindowStorage("localStorage"));
  clearWorkingStorage(readWorkingWindowStorage("sessionStorage"));
  restoreStorageDescriptors();
  ensureWorkingStorage();
  installTestObserverMocks();
});
