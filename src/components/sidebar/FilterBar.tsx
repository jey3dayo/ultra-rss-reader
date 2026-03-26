import { useUiStore } from "../../stores/ui-store";
import { IconButton } from "../IconButton";

export function FilterBar() {
  const { viewMode, setViewMode } = useUiStore();
  const items: Array<{ mode: "all" | "unread" | "starred"; label: string }> = [
    { mode: "starred", label: "★" },
    { mode: "unread", label: "● UNREAD" },
    { mode: "all", label: "≡" },
  ];
  return (
    <div
      style={{
        height: "var(--filterbar-height)",
        borderTop: "1px solid var(--border-divider)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-lg)",
      }}
    >
      {items.map(({ mode, label }) => (
        <IconButton
          key={mode}
          onClick={() => setViewMode(mode)}
          size="sm"
          active={viewMode === mode}
        >
          {label}
        </IconButton>
      ))}
    </div>
  );
}
