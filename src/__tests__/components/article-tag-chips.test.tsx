import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import {
  ArticleTagChips,
  buildArticleTagPickerLists,
  findArticleTagByName,
} from "@/components/reader/article-tag-chips";

describe("ArticleTagChips", () => {
  it("builds assigned and available tag picker lists", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: [{ id: "tag-later", name: "Later", color: "#3b82f6" }],
        allTags: [
          { id: "tag-later", name: "Later", color: "#3b82f6" },
          { id: "tag-important", name: "Important", color: "#ef4444" },
        ],
      }),
    ).toEqual({
      assignedTags: [{ id: "tag-later", name: "Later", color: "#3b82f6" }],
      availableTags: [
        { id: "tag-important", name: "Important", color: "#ef4444" },
      ],
    });
  });

  it("builds empty picker lists before tag queries resolve", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: undefined,
        allTags: undefined,
      }),
    ).toEqual({
      assignedTags: [],
      availableTags: [],
    });
  });

  it("finds existing tags by trimmed case-insensitive name", () => {
    const tags = [
      { id: "tag-later", name: "Later", color: "#3b82f6" },
      { id: "tag-important", name: "Important", color: "#ef4444" },
    ];

    expect(findArticleTagByName(tags, "  later  ")?.id).toBe("tag-later");
    expect(findArticleTagByName(tags, "IMPORTANT")?.id).toBe("tag-important");
    expect(findArticleTagByName(tags, "unknown")).toBeNull();
  });

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

    const listbox = await screen.findByRole("listbox", {
      name: "Available tags",
    });
    expect(
      within(listbox).getByRole("option", { name: "Important" }),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: "Later" }),
    ).not.toBeInTheDocument();
  });

  it("assigns an existing tag instead of creating a duplicate when the typed name differs only by case and trim", async () => {
    const user = userEvent.setup();
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "tag_article":
          return null;
        case "create_tag":
          throw new Error(
            "create_tag should not be called for an existing tag name",
          );
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    await user.type(await screen.findByRole("textbox"), "  later  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "tag_article",
        args: { articleId: "art-1", tagId: "tag-later" },
      });
    });
    expect(commands.some((command) => command.cmd === "create_tag")).toBe(
      false,
    );
  });
});
