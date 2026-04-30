import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ArticleTagChips } from "@/components/reader/article-tag-chips";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("ArticleTagChips", () => {
  it("separates assigned tags from available tag options", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "list_tags":
          return [
            { id: "tag-later", name: "Later", color: "#3b82f6" },
            { id: "tag-important", name: "Important", color: "#ef4444" },
          ];
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText("Later")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    const listbox = await screen.findByRole("listbox", { name: "Available tags" });
    expect(within(listbox).getByRole("option", { name: "Important" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Later" })).not.toBeInTheDocument();
  });
});
