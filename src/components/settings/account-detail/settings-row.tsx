import { ChevronDownIcon } from "lucide-react";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { cn } from "@/lib/utils";

type AccountDetailSettingsRowProps =
  | {
      label: string;
      labelClassName?: string;
      valueClassName?: string;
      type: "switch";
      checked?: boolean;
    }
  | {
      label: string;
      labelClassName?: string;
      valueClassName?: string;
      type: "select";
      value?: string;
    }
  | {
      label: string;
      labelClassName?: string;
      valueClassName?: string;
      type: "text";
      value?: string;
      truncate?: boolean;
    };

export function AccountDetailSettingsRow(props: AccountDetailSettingsRowProps) {
  const valueRailClassName = "flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end";
  const valueTextClassName = "flex min-h-10 w-full items-center px-3 text-left text-sm text-foreground-soft";

  return (
    <LabeledControlRow label={props.label} labelClassName={props.labelClassName}>
      {props.type === "switch" && <GradientSwitch checked={props.checked} disabled />}
      {props.type === "select" && (
        <div className={valueRailClassName}>
          <span className={cn(valueTextClassName, "inline-flex justify-between gap-2", props.valueClassName)}>
            <span>{props.value}</span>
            <ChevronDownIcon className="size-4 opacity-50" aria-hidden="true" />
          </span>
        </div>
      )}
      {props.type === "text" && (
        <div className={valueRailClassName}>
          <span className={cn(valueTextClassName, props.valueClassName)}>
            <span className={cn("min-w-0", props.truncate && "truncate")}>{props.value}</span>
          </span>
        </div>
      )}
    </LabeledControlRow>
  );
}
