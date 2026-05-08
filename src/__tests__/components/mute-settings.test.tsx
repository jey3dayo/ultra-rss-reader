import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MuteSettings } from "@/components/settings/mute-settings";
import { useUiStore } from "@/stores/ui-store";

const updateMuteKeywordMutateAsyncMock = vi.fn();
const createMuteKeywordMutateAsyncMock = vi.fn();

vi.mock("@/hooks/use-mute-keywords", () => ({
  useMuteKeywords: () => ({
    data: [
      {
        id: "mute-1",
        keyword: "spoiler",
        scope: "title",
        created_at: "2026-04-30T00:00:00.000Z",
        updated_at: "2026-04-30T00:00:00.000Z",
      },
    ],
  }),
  useCreateMuteKeyword: () => ({
    isPending: false,
    mutateAsync: createMuteKeywordMutateAsyncMock,
  }),
  useDeleteMuteKeyword: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSetMuteAutoMarkRead: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateMuteKeyword: () => ({
    isPending: false,
    mutateAsync: updateMuteKeywordMutateAsyncMock,
  }),
}));

describe("MuteSettings", () => {
  beforeEach(() => {
    updateMuteKeywordMutateAsyncMock.mockReset();
    createMuteKeywordMutateAsyncMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not update or toast when a saved rule scope is unchanged", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Title" }));

    expect(updateMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not update or toast when the draft scope selection is unchanged", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(await screen.findByRole("option", { name: "Title and body" }));

    expect(createMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(updateMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
