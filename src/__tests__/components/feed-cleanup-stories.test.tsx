import { cleanup, render, screen } from "@testing-library/react";
import type { ElementType, ReactElement } from "react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import overviewMeta, {
  CleanupMode as OverviewCleanupMode,
  IntegrityMode as OverviewIntegrityMode,
} from "@/components/feed-cleanup/feed-cleanup-overview-panel.stories";
import queueMeta, { CleanupQueue, IntegrityQueue } from "@/components/feed-cleanup/feed-cleanup-queue-panel.stories";
import reviewMeta, {
  CandidateReview,
  EditingState,
  IntegrityIssueReview,
} from "@/components/feed-cleanup/feed-cleanup-review-panel.stories";

type StoryMeta = {
  component: ElementType;
  args?: object;
};

type StoryLike = {
  args?: object;
  render?: ((args: never, context: never) => ReactElement) | undefined;
};

function renderStory(meta: StoryMeta, story: StoryLike) {
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) };
  const ui = story.render ? story.render(args as never, {} as never) : createElement(meta.component, args);
  return render(ui);
}

describe("Feed cleanup stories", () => {
  it("renders overview stories for cleanup and integrity modes", () => {
    renderStory(overviewMeta, OverviewCleanupMode);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /90\+ days inactive/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete visible" })).toBeInTheDocument();

    cleanup();
    renderStory(overviewMeta, OverviewIntegrityMode);
    expect(screen.getByText("Cleanup filters are hidden while you review broken references.")).toBeInTheDocument();
  });

  it("renders queue stories for candidate and integrity review flows", () => {
    renderStory(queueMeta, CleanupQueue);
    expect(screen.getByText("Cleanup Queue")).toBeInTheDocument();
    expect(screen.getByText("Old Product Blog")).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    cleanup();
    renderStory(queueMeta, IntegrityQueue);
    expect(screen.getByText("Broken references")).toBeInTheDocument();
    expect(screen.getByText("Broken reference article")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing feed: missing-feed-42" })).toBeInTheDocument();
  });

  it("renders review stories for candidate, editing, and integrity states", () => {
    renderStory(reviewMeta, CandidateReview);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Strong cleanup candidate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Feed" })).toBeInTheDocument();

    cleanup();
    renderStory(reviewMeta, EditingState);
    expect(screen.getByText("Inline editor placeholder")).toBeInTheDocument();

    cleanup();
    renderStory(reviewMeta, IntegrityIssueReview);
    expect(screen.getByText("Needs repair")).toBeInTheDocument();
    expect(screen.getByText("Broken reference article")).toBeInTheDocument();
  });
});
