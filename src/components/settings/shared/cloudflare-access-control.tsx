import { Info } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { GradientSwitch, LabeledControlRow, Popover, SurfaceCard } from "@/design-system";
import { cn } from "@/lib/utils";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";
import { SettingsActionButton } from "./settings-action-button";

type CloudflareAccessControlProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelClassName?: string;
  mode: "add" | "detail";
};

export function CloudflareAccessControl({
  label,
  description,
  checked,
  onChange,
  disabled,
  labelClassName,
  mode,
}: CloudflareAccessControlProps) {
  const { t } = useTranslation("settings");
  const popupId = useId();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <Popover.Root open={expanded} onOpenChange={setExpanded}>
      <div>
        <LabeledControlRow label={label} description={description} labelClassName={labelClassName}>
          {({ descriptionId }) => (
            <div className="flex items-center gap-2">
              <GradientSwitch
                checked={checked}
                onCheckedChange={(checked) => onChange(checked)}
                disabled={disabled}
                aria-label={label}
                aria-describedby={descriptionId}
              />
              <Popover.Trigger
                aria-controls={expanded ? popupId : undefined}
                aria-describedby={expanded ? detailsId : undefined}
                render={
                  <SettingsActionButton
                    type="button"
                    tone="subtle"
                    size="icon"
                    aria-label={t("account.cloudflare_access_info")}
                  />
                }
              >
                <Info aria-hidden="true" />
              </Popover.Trigger>
            </div>
          )}
        </LabeledControlRow>
      </div>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          positionMethod="fixed"
          collisionAvoidance={{ side: "flip", align: "shift" }}
          sideOffset={8}
          collisionPadding={16}
          className={APP_STACKING_CLASS_NAMES.popup}
        >
          <Popover.Popup
            id={popupId}
            initialFocus={false}
            className={cn(MOTION_POPUP_SURFACE_CLASS_NAME, "w-80 max-w-[calc(100vw-2rem)] outline-none")}
          >
            <SurfaceCard variant="info" tone="subtle" padding="default" className="shadow-elevation-2">
              <Popover.Title className="sr-only">{label}</Popover.Title>
              <Popover.Description id={detailsId} className="text-sm leading-[1.5] text-foreground-soft">
                {t(mode === "add" ? "account.cloudflare_access_add_details" : "account.cloudflare_access_details")}
              </Popover.Description>
            </SurfaceCard>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
