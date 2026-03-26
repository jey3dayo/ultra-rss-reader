import { useUiStore } from "../../stores/ui-store";

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
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          style={{
            background: viewMode === mode ? "var(--bg-selected)" : "none",
            border: "none",
            borderRadius: 12,
            padding: "2px 10px",
            color: viewMode === mode ? "var(--text-primary)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "var(--font-size-xs)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
