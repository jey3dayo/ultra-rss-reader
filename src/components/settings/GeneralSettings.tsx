export function GeneralSettings() {
  return (
    <div style={{ padding: "var(--space-xl)" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--space-md)",
        }}
      >
        General
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "var(--space-sm) 0",
          fontSize: "var(--font-size-md)",
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>Version</span>
        <span style={{ color: "var(--text-secondary)" }}>0.1.0</span>
      </div>
    </div>
  );
}
