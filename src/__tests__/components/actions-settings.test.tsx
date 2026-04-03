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

  it("distinguishes web preview from external browser actions", () => {
    render(<ActionsSettings />);

    expect(screen.getByText("Open Web Preview")).toBeInTheDocument();
    expect(screen.getByText("Open in External Browser")).toBeInTheDocument();
  });
});
