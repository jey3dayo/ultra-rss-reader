import { screen, within } from "@testing-library/react";
import { renderStory } from "@tests/helpers/render-story";
import { describe, expect, it } from "vitest";
import browserOverlayStageMeta, {
  Loaded,
  Loading,
  RetryableIssue,
  RuntimeUnavailableIssue,
} from "@/components/reader/browser-overlay-stage.stories";

describe("BrowserOverlayStage stories", () => {
  it("renders the loading story with the main chrome action and loading state", () => {
    renderStory(browserOverlayStageMeta, Loading);

    expect(screen.getByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Web back" })).toBeInTheDocument();
    expect(screen.getByTestId("browser-loading-state")).toBeInTheDocument();
    expect(screen.queryByTestId("browser-surface-state")).not.toBeInTheDocument();
  });

  it("renders the loaded story without loading or issue state", () => {
    renderStory(browserOverlayStageMeta, Loaded);

    expect(screen.getByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Web back" })).toBeInTheDocument();
    expect(screen.queryByTestId("browser-loading-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("browser-surface-state")).not.toBeInTheDocument();
  });

  it("renders the retryable issue story with recovery actions and technical detail", () => {
    renderStory(browserOverlayStageMeta, RetryableIssue);

    const stateCard = within(screen.getByTestId("browser-surface-state"));

    expect(screen.getByText("Web Preview could not load.")).toBeInTheDocument();
    expect(screen.getByText("Technical detail")).toBeInTheDocument();
    expect(stateCard.getByRole("button", { name: "Retry Web Preview" })).toBeInTheDocument();
    expect(stateCard.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
  });

  it("renders the runtime unavailable issue story with external action only", () => {
    renderStory(browserOverlayStageMeta, RuntimeUnavailableIssue);

    const stateCard = within(screen.getByTestId("browser-surface-state"));

    expect(screen.getByText("Embedded Web Preview is unavailable in this runtime.")).toBeInTheDocument();
    expect(screen.queryByText("Technical detail")).not.toBeInTheDocument();
    expect(stateCard.queryByRole("button", { name: "Retry Web Preview" })).not.toBeInTheDocument();
    expect(stateCard.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
  });
});
