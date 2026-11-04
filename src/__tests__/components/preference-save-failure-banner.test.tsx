import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { PreferenceSaveFailureBanner } from "@/components/settings/preference-save-failure-banner";

describe("PreferenceSaveFailureBanner", () => {
  it("announces the failure as an alert with its message", () => {
    render(<PreferenceSaveFailureBanner message="Couldn't save" retryLabel="Retry" onRetry={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save");
  });

  it("reports the retry through onRetry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<PreferenceSaveFailureBanner message="Couldn't save" retryLabel="Retry" onRetry={onRetry} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
