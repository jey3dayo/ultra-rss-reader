import { IconButton } from "../IconButton";

export function ListHeader() {
  return (
    <div
      style={{
        height: "var(--toolbar-height)",
        padding: "0 var(--space-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-divider)",
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: "var(--font-size-lg)" }}>Articles</div>
      <div style={{ display: "flex", gap: "var(--space-md)", color: "var(--text-tertiary)" }}>
        <IconButton color="inherit">✓</IconButton>
      </div>
    </div>
  );
}
