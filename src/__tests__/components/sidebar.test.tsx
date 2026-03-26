import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

describe("Sidebar", () => {
  beforeEach(() => {
    setupTauriMocks();
  });

  it("renders the sidebar heading", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Ultra RSS")).toBeInTheDocument();
  });

  it("renders smart view items (Unread and Starred buttons)", () => {
    render(<Sidebar />, { wrapper: createWrapper() });
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Starred")).toBeInTheDocument();
  });

  it("renders feeds after data loads", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    // After accounts load, the first account is auto-selected, which triggers feeds query
    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("shows unread count for feeds with unread articles", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Tech Blog has unread_count: 5 (also shown in total unread)
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });
});
