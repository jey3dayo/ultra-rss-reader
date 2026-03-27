import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SettingsModal } from "@/components/settings/settings-modal";
import { useUiStore } from "@/stores/ui-store";
import { sampleAccounts, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("SettingsModal", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings();
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return sampleAccounts;
      }
      return null;
    });
  });

  it("exposes an accessible name for the close button", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close preferences" })).toBeInTheDocument();
  });
});
