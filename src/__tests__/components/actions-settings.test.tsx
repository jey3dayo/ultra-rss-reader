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
    expect(copyLinkLabel).toHaveClass("min-w-0", "flex-1");
    expect(copyLinkLabel.nextElementSibling).toHaveClass("shrink-0");
    expect(screen.queryByText("Open in External Browser")).not.toBeInTheDocument();
    expect(screen.queryByText("Share Menu")).not.toBeInTheDocument();
  });
});
