import { Copy, ExternalLink, Globe } from "lucide-react";
import { SectionHeading } from "@/components/settings/settings-components";
import { Switch } from "@/components/ui/switch";
import { usePreferencesStore } from "@/stores/preferences-store";

interface ServiceEntry {
  label: string;
  prefKey: string;
  icon: React.ReactNode;
}

const serviceEntries: ServiceEntry[] = [
  { label: "Copy Link", prefKey: "action_copy_link", icon: <Copy className="h-5 w-5" /> },
  { label: "Open in Browser", prefKey: "action_open_browser", icon: <Globe className="h-5 w-5" /> },
  { label: "Share", prefKey: "action_share", icon: <ExternalLink className="h-5 w-5" /> },
];

function ServiceSwitch({ prefKey }: { prefKey: string }) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]);
  const setPref = usePreferencesStore((s) => s.setPref);
  const checked = value === "true";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Show in toolbar</span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => setPref(prefKey, String(v))}
        className="data-[state=checked]:bg-accent"
      />
    </div>
  );
}

export function ActionsSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Actions and Sharing</h2>

      <section>
        <SectionHeading>Services</SectionHeading>
        {serviceEntries.map((svc) => (
          <div key={svc.prefKey} className="flex min-h-[56px] items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {svc.icon}
            </span>
            <span className="flex-1 text-sm text-foreground">{svc.label}</span>
            <ServiceSwitch prefKey={svc.prefKey} />
          </div>
        ))}
      </section>
    </div>
  );
}
