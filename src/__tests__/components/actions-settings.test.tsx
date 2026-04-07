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

    expect(screen.queryByText("Open Web Preview")).not.toBeInTheDocument();
    expect(screen.getByText("Copy Link")).toBeInTheDocument();
    expect(screen.queryByText("Open in External Browser")).not.toBeInTheDocument();
    expect(screen.queryByText("Share Menu")).not.toBeInTheDocument();
  });
});
