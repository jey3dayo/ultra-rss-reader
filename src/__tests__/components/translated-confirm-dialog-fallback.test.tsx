import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";

vi.mock("react-i18next", () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useTranslation: (namespace?: string) => ({
    t: (key: string) => {
      const common = {
        cancel: "Cancel",
        delete: "Delete",
      };
      const reader = {
        delete_tag: "Delete Tag",
        unsubscribe: "Unsubscribe",
      };
      const dictionaries: Record<string, Record<string, string>> = {
        common,
        reader,
      };

      return dictionaries[namespace ?? ""]?.[key] ?? key;
    },
  }),
}));

import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";
import { UnsubscribeDialog } from "@/components/reader/unsubscribe-feed-dialog";

const feed: FeedDto = {
  id: "feed-1",
  account_id: "account-1",
  folder_id: null,
  title: "Tech News",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 0,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
};

describe("translated destructive confirmation fallbacks", () => {
  it("renders the delete-tag fallback copy without crashing", () => {
    expect(() =>
      render(
        <DeleteTagDialogView
          open={true}
          tagName="Work"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />,
      ),
    ).not.toThrow();

    expect(
      screen.getByRole("dialog", { name: "Delete Tag" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Are you sure you want to delete Work?",
    );
  });

  it("renders the unsubscribe fallback copy without crashing", () => {
    expect(() =>
      render(
        <UnsubscribeDialog
          feed={feed}
          open={true}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />,
      ),
    ).not.toThrow();

    expect(
      screen.getByRole("dialog", { name: "Unsubscribe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Are you sure you want to unsubscribe from Tech News?",
    );
  });
});
