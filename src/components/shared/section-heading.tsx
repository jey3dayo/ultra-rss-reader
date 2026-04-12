import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>;
}
