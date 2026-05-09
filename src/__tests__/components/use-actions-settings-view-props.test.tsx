import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { ActionsSettingsActionRow, ActionsSettingsViewProps } from "@/components/settings/actions-settings-view";
import { useActionsSettingsViewProps as buildActionsSettingsViewProps } from "@/components/settings/hooks/use-actions-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useActionsSettingsViewProps", () => {
  it("keeps action row models as view options, not schema contracts", () => {
    expectTypeOf<ActionsSettingsViewProps>().toHaveProperty("services").toEqualTypeOf<ActionsSettingsActionRow[]>();
    expectTypeOf<ActionsSettingsActionRow>()
      .toHaveProperty("onCheckedChange")
      .toEqualTypeOf<(checked: boolean) => void>();
  });

  it("maps toolbar action preferences to service toggles", () => {
    const setPref = vi.fn();
    const props = buildActionsSettingsViewProps({
      t,
      prefs: { action_copy_link: "true" },
      setPref,
    });

    expect(props.services).toHaveLength(1);
    expect(props.services[0]).toEqual(
      expect.objectContaining({
        id: "action-copy-link",
        label: "Copy Link",
        checked: true,
      }),
    );

    props.services[0]?.onCheckedChange(false);

    expect(setPref).toHaveBeenCalledWith("action_copy_link", "false");
  });
});
