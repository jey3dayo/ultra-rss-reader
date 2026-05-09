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
import { useUiStore } from "@/stores/ui-store";

describe("ArticleTagChips", () => {
  it("builds assigned and available tag picker lists without changing tag order", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-later", name: "Later", color: "#3b82f6" },
        ],
        allTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-later", name: "Later", color: "#3b82f6" },
          { id: "tag-inbox", name: "Inbox", color: null },
          { id: "tag-important", name: "Important", color: "#ef4444" },
        ],
      }),
    ).toEqual({
      assignedTags: [
        { id: "tag-review", name: "Review", color: null },
        { id: "tag-later", name: "Later", color: "#3b82f6" },
      ],
      availableTags: [
        { id: "tag-inbox", name: "Inbox", color: null },
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

  it("separates assigned tags from available tag options while preserving chip order and option state", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [
            { id: "tag-review", name: "Review", color: null },
            { id: "tag-later", name: "Later", color: "#3b82f6" },
          ];
        case "list_tags":
          return [
            { id: "tag-review", name: "Review", color: null },
            { id: "tag-later", name: "Later", color: "#3b82f6" },
            { id: "tag-inbox", name: "Inbox", color: null },
            { id: "tag-important", name: "Important", color: "#ef4444" },
          ];
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Review").compareDocumentPosition(screen.getByText("Later"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await user.click(screen.getByRole("button", { name: "add_tag" }));

    const listbox = await screen.findByRole("listbox", {
      name: "available_tags",
    });
    const options = within(listbox).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Inbox", "Important"]);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "false"]);
    expect(within(listbox).getByRole("option", { name: "Inbox" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Later" })).not.toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Review" })).not.toBeInTheDocument();
  });

  it("shows the empty tag state when both picker lists are empty", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [];
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "tags_section_title" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "add_tag" }));

    const listbox = await screen.findByRole("listbox", { name: "available_tags" });
    expect(within(listbox).queryAllByRole("option")).toEqual([]);
    expect(screen.getByRole("textbox")).toHaveValue("");
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
          throw new Error("create_tag should not be called for an existing tag name");
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "add_tag" }));
    await user.type(await screen.findByRole("textbox"), "  later  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "tag_article",
        args: { articleId: "art-1", tagId: "tag-later" },
      });
    });
    expect(commands.some((command) => command.cmd === "create_tag")).toBe(false);
  });

  it("keeps the picker open and surfaces feedback when existing tag assignment fails", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ toastMessage: null });
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "tag_article":
          throw { type: "UserVisible", message: "Assign failed" };
        case "create_tag":
          throw new Error("create_tag should not be called for an existing tag name");
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "add_tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "later");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "available_tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("later");
  });

  it("keeps existing tag options open when option assignment fails", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ toastMessage: null });
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "tag_article":
          throw { type: "UserVisible", message: "Assign failed" };
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "add_tag" }));
    await user.click(await screen.findByRole("option", { name: "Later" }));

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "available_tags" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Later" })).toBeInTheDocument();
  });

  it("keeps the new tag draft open when create succeeds but assign fails", async () => {
    const user = userEvent.setup();
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    useUiStore.setState({ toastMessage: null });
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [];
        case "create_tag":
          return { id: "tag-review", name: "Review", color: null };
        case "tag_article":
          throw { type: "UserVisible", message: "Assign failed" };
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "add_tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "Review");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "available_tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Review");
    expect(commands).toContainEqual({
      cmd: "tag_article",
      args: { articleId: "art-1", tagId: "tag-review" },
    });
  });
});
