export function EmptyState() {
  return (
    <div
      style={{
        background: "var(--bg-content)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: "var(--space-lg)" }}>RSS</div>
      <div style={{ fontSize: "var(--font-size-lg)" }}>Select an article to read</div>
    </div>
  );
}
