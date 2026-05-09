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

  it("cleans up the pending autofocus frame when the dialog closes", () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        scheduledFrames.push(callback);
        return 5;
      }),
    );
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const { rerender } = render(
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
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

    rerender(
      <CreateTagDialogView
        open={false}
        name="Review"
        loading={false}
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    const scheduledFrame = scheduledFrames[0];
    if (!scheduledFrame) {
      throw new Error("expected requestAnimationFrame callback to be scheduled");
    }
    scheduledFrame(0);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
  });
});
