import type { CSSProperties } from "react";

/** Base style for toolbar bars (height, padding, flex, bottom border). */
export const toolbarStyle: CSSProperties = {
  height: "var(--toolbar-height)",
  padding: "0 var(--space-lg)",
  display: "flex",
  alignItems: "center",
  borderBottom: "1px solid var(--border-divider)",
};

/** Truncate single-line text with ellipsis. */
export const truncateStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
