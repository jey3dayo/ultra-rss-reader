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
  it("creates an isolated non-retrying query client per story render", () => {
    const firstClientProbe = vi.fn();
    const firstRender = render(
      <StoryQueryClientProvider>
        <QueryClientProbe onClient={firstClientProbe} />
      </StoryQueryClientProvider>,
    );
    const firstClient = firstClientProbe.mock.calls[0]?.[0];

    expect(firstClient).toBeDefined();
    expect(firstClient?.getDefaultOptions().queries?.retry).toBe(false);

    firstClient?.setQueryData(["story", "cache"], "first render");
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
    expect(secondClient?.getDefaultOptions().queries?.retry).toBe(false);
    expect(secondClient?.getQueryData(["story", "cache"])).toBeUndefined();
  });
});
