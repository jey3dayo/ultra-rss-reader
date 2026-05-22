import { SelectPopup, type SelectPopupProps } from "@/components/ui/select";

export function AppSelectPopup({ className, ...props }: SelectPopupProps) {
  return <SelectPopup className={className} {...props} />;
}
