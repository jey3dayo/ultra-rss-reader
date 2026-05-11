import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectTauriCommandError, suppressConsoleError } from "@tests/helpers/console-spies";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import type { AppError } from "@/api/tauri-commands";
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

  it("dedupes tag picker identities and ignores blank ids at the projection boundary", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-review", name: "Review duplicate", color: "#f97316" },
          { id: "", name: "Blank assigned", color: null },
        ],
        allTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-inbox", name: "Inbox", color: null },
          { id: "tag-inbox", name: "Inbox duplicate", color: "#22c55e" },
          { id: "", name: "Blank available", color: null },
          { id: "tag-important", name: "Important", color: "#ef4444" },
        ],
      }),
    ).toEqual({
      assignedTags: [{ id: "tag-review", name: "Review", color: null }],
      availableTags: [
        { id: "tag-inbox", name: "Inbox", color: null },
        { id: "tag-important", name: "Important", color: "#ef4444" },
      ],
    });
  });

  it("drops stale assigned tags after the active tag list no longer contains them", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-deleted", name: "Deleted", color: "#f97316" },
        ],
        allTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-inbox", name: "Inbox", color: null },
        ],
      }),
    ).toEqual({
      assignedTags: [{ id: "tag-review", name: "Review", color: null }],
      availableTags: [{ id: "tag-inbox", name: "Inbox", color: null }],
    });
  });

  it("removes earlier available candidates when they are assigned later in the same projection", () => {
    expect(
      buildArticleTagPickerLists({
        articleTags: [
          { id: "tag-review", name: "Review", color: null },
          { id: "tag-later", name: "Later", color: "#3b82f6" },
        ],
        allTags: [
          { id: "tag-later", name: "Later", color: "#3b82f6" },
          { id: "tag-review", name: "Review", color: null },
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
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    const listbox = await screen.findByRole("listbox", {
      name: "Available tags",
    });
    const options = within(listbox).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Inbox", "Important"]);
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "false"]);
    expect(within(listbox).getByRole("option", { name: "Inbox" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Later" })).not.toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Review" })).not.toBeInTheDocument();
  });

  it("projects duplicate and blank tag identities once in the rendered picker", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [
            { id: "tag-review", name: "Review", color: null },
            { id: "tag-review", name: "Review duplicate", color: "#f97316" },
            { id: "", name: "Blank assigned", color: null },
          ];
        case "list_tags":
          return [
            { id: "tag-review", name: "Review", color: null },
            { id: "tag-inbox", name: "Inbox", color: null },
            { id: "tag-inbox", name: "Inbox duplicate", color: "#22c55e" },
            { id: "", name: "Blank available", color: null },
            { id: "tag-important", name: "Important", color: "#ef4444" },
          ];
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText("Review")).toBeInTheDocument();
    expect(screen.queryByText("Review duplicate")).not.toBeInTheDocument();
    expect(screen.queryByText("Blank assigned")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add tag" }));

    const listbox = await screen.findByRole("listbox", {
      name: "Available tags",
    });
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Inbox", "Important"]);
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

    expect(await screen.findByRole("heading", { name: "Tags" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add tag" }));

    const listbox = await screen.findByRole("listbox", {
      name: "Available tags",
    });
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

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    await user.type(await screen.findByRole("textbox"), "  later  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "tag_article",
        args: { articleId: "art-1", tagId: "tag-later" },
      });
    });
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Tag added. Remove the tag to reverse.",
    });
    expect(commands.some((command) => command.cmd === "create_tag")).toBe(false);
  });

  it("surfaces recovery copy after removing an article tag", async () => {
    const user = userEvent.setup();
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      switch (cmd) {
        case "get_article_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "untag_article":
          return null;
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Remove tag Later" }));

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "untag_article",
        args: { articleId: "art-1", tagId: "tag-later" },
      });
    });
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Tag removed. Add it again to reverse.",
    });
  });

  it("keeps the picker open and surfaces feedback when existing tag assignment fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Assign failed",
    };

    useUiStore.setState({ toastMessage: null });
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "tag_article":
          throw appError;
        case "create_tag":
          throw new Error("create_tag should not be called for an existing tag name");
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "later");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Available tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("later");
    expectTauriCommandError(consoleError, "tag_article", appError);
  });

  it("keeps existing tag options open when option assignment fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Assign failed",
    };

    useUiStore.setState({ toastMessage: null });
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [{ id: "tag-later", name: "Later", color: "#3b82f6" }];
        case "tag_article":
          throw appError;
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    await user.click(await screen.findByRole("option", { name: "Later" }));

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Available tags" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Later" })).toBeInTheDocument();
    expectTauriCommandError(consoleError, "tag_article", appError);
  });

  it("keeps the new tag draft open when create succeeds but assign fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const appError: AppError = {
      type: "UserVisible",
      message: "Assign failed",
    };
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
          throw appError;
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "Review");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Assign failed")).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Available tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Review");
    expect(commands).toContainEqual({
      cmd: "tag_article",
      args: { articleId: "art-1", tagId: "tag-review" },
    });
    expectTauriCommandError(consoleError, "tag_article", appError);
  });

  it.each([
    [
      "duplicate",
      { type: "UserVisible", message: "Tag already exists" } satisfies AppError,
      { type: "UserVisible", message: "Tag already exists" } satisfies AppError,
    ],
    ["network", new Error("Network unavailable"), "Network unavailable"],
    [
      "schema",
      {
        type: "Diagnostics",
        message: "Invalid tag payload",
      } satisfies AppError,
      {
        type: "Diagnostics",
        message: "Invalid tag payload",
      } satisfies AppError,
    ],
  ])("keeps the new tag draft open and surfaces feedback when create_tag fails with %s error", async (_kind, error, loggedError) => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
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
          throw error;
        case "tag_article":
          throw new Error("tag_article should not be called when create_tag fails");
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, {
      wrapper: createWrapper(),
    });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "Review");
    await user.keyboard("{Enter}");

    expect(await screen.findByText(error.message)).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Available tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Review");
    expect(commands).toContainEqual({
      cmd: "create_tag",
      args: { name: "Review", color: undefined },
    });
    expect(commands.some((command) => command.cmd === "tag_article")).toBe(false);
    expect(consoleError).toHaveBeenCalledWith("[tauri-commands] create_tag failed:", loggedError);
  });

  it("surfaces pending state and ignores duplicate create requests while create_tag is pending", async () => {
    const user = userEvent.setup();
    let resolveCreateTag: ((value: { id: string; name: string; color: null }) => void) | undefined;
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      switch (cmd) {
        case "get_article_tags":
          return [];
        case "list_tags":
          return [];
        case "create_tag":
          return new Promise((resolve) => {
            resolveCreateTag = resolve;
          });
        case "tag_article":
          return null;
        default:
          return undefined;
      }
    });

    render(<ArticleTagChips articleId="art-1" />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add tag" }));
    const input = await screen.findByRole("textbox");
    await user.type(input, "Review");
    await user.keyboard("{Enter}");

    const createButton = screen.getByRole("button", { name: "Create tag" });
    await waitFor(() => {
      expect(createButton).toBeDisabled();
      expect(createButton).toHaveAttribute("aria-busy", "true");
      expect(input).toHaveAttribute("aria-busy", "true");
    });

    await user.keyboard("{Enter}");
    await user.click(createButton);
    expect(commands.filter((command) => command.cmd === "create_tag")).toHaveLength(1);

    if (resolveCreateTag === undefined) {
      throw new Error("create_tag resolver was not captured");
    }
    resolveCreateTag({ id: "tag-review", name: "Review", color: null });

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "tag_article",
        args: { articleId: "art-1", tagId: "tag-review" },
      });
    });
  });
});
