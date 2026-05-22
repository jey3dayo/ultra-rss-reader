import { SelectPopup, type SelectPopupProps } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";

export function AppSelectPopup({ className, ...props }: SelectPopupProps) {
  return <SelectPopup className={cn(APP_STACKING_CLASS_NAMES.popup, className)} {...props} />;
}
