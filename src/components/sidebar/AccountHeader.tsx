export function AccountHeader() {
  return (
    <div
      style={{
        padding: "var(--space-lg) var(--space-lg) var(--space-sm)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold" }}>Ultra RSS</div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>Today</div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          ↻
        </button>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
