import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";

export function SettingsSwitch({ label, prefKey }: { label: string; prefKey: string }) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]);
  const setPref = usePreferencesStore((s) => s.setPref);
  const checked = value === "true";
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => setPref(prefKey, String(v))}
        className="data-[state=checked]:bg-ring"
      />
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

export function SettingsSelect({
  label,
  prefKey,
  options,
}: {
  label: string;
  prefKey: string;
  options: SelectOption[];
}) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]) ?? "";
  const setPref = usePreferencesStore((s) => s.setPref);
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Select name={prefKey} value={value} onValueChange={(v) => v !== null && setPref(prefKey, v)}>
        <SelectTrigger className="min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

/** Read-only display row for account detail settings. Switch is intentionally
 *  disabled — these values are synced from the backend and not user-editable here.
 *  Use SettingsSwitch/SettingsSelect for interactive preference rows. */
export type SettingsRowProps =
  | { label: string; type: "switch"; checked?: boolean }
  | { label: string; type: "select"; value?: string }
  | { label: string; type: "text"; value?: string; truncate?: boolean };

export function SettingsRow(props: SettingsRowProps) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{props.label}</span>
      {props.type === "switch" && <Switch checked={props.checked} disabled className="data-[state=checked]:bg-ring" />}
      {props.type === "select" && <span className="text-sm text-muted-foreground">{props.value} &#9662;</span>}
      {props.type === "text" && (
        <span className={cn("text-sm text-muted-foreground", props.truncate && "max-w-[200px] truncate")}>
          {props.value}
        </span>
      )}
    </div>
  );
}
