import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { ActionsSettingsViewProps } from "@/components/settings/actions-settings-view";
import {
  ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS,
  buildActionsSettingsViewModel,
  TOOLBAR_ACTION_IDS_WITH_SETTINGS,
} from "@/components/settings/lib/actions-settings-view-model";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useActionsSettingsViewProps", () => {
  it("keeps action row models as view options, not schema contracts", () => {
    expectTypeOf<ActionsSettingsViewProps["services"][number]>()
      .toHaveProperty("onCheckedChange")
      .toEqualTypeOf<(checked: boolean) => void>();
  });

  it("maps toolbar action preferences to service toggles", () => {
    const setPref = vi.fn();
    const props = buildActionsSettingsViewModel({
      t,
      prefs: { action_copy_link: "true" },
      setPref,
    });

    expect(props.services).toHaveLength(1);
    expect(props.services[0]).toEqual(
      expect.objectContaining({
        id: "action-copy-link",
        label: "Copy Link",
        toggleAriaLabel: "Show in toolbar: Copy Link",
        checked: true,
      }),
    );

    props.services[0]?.onCheckedChange(false);

    expect(setPref).toHaveBeenCalledWith("action_copy_link", "false");
  });

  it("keeps settings-visible actions aligned with toolbar visibility actions", () => {
    expect(ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS).toEqual(["copy-link"]);
    expect(TOOLBAR_ACTION_IDS_WITH_SETTINGS).toEqual(ACTIONS_SETTINGS_TOOLBAR_ACTION_IDS);
  });
});
