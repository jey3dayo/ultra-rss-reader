import { beforeEach, describe, expect, it, vi } from "vitest";

const createRootMock = vi.hoisted(() => vi.fn(() => ({ render: vi.fn() })));
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

describe("main app root bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    createRootMock.mockClear();
    setupDevMocksMock.mockClear();
    document.body.innerHTML = "";
  });

  it("renders a user-visible fallback when #root is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("@/main");

    expect(setupDevMocksMock).toHaveBeenCalledOnce();
    expect(createRootMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Root element #root was not found.");
    expect(document.querySelector("[data-app-root-missing-fallback]")).toHaveTextContent(
      "アプリの起動に失敗しました。ウィンドウを再読み込みしてください。",
    );
    expect(document.querySelector("[role='alert']")).toBe(document.querySelector("[data-app-root-missing-fallback]"));
    consoleError.mockRestore();
  });
});
