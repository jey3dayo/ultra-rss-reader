import "@testing-library/jest-dom/vitest";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { beforeEach, describe, expect, it, vi } from "vitest";

setupBrowserTestDom();

const renderMock = vi.hoisted(() => vi.fn());
const createRootMock = vi.hoisted(() => vi.fn(() => ({ render: renderMock })));
const setupDevMocksMock = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: createRootMock,
  },
}));

vi.mock("@/dev/mocks", () => ({
  setupDevMocks: setupDevMocksMock,
}));

vi.mock("@/App", () => ({
  App: () => null,
}));

async function importMainAndWaitForBootstrap() {
  await import("@/main");
  await vi.waitFor(() => {
    expect(setupDevMocksMock).toHaveBeenCalledOnce();
  });
}

describe("main app root bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    createRootMock.mockClear();
    renderMock.mockClear();
    setupDevMocksMock.mockClear();
    document.body.innerHTML = "";
  });

  it("mounts the app when exactly one #root element exists", async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await importMainAndWaitForBootstrap();

    expect(createRootMock).toHaveBeenCalledOnce();
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-app-root-missing-fallback]")).toBeNull();
  });

  it("renders a user-visible fallback when #root is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await importMainAndWaitForBootstrap();

    expect(createRootMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Expected exactly one #root element, found 0.");
    expect(document.querySelector("[data-app-root-missing-fallback]")).toHaveTextContent(
      "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。",
    );
    expect(document.querySelector("[role='alert']")).toBe(document.querySelector("[data-app-root-missing-fallback]"));
    consoleError.mockRestore();
  });

  it("renders the same fallback when duplicate #root elements exist", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    document.body.innerHTML = '<div id="root"></div><div id="root"></div>';

    await importMainAndWaitForBootstrap();

    expect(createRootMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Expected exactly one #root element, found 2.");
    expect(document.querySelector("[data-app-root-missing-fallback]")).toHaveTextContent(
      "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。",
    );
    consoleError.mockRestore();
  });

  it("renders the same fallback and only writes a local log when app render throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dispatchEvent = vi.spyOn(window, "dispatchEvent");
    const renderError = new Error("render failed");
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockImplementationOnce(() => {
      throw renderError;
    });

    await importMainAndWaitForBootstrap();

    expect(createRootMock).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Failed to render app root.", renderError);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(document.querySelector("[data-app-root-missing-fallback]")).toHaveTextContent(
      "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。",
    );
    consoleError.mockRestore();
    dispatchEvent.mockRestore();
  });
});
