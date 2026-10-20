import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GradientSwitch, LabeledControlRow, SettingsInfoPopover } from "@/design-system";

type CloudflareAccessControlSlotProps =
  | {
      checked: boolean;
      onChange: (checked: boolean) => void;
      trailing?: undefined;
    }
  | {
      trailing: ReactElement;
      checked?: undefined;
      onChange?: undefined;
    };

type CloudflareAccessControlProps = CloudflareAccessControlSlotProps & {
  label: string;
  description: string;
  disabled?: boolean;
  labelClassName?: string;
  mode: "add" | "detail";
  labelIndicator?: ReactNode;
};

export function CloudflareAccessControl({
  label,
  description,
  checked,
  onChange,
  trailing,
  disabled,
  labelClassName,
  mode,
  labelIndicator,
}: CloudflareAccessControlProps) {
  const { t } = useTranslation("settings");
  const popover = (
    <SettingsInfoPopover
      title={label}
      content={t(mode === "add" ? "account.cloudflare_access_add_details" : "account.cloudflare_access_details")}
      ariaLabel={t("account.cloudflare_access_info")}
    />
  );

  return (
    <LabeledControlRow
      label={label}
      description={description}
      labelClassName={labelClassName}
      labelAccessory={
        labelIndicator !== undefined ? (
          <span className="inline-flex items-center gap-1.5">
            {popover}
            {labelIndicator}
          </span>
        ) : (
          popover
        )
      }
    >
      {({ descriptionId }) =>
        trailing !== undefined ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">{trailing}</div>
        ) : (
          <div className="flex w-full items-center justify-end">
            <GradientSwitch
              checked={checked}
              onCheckedChange={(nextChecked) => onChange(nextChecked)}
              disabled={disabled}
              aria-label={label}
              aria-describedby={descriptionId}
            />
          </div>
        )
      }
    </LabeledControlRow>
  );
}
