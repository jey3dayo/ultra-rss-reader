import type { CSSProperties, ReactNode } from "react";

type IconButtonSize = "sm" | "md";

const sizeMap: Record<IconButtonSize, string> = {
  sm: "var(--icon-size-sm)",
  md: "var(--icon-size-md)",
};

export function IconButton({
  children,
  onClick,
  title,
  color = "var(--text-tertiary)",
  size = "md",
  active,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  color?: string;
  size?: IconButtonSize;
  active?: boolean;
  style?: CSSProperties;
}) {
  const activeStyle: CSSProperties | undefined = active !== undefined
    ? {
        background: active ? "var(--bg-selected)" : "none",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
        borderRadius: 12,
        padding: "2px 10px",
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: sizeMap[size],
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        color,
        ...activeStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
