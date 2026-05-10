import { Result } from "@praha/byethrow";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHARE_COMMAND_TEXT_MAX_CHARS } from "@/api/schemas/commands";
import type { ArticleDto } from "@/api/tauri-commands";
import { ArticleShareMenu } from "@/components/reader/article-share-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

const { addArticleToReadingListMock, copyArticleLinkMock, openExternalUrlMock, openInBrowserMock } = vi.hoisted(() => ({
  addArticleToReadingListMock: vi.fn(),
  copyArticleLinkMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  openInBrowserMock: vi.fn(),
}));

vi.mock("@/components/reader/article-browser-actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/reader/article-browser-actions")>();
  return {
    ...actual,
    addArticleToReadingList: addArticleToReadingListMock,
    copyArticleLink: copyArticleLinkMock,
  };
});

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

function truncateGraphemesForExpectation(value: string, maxGraphemes: number) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let result = "";
  let count = 0;
  for (const { segment } of segmenter.segment(value)) {
    if (count >= maxGraphemes) {
      break;
    }
    result += segment;
    count += 1;
  }
  return result;
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

  it("accepts http article URLs for mail share while still opening a mailto URL", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    openExternalUrlMock.mockResolvedValue(Result.succeed(undefined));

    renderShareMenu({
      article: {
        ...article,
        url: " http://example.com/article ",
      },
      showToast,
    });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(openExternalUrlMock).toHaveBeenCalledWith(
        "mailto:?subject=First%20Article&body=http%3A%2F%2Fexample.com%2Farticle",
      );
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not open email share when the article URL is unavailable", async () => {
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

    expect(openExternalUrlMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows the article URL policy toast before email share when the article URL contains credentials", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();

    renderShareMenu({
      article: {
        ...article,
        url: "https://user:pass@example.com/article",
      },
      showToast,
    });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    expect(openExternalUrlMock).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Article URLs must not include credentials");
  });

  it("encodes and trims long email share subject and body inputs on grapheme boundaries before opening mail", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const longTitle = `${"A".repeat(158)}e\u0301👨‍👩‍👧‍👦 extra title`;
    const urlPrefix = "https://example.com/";
    const urlPadding = "a".repeat(SHARE_COMMAND_TEXT_MAX_CHARS - urlPrefix.length - 1);
    const longUrl = `${urlPrefix}${urlPadding}👨‍👩‍👧‍👦extra`;
    const expectedSubject = truncateGraphemesForExpectation(longTitle, 160);
    const expectedBody = truncateGraphemesForExpectation(longUrl, SHARE_COMMAND_TEXT_MAX_CHARS);
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
        `mailto:?subject=${encodeURIComponent(expectedSubject)}&body=${encodeURIComponent(expectedBody)}`,
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

  it("categorizes email share command failures with the shared article action taxonomy", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    openExternalUrlMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "opener plugin not available",
      }),
    );

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Share via Email" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("opener plugin not available");
    });
    expect(console.error).toHaveBeenCalledWith(
      "Failed to open email client:",
      expect.objectContaining({
        category: "runtime_unavailable",
        localeKey: "article_actions.errors.runtime_unavailable",
      }),
    );
  });

  it("handles rejected async copy menu actions with the shared menu policy", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    copyArticleLinkMock.mockRejectedValue(new Error("clipboard plugin not available"));

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy link" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("clipboard plugin not available");
    });
    expect(console.error).toHaveBeenCalledWith(
      "Copy failed",
      expect.objectContaining({
        category: "runtime_unavailable",
        localeKey: "article_actions.errors.runtime_unavailable",
      }),
    );
  });

  it("handles rejected async reading-list menu actions with the shared menu policy", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    addArticleToReadingListMock.mockRejectedValue(new Error("permission denied"));

    renderShareMenu({ showToast });

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Reading List" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("permission denied");
    });
    expect(console.error).toHaveBeenCalledWith(
      "Add to reading list failed",
      expect.objectContaining({
        category: "permission_denied",
        localeKey: "article_actions.errors.permission_denied",
      }),
    );
  });
});
