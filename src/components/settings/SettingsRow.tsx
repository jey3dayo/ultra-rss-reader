import type { ReactNode } from "react";

export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border-divider)",
      }}
    >
      <span style={{ fontSize: "var(--font-size-md)", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "var(--font-size-md)", color: "var(--text-muted)" }}>{children}</span>
    </div>
  );
}
