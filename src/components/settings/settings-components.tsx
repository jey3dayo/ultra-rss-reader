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
        className="data-[state=checked]:bg-accent"
      />
    </div>
  );
}

export interface SelectOption {
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
      <select
        value={value}
        onChange={(e) => setPref(prefKey, e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

export interface SettingsRowProps {
  label: string;
  value?: string;
  type: "switch" | "select" | "text";
  checked?: boolean;
  truncate?: boolean;
}

export function SettingsRow({ label, value, type, checked, truncate }: SettingsRowProps) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      {type === "switch" && <Switch checked={checked} disabled className="data-[state=checked]:bg-accent" />}
      {type === "select" && <span className="text-sm text-muted-foreground">{value} &#9662;</span>}
      {type === "text" && (
        <span className={cn("text-sm text-muted-foreground", truncate && "max-w-[200px] truncate")}>{value}</span>
      )}
    </div>
  );
}
