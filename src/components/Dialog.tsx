import type { CSSProperties, ReactNode } from "react";

/* ── Overlay + Panel ── */

export function Dialog({
  open,
  onClose,
  title,
  width = 400,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={handleOverlayClick}
      onKeyDown={undefined}
    >
      <div
        style={{
          background: "var(--bg-sidebar)",
          borderRadius: 12,
          padding: "var(--space-xl)",
          width,
          maxWidth: "90vw",
        }}
      >
        <h2 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-lg)" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ── FormField (label + input/select) ── */

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-md)" }}>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: children contains the input/select control */}
      <label
        style={{
          fontSize: "var(--font-size-md)",
          color: "var(--text-tertiary)",
          display: "block",
          marginBottom: "var(--space-xs)",
        }}
      >
        {label}
        {children}
      </label>
    </div>
  );
}

/* ── Input / Select shared style ── */

export const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "var(--space-sm)",
  background: "var(--bg-content)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: "var(--font-size-lg)",
};

/* ── DialogActions (button row) ── */

export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "var(--space-sm)",
        marginTop: "var(--space-lg)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Button ── */

type ButtonVariant = "default" | "primary";

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  default: {
    background: "none",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-secondary)",
  },
  primary: {
    background: "var(--accent-blue)",
    border: "none",
    color: "#000",
    fontWeight: "bold",
  },
};

export function Button({
  children,
  onClick,
  variant = "default",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "var(--space-sm) var(--space-lg)",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: "var(--font-size-md)",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
