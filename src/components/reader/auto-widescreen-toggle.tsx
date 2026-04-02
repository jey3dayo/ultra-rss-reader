import { Expand } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconToolbarToggle } from "@/components/shared/icon-toolbar-control";

export function AutoWidescreenToggle({
  pressed,
  disabled = false,
  onPressedChange,
}: {
  pressed: boolean;
  disabled?: boolean;
  onPressedChange: (nextPressed: boolean) => void;
}) {
  const { t } = useTranslation("reader");

  return (
    <IconToolbarToggle
      label={t("auto_widescreen")}
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      pressedTone="accent"
    >
      <Expand className="h-4 w-4" />
    </IconToolbarToggle>
  );
}
