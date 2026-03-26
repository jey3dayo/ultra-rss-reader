import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-lg)" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          padding: "0 16px",
          marginBottom: "var(--space-sm)",
          marginTop: "var(--space-xl)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          background: "var(--bg-hover)",
          borderRadius: 8,
          overflow: "hidden",
          margin: "0 16px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
