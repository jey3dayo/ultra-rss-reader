import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SettingsContentLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  titleLayout?: "sticky-centered" | "stacked-left";
  maxWidthClassName?: string;
  outerTestId?: string;
  contentTestId?: string;
};

export function SettingsContentLayout({
  title,
  subtitle,
  children,
  titleLayout = "sticky-centered",
  maxWidthClassName,
  outerTestId,
  contentTestId,
}: SettingsContentLayoutProps) {
  const toneVariables = {
    "--section-heading-color": "var(--settings-shell-section-label)",
    "--form-row-label": "var(--settings-shell-field-label)",
  } as CSSProperties;

  return (
    <div
      data-testid={outerTestId}
      style={toneVariables}
      className={cn(titleLayout === "sticky-centered" ? "px-5 pb-5 pt-0 sm:px-6 sm:pb-6 sm:pt-0" : "p-5 sm:p-6")}
    >
      <div
        data-testid={contentTestId}
        className={cn("w-full", titleLayout === "stacked-left" && "mx-auto", maxWidthClassName)}
      >
        {titleLayout === "sticky-centered" ? (
          <h2
            className="sticky top-0 z-10 -mx-5 mb-5 flex min-h-[4.5rem] items-center justify-center border-b border-border/80 px-5 text-center font-sans text-[19px] font-medium tracking-[-0.02em] text-[color:var(--settings-shell-content-title)] backdrop-blur-sm sm:-mx-6 sm:mb-6 sm:px-6"
            style={{ backgroundColor: "var(--settings-shell-content-header)" }}
          >
            {title}
          </h2>
        ) : (
          <header className="mb-5 sm:mb-6">
            <h2 className="font-sans text-xl font-medium tracking-[-0.02em] text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 font-serif text-sm text-muted-foreground">{subtitle}</p> : null}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
