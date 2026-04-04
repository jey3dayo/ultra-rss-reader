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

  it("does not present Open Web Preview as a toolbar action setting", () => {
    render(<ActionsSettings />);

    expect(screen.queryByText("Open Web Preview")).not.toBeInTheDocument();
    expect(screen.getByText("Open in External Browser")).toBeInTheDocument();
  });
});
