import type { ReactElement } from "react";
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
}: CloudflareAccessControlProps) {
  const { t } = useTranslation("settings");

  return (
    <LabeledControlRow
      label={label}
      description={description}
      labelClassName={labelClassName}
      labelAccessory={
        <SettingsInfoPopover
          title={label}
          content={t(mode === "add" ? "account.cloudflare_access_add_details" : "account.cloudflare_access_details")}
          ariaLabel={t("account.cloudflare_access_info")}
        />
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
