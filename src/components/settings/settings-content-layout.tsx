import type { ReactNode } from "react";
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
  return (
    <div
      data-testid={outerTestId}
      className={cn(titleLayout === "sticky-centered" ? "px-5 pb-5 pt-0 sm:px-6 sm:pb-6 sm:pt-0" : "p-5 sm:p-6")}
    >
      <div
        data-testid={contentTestId}
        className={cn("w-full", titleLayout === "stacked-left" && "mx-auto", maxWidthClassName)}
      >
        {titleLayout === "sticky-centered" ? (
          <h2 className="sticky top-0 z-10 -mx-5 mb-4 flex min-h-16 items-center justify-center border-b border-border/70 bg-popover/95 px-5 text-center text-[19px] font-semibold tracking-[0.01em] backdrop-blur-sm sm:-mx-6 sm:mb-5 sm:px-6">
            {title}
          </h2>
        ) : (
          <header className="mb-5 sm:mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
