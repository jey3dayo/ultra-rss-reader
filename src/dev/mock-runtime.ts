import {
  captureRuntimeWindowDescriptors,
  defineRuntimeWindowDescriptor,
  type RuntimeWindowDescriptorsSnapshot,
  restoreRuntimeWindowDescriptors,
} from "@/components/storybook/story-tauri-runtime";

type DevMockWindowGlobalName = "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__";
type DevMockWindowGlobalsSnapshot = Pick<RuntimeWindowDescriptorsSnapshot, DevMockWindowGlobalName>;
type DevMockDiagnostic = {
  kind: "unknown-command";
  command: string;
  message: string;
};
type DevMockDiagnosticsWindow = Window & {
  __ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__?: DevMockDiagnostic[];
};
export type DevMockExternalOpen = {
  command: "open_in_browser" | "plugin:opener|open_url" | "add_to_reading_list";
  url: string;
  target: "_blank" | "reading-list";
};
type DevMockExternalOpenerWindow = Window & {
  __ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__?: DevMockExternalOpen[];
};
export type RestoreDevMocks = () => void;

const DEV_MOCK_DIAGNOSTICS_ELEMENT_ID = "ultra-rss-dev-mock-diagnostics";
const DEV_MOCK_DIAGNOSTICS_EVENT = "ultra-rss-dev-mock-diagnostics";

function devMockDiagnosticsWindow(): DevMockDiagnosticsWindow {
  return window as DevMockDiagnosticsWindow;
}

function devMockExternalOpenerWindow(): DevMockExternalOpenerWindow {
  return window as DevMockExternalOpenerWindow;
}

export function recordDevMockExternalOpen(open: DevMockExternalOpen) {
  const targetWindow = devMockExternalOpenerWindow();
  const opens = targetWindow.__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__ ?? [];
  opens.push(open);
  targetWindow.__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__ = opens;
}

export function resetDevMockExternalOpens() {
  devMockExternalOpenerWindow().__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__ = [];
}

function ensureDevMockDiagnosticsCanvas(): HTMLElement {
  const existing = document.getElementById(DEV_MOCK_DIAGNOSTICS_ELEMENT_ID);
  if (existing) {
    return existing;
  }

  const element = document.createElement("aside");
  element.id = DEV_MOCK_DIAGNOSTICS_ELEMENT_ID;
  element.dataset.testid = "dev-mock-diagnostics-canvas";
  element.setAttribute("aria-live", "polite");
  element.style.cssText = [
    "position: fixed",
    "right: 12px",
    "bottom: 12px",
    "z-index: 2147483647",
    "max-width: min(420px, calc(100vw - 24px))",
    "padding: 8px 10px",
    "border: 1px solid rgba(185, 28, 28, 0.35)",
    "border-radius: 8px",
    "background: rgba(254, 242, 242, 0.96)",
    "color: #7f1d1d",
    "font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "box-shadow: 0 8px 24px rgba(127, 29, 29, 0.16)",
  ].join(";");
  document.body.append(element);
  return element;
}

function renderDevMockDiagnosticsCanvas(diagnostics: readonly DevMockDiagnostic[]) {
  if (diagnostics.length === 0) {
    document.getElementById(DEV_MOCK_DIAGNOSTICS_ELEMENT_ID)?.remove();
    return;
  }

  const latest = diagnostics[diagnostics.length - 1];
  ensureDevMockDiagnosticsCanvas().textContent = latest?.message ?? "";
}

export function resetDevMockDiagnostics() {
  const targetWindow = devMockDiagnosticsWindow();
  targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ = [];
  renderDevMockDiagnosticsCanvas([]);
}

export function recordDevMockUnknownCommand(command: string): Error {
  const message = `[dev-mocks] Unknown command: ${command}`;
  const diagnostic: DevMockDiagnostic = {
    kind: "unknown-command",
    command,
    message,
  };
  const targetWindow = devMockDiagnosticsWindow();
  const diagnostics = targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ ?? [];
  diagnostics.push(diagnostic);
  targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ = diagnostics;
  renderDevMockDiagnosticsCanvas(diagnostics);
  window.dispatchEvent(new CustomEvent(DEV_MOCK_DIAGNOSTICS_EVENT, { detail: diagnostic }));
  return new Error(message);
}

export function captureDevMockWindowGlobals(): DevMockWindowGlobalsSnapshot {
  return captureRuntimeWindowDescriptors(["__DEV_BROWSER_MOCKS__", "__ULTRA_RSS_BROWSER_MOCKS__"]);
}

export function defineDevMockWindowGlobal(name: DevMockWindowGlobalName, value: boolean) {
  defineRuntimeWindowDescriptor(name, {
    writable: true,
    value,
  });
}

export function setDevMockWindowGlobal(name: DevMockWindowGlobalName) {
  defineDevMockWindowGlobal(name, true);
}

export function createDevMockWindowGlobalsRestore(snapshot: DevMockWindowGlobalsSnapshot): RestoreDevMocks {
  return () => {
    restoreRuntimeWindowDescriptors(snapshot);
  };
}
