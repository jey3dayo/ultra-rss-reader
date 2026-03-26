import type { CSSProperties, ReactNode } from "react";

export function SelectableItem({
  isSelected,
  onClick,
  children,
  style,
}: {
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "var(--space-xs) var(--space-sm)",
        borderRadius: 4,
        cursor: "pointer",
        border: "none",
        display: "flex",
        width: "100%",
        textAlign: "left",
        background: isSelected ? "var(--bg-selected)" : "transparent",
        color: "var(--text-secondary)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
