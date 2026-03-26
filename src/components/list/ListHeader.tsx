import { IconButton } from "../IconButton";
import { toolbarStyle } from "../styles";

export function ListHeader() {
  return (
    <div style={{ ...toolbarStyle, justifyContent: "space-between" }}>
      <div style={{ fontWeight: "bold", fontSize: "var(--font-size-lg)" }}>Articles</div>
      <div style={{ display: "flex", gap: "var(--space-md)", color: "var(--text-tertiary)" }}>
        <IconButton color="inherit">✓</IconButton>
      </div>
    </div>
  );
}
