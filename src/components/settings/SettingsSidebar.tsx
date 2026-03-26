import type { CSSProperties } from "react";
import { useUiStore } from "../../stores/ui-store";

type Category = "general" | "accounts";

const categories: { id: Category; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "\u2699" },
  { id: "accounts", label: "Accounts", icon: "\uD83D\uDC64" },
];

export function SettingsSidebar() {
  const { settingsCategory, setSettingsCategory } = useUiStore();

  return (
    <div
      style={{
        width: 160,
        borderRight: "1px solid var(--border-subtle)",
        padding: "var(--space-md) 0",
        flexShrink: 0,
      }}
    >
      {categories.map((cat) => {
        const isActive = settingsCategory === cat.id;
        const itemStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          width: "100%",
          padding: "var(--space-sm) var(--space-lg)",
          background: isActive ? "var(--bg-selected)" : "transparent",
          border: "none",
          borderRadius: 6,
          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
          fontSize: "var(--font-size-md)",
          cursor: "pointer",
          textAlign: "left",
        };

        return (
          <button type="button" key={cat.id} onClick={() => setSettingsCategory(cat.id)} style={itemStyle}>
            <span style={{ fontSize: "var(--font-size-lg)" }}>{cat.icon}</span>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
