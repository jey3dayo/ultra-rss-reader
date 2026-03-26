import { useUiStore } from "../../stores/ui-store";

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
    <button
      type="button"
      onClick={() => selectSmartView(kind)}
      style={{
        padding: "var(--space-xs) var(--space-sm)",
        borderRadius: 4,
        cursor: "pointer",
        background: isSelected ? "var(--bg-selected)" : "transparent",
        color: "var(--text-secondary)",
        fontSize: "var(--font-size-md)",
        border: "none",
        width: "100%",
        textAlign: "left",
      }}
    >
      {kind === "starred" ? "★" : "●"} {label}
    </button>
  );
}
