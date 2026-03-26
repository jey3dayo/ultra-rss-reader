import { useUiStore } from "../../stores/ui-store";
import { SelectableItem } from "../SelectableItem";

export function SmartViewItem({
  kind,
  label,
  isSelected,
}: {
  kind: "unread" | "starred";
  label: string;
  isSelected: boolean;
}) {
  const selectSmartView = useUiStore((s) => s.selectSmartView);
  return (
    <SelectableItem
      isSelected={isSelected}
      onClick={() => selectSmartView(kind)}
      style={{ fontSize: "var(--font-size-md)" }}
    >
      {kind === "starred" ? "★" : "●"} {label}
    </SelectableItem>
  );
}
