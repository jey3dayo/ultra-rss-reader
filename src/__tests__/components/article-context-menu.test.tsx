import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleContextMenu } from "@/components/reader/article-context-menu";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { type MockTauriCommandCall, sampleArticles, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("ArticleContextMenu", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("uses preview wording for the in-app browser action", async () => {
    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));

    expect(await screen.findByRole("menuitem", { name: "Open Web Preview" })).toBeInTheDocument();
  });

  it("reuses article actions when opening the browser from the context menu", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    render(
      <ArticleContextMenu article={sampleArticles[0]}>
        <button type="button">Article row</button>
      </ArticleContextMenu>,
      { wrapper: createWrapper() },
    );

    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Article row" }));
    await user.click(await screen.findByRole("menuitem", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: sampleArticles[0]?.url, background: false },
      });
    });
  });
});
