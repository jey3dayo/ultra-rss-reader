export function UnreadCounter() {
  return (
    <div
      style={{
        padding: "var(--space-sm) var(--space-lg)",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "var(--font-size-md)",
        fontWeight: "bold",
      }}
    >
      <span>Unread</span>
      <span style={{ color: "var(--text-tertiary)" }}>0</span>
    </div>
  );
}
