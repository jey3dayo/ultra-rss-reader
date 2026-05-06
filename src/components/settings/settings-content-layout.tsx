import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { useScrollOverflowState } from "@/components/settings/use-scroll-overflow-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const HIDDEN_SCROLLBAR_CLASS = "[&>[data-slot='scroll-area-scrollbar']]:hidden";

type SettingsContentLayoutProps = {
  title: string;
  subtitle?: string;
  headerSummary?: ReactNode;
  children: ReactNode;
  titleLayout?: "sticky-centered" | "stacked-left";
  maxWidthClassName?: string;
  outerTestId?: string;
  contentTestId?: string;
  scrollBehavior?: "auto" | "always" | "never";
};

const SettingsContentScrollBehaviorContext = createContext<SettingsContentLayoutProps["scrollBehavior"]>("auto");

export function SettingsContentScrollBehaviorProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SettingsContentLayoutProps["scrollBehavior"];
}) {
  return (
    <SettingsContentScrollBehaviorContext.Provider value={value}>
      {children}
    </SettingsContentScrollBehaviorContext.Provider>
  );
}

export function SettingsContentLayout({
  title,
  subtitle,
  headerSummary,
  children,
  titleLayout = "sticky-centered",
  maxWidthClassName,
  outerTestId,
  contentTestId,
  scrollBehavior,
}: SettingsContentLayoutProps) {
  const inheritedScrollBehavior = useContext(SettingsContentScrollBehaviorContext);
  const resolvedScrollBehavior = scrollBehavior ?? inheritedScrollBehavior;
  const contentOverflow = useScrollOverflowState(children);
  const contentHasOverflow =
    resolvedScrollBehavior === "always"
      ? true
      : resolvedScrollBehavior === "never"
        ? false
        : contentOverflow.hasOverflow;
  const toneVariables = {
    "--section-heading-color": "var(--settings-shell-section-label)",
    "--form-row-label": "var(--settings-shell-field-label)",
  } as CSSProperties;
  const headerContentClassName = cn("w-full", titleLayout === "stacked-left" && "mx-auto", maxWidthClassName);
  const bodyContentClassName = cn(
    "w-full",
    titleLayout === "sticky-centered" ? "px-5 py-5 sm:px-6 sm:py-6" : "p-5 sm:p-6",
    titleLayout === "stacked-left" && "mx-auto",
    maxWidthClassName,
  );

  return (
    <div data-testid={outerTestId} style={toneVariables} className="flex h-full min-h-0 flex-col">
      {titleLayout === "sticky-centered" ? (
        <header
          data-testid="settings-content-header"
          className="flex min-h-[4.5rem] shrink-0 items-center justify-center border-b border-border/80 px-5 text-center backdrop-blur-sm sm:px-6"
          style={{ backgroundColor: "var(--settings-shell-content-header)" }}
        >
          <h2
            data-testid="settings-content-title"
            className="font-sans text-[19px] font-medium tracking-[-0.02em] text-[color:var(--settings-shell-content-title)]"
          >
            {title}
          </h2>
        </header>
      ) : (
        <header
          data-testid="settings-content-header"
          className="flex min-h-[4.5rem] shrink-0 items-center border-b border-border/80 px-5 py-0 backdrop-blur-sm sm:px-6"
          style={{ backgroundColor: "var(--settings-shell-content-header)" }}
        >
          <div
            className={cn(
              headerContentClassName,
              "flex min-h-10 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            <div className="min-w-0">
              <h2
                data-testid="settings-content-title"
                className="font-sans text-[22px] font-medium tracking-[-0.03em] text-[color:var(--settings-shell-content-title)] sm:text-[24px]"
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="max-w-[42rem] font-sans text-[13px] leading-5 text-[color:var(--settings-shell-section-label)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerSummary ? <div className="w-full sm:w-auto sm:pl-4">{headerSummary}</div> : null}
          </div>
        </header>
      )}
      <div className="relative min-h-0 flex-1">
        {contentHasOverflow ? (
          <div
            data-testid="settings-content-fade-top"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5"
            style={{ backgroundImage: "var(--settings-shell-content-fade)" }}
          />
        ) : null}
        <ScrollArea
          data-testid="settings-content-scroll-area"
          viewportRef={contentOverflow.viewportRef}
          contentClassName={bodyContentClassName}
          className={cn("h-full min-h-0", !contentHasOverflow && HIDDEN_SCROLLBAR_CLASS)}
        >
          <div data-testid={contentTestId}>{children}</div>
        </ScrollArea>
        {contentHasOverflow ? (
          <div
            data-testid="settings-content-fade-bottom"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8"
            style={{ backgroundImage: "var(--settings-shell-content-fade-reverse)" }}
          />
        ) : null}
      </div>
    </div>
  );
}
