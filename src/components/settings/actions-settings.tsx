import { Copy, ExternalLink, Globe, Share } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "@/components/settings/settings-components";
import { Switch } from "@/components/ui/switch";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

function ServiceSwitch({ prefKey, showLabel }: { prefKey: string; showLabel: string }) {
  const checked = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, prefKey) === "true");
  const setPref = usePreferencesStore((s) => s.setPref);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{showLabel}</span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => setPref(prefKey, String(v))}
        className="data-checked:bg-ring"
      />
    </div>
  );
}

export function ActionsSettings() {
  const { t } = useTranslation("settings");

  const serviceEntries = [
    { label: t("actions.copy_link"), prefKey: "action_copy_link", icon: <Copy className="h-5 w-5" /> },
    { label: t("actions.open_in_browser"), prefKey: "action_open_browser", icon: <Globe className="h-5 w-5" /> },
    {
      label: t("actions.open_in_external_browser"),
      prefKey: "action_share",
      icon: <ExternalLink className="h-5 w-5" />,
    },
    {
      label: t("actions.share_menu"),
      prefKey: "action_share_menu",
      icon: <Share className="h-5 w-5" />,
    },
  ];

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("actions.heading")}</h2>

      <section>
        <SectionHeading>{t("actions.services")}</SectionHeading>
        {serviceEntries.map((svc) => (
          <div key={svc.prefKey} className="flex min-h-[56px] items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {svc.icon}
            </span>
            <span className="flex-1 text-sm text-foreground">{svc.label}</span>
            <ServiceSwitch prefKey={svc.prefKey} showLabel={t("actions.show_in_toolbar")} />
          </div>
        ))}
      </section>
    </div>
  );
}
