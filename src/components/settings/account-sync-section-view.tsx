import { useId } from "react";
import { SectionHeading } from "@/components/settings/settings-components";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AccountSelectOption = {
  value: string;
  label: string;
};

export type AccountSelectControl = {
  name: string;
  label: string;
  value: string;
  options: AccountSelectOption[];
  onChange: (value: string) => void;
};

export type AccountSwitchControl = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export type AccountSyncSectionViewProps = {
  heading: string;
  syncInterval: AccountSelectControl;
  syncOnWake: AccountSwitchControl;
  keepReadItems: AccountSelectControl;
  syncNowLabel?: string;
  syncingLabel?: string;
  onSyncNow?: () => void;
  isSyncing?: boolean;
};

function getOptionLabel(options: AccountSelectOption[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
}

function AccountSelectRow({ control, labelId }: { control: AccountSelectControl; labelId: string }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span id={labelId} className="text-sm text-foreground">
        {control.label}
      </span>
      <Select
        name={control.name}
        value={control.value}
        onValueChange={(value) => value !== null && control.onChange(value)}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue>{(value: string | null) => getOptionLabel(control.options, value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {control.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

export function AccountSyncSectionView({
  heading,
  syncInterval,
  syncOnWake,
  keepReadItems,
  syncNowLabel,
  syncingLabel,
  onSyncNow,
  isSyncing,
}: AccountSyncSectionViewProps) {
  const syncIntervalLabelId = useId();
  const keepReadItemsLabelId = useId();

  return (
    <section className="mb-6">
      <SectionHeading>{heading}</SectionHeading>
      <AccountSelectRow control={syncInterval} labelId={syncIntervalLabelId} />
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">{syncOnWake.label}</span>
        <GradientSwitch
          checked={syncOnWake.checked}
          onCheckedChange={(checked) => syncOnWake.onChange(checked)}
          aria-label={syncOnWake.label}
        />
      </div>
      <AccountSelectRow control={keepReadItems} labelId={keepReadItemsLabelId} />
      {onSyncNow && (
        <div className="pt-3">
          <Button size="sm" onClick={onSyncNow} disabled={isSyncing}>
            {isSyncing ? syncingLabel : syncNowLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
