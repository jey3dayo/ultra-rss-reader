import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ActionsSettings } from "@/components/settings/actions-settings";
import i18n from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferences-store";

describe("ActionsSettings", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("only presents Copy Link as a configurable toolbar share action", () => {
    render(<ActionsSettings />);

    const copyLinkLabel = screen.getByText("Copy Link");

    expect(screen.queryByText("Open Web Preview")).not.toBeInTheDocument();
    expect(copyLinkLabel).toBeInTheDocument();
    expect(copyLinkLabel).toHaveClass("text-[color:var(--form-row-label)]");
    expect(copyLinkLabel.closest(".grid")).toHaveClass("lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)]");
    expect(screen.getByRole("switch", { name: "Show in toolbar: Copy Link" })).toBeInTheDocument();
    expect(screen.queryByText("Open in External Browser")).not.toBeInTheDocument();
    expect(screen.queryByText("Share Menu")).not.toBeInTheDocument();
  });
});
