import { Result } from "@praha/byethrow";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { ArticleShareMenu } from "@/components/reader/article-share-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

const { addArticleToReadingListMock, copyArticleLinkMock, openExternalUrlMock, openInBrowserMock } = vi.hoisted(() => ({
  addArticleToReadingListMock: vi.fn(),
  copyArticleLinkMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  openInBrowserMock: vi.fn(),
}));

vi.mock("@/components/reader/article-browser-actions", () => ({
  addArticleToReadingList: addArticleToReadingListMock,
  copyArticleLink: copyArticleLinkMock,
}));

vi.mock("@/api/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/tauri-commands")>();
  return {
    ...actual,
    openExternalUrl: openExternalUrlMock,
    openInBrowser: openInBrowserMock,
  };
});

const article = {
  id: "art-1",
  feed_id: "feed-1",
  title: "First Article",
  content_sanitized: "<p>Hello world</p>",
  summary: "A hello world article",
  url: "https://example.com/article",
  author: "Alice",
  published_at: "2026-03-25T10:00:00Z",
  thumbnail: null,
  is_read: false,
  is_starred: false,
} satisfies ArticleDto;

const labels = {
  share: "Share",
  copyLink: "Copy link",
  addToReadingList: "Add to Reading List",
  addedToReadingList: "Added to Reading List",
  shareViaEmail: "Share via Email",
  linkCopied: "Link copied",
};

function renderShareMenu(props: Partial<ComponentProps<typeof ArticleShareMenu>> = {}) {
  return render(
    <TooltipProvider>
      <ArticleShareMenu article={article} supportsReadingList showToast={vi.fn()} labels={labels} {...props} />
    </TooltipProvider>,
  );
}

describe("ArticleShareMenu", () => {
  beforeEach(() => {
    addArticleToReadingListMock.mockReset();
    copyArticleLinkMock.mockReset();
    openExternalUrlMock.mockReset();
    openInBrowserMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("routes copy through the frontend clipboard fallback action", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    copyArticleLinkMock.mockResolvedValue(undefined);

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));

    await waitFor(() => {
      expect(copyArticleLinkMock).toHaveBeenCalledWith("https://example.com/article", {
        showToast,
        successMessage: "Link copied",
      });
    });
    expect(openInBrowserMock).not.toHaveBeenCalled();
  });

  it("routes email share through the external URL command without using the http-only browser command", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    openExternalUrlMock.mockResolvedValue(Result.succeed(undefined));

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(openExternalUrlMock).toHaveBeenCalledWith(
        "mailto:?subject=First%20Article&body=https%3A%2F%2Fexample.com%2Farticle",
      );
    });
    expect(openInBrowserMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(copyArticleLinkMock).not.toHaveBeenCalled();
  });

  it("uses fallback subject and body values for blank email share inputs", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    openExternalUrlMock.mockResolvedValue(Result.succeed(undefined));

    renderShareMenu({
      article: {
        ...article,
        title: "   ",
        url: "   ",
      },
      showToast,
    });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(openExternalUrlMock).toHaveBeenCalledWith(
        "mailto:?subject=Untitled%20article&body=Article%20URL%20unavailable",
      );
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("encodes and trims long email share subject and body inputs before opening mail", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const longTitle = `${"A".repeat(170)} with extra title`;
    const longUrl = `https://example.com/${"path/".repeat(500)}`;
    openExternalUrlMock.mockResolvedValue(Result.succeed(undefined));

    renderShareMenu({
      article: {
        ...article,
        title: longTitle,
        url: longUrl,
      },
      showToast,
    });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(openExternalUrlMock).toHaveBeenCalledWith(
        `mailto:?subject=${encodeURIComponent(longTitle.slice(0, 160))}&body=${encodeURIComponent(longUrl.slice(0, 2_000))}`,
      );
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("keeps share actions unavailable when the article has an empty URL", () => {
    const showToast = vi.fn();

    renderShareMenu({
      article: {
        ...article,
        url: "",
      },
      showToast,
    });

    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(openExternalUrlMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("preserves the email share command error toast", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    openExternalUrlMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Mail client unavailable",
      }),
    );

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Mail client unavailable");
    });
    expect(openInBrowserMock).not.toHaveBeenCalled();
    expect(copyArticleLinkMock).not.toHaveBeenCalled();
  });
});
