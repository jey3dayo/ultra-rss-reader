import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTagDialogView } from "@/components/reader/create-tag-dialog-view";

describe("CreateTagDialogView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("focuses and selects the name input after the dialog opens", () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        pendingFrames.push(callback);
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(
      <CreateTagDialogView
        open={true}
        name="Review"
        loading={false}
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Name") as HTMLInputElement;
    const selectSpy = vi.spyOn(input, "select");

    if (pendingFrames.length === 0) {
      throw new Error("expected requestAnimationFrame callback to be scheduled");
    }
    for (const scheduledFrame of pendingFrames) {
      scheduledFrame(0);
    }

    expect(input).toHaveFocus();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });
});
