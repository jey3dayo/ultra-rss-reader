import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryQueryClientProvider } from "@/components/storybook/story-query-client-provider";

function QueryClientProbe({ onClient }: { onClient: (queryClient: QueryClient) => void }) {
  const queryClient = useQueryClient();
  onClient(queryClient);
  return null;
}

describe("StoryQueryClientProvider", () => {
  it("does not install an app-like Tauri runtime for component isolation stories", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    render(
      <StoryQueryClientProvider>
        <div>Component story</div>
      </StoryQueryClientProvider>,
    );

    expect(window.__TAURI_INTERNALS__).toBeUndefined();
  });

  it("creates an isolated non-retrying query client per story render", () => {
    const firstClientProbe = vi.fn();
    const firstRender = render(
      <StoryQueryClientProvider>
        <QueryClientProbe onClient={firstClientProbe} />
      </StoryQueryClientProvider>,
    );
    const firstClient = firstClientProbe.mock.calls[0]?.[0];

    expect(firstClient).toBeDefined();
    expect(firstClient?.getDefaultOptions().mutations?.retry).toBe(false);
    expect(firstClient?.getDefaultOptions().queries?.retry).toBe(false);

    firstClient?.setQueryData(["story", "cache"], "first render");
    firstClient?.getMutationCache().build(firstClient, {
      mutationFn: vi.fn(),
      mutationKey: ["story", "mutation-cache"],
    });
    firstRender.unmount();

    const secondClientProbe = vi.fn();
    render(
      <StoryQueryClientProvider>
        <QueryClientProbe onClient={secondClientProbe} />
      </StoryQueryClientProvider>,
    );
    const secondClient = secondClientProbe.mock.calls[0]?.[0];

    expect(secondClient).toBeDefined();
    expect(secondClient).not.toBe(firstClient);
    expect(secondClient?.getDefaultOptions().mutations?.retry).toBe(false);
    expect(secondClient?.getDefaultOptions().queries?.retry).toBe(false);
    expect(secondClient?.getMutationCache().getAll()).toHaveLength(0);
    expect(secondClient?.getQueryData(["story", "cache"])).toBeUndefined();
  });
});
