import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleContextMenu } from "@/components/reader/article-context-menu";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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
});
