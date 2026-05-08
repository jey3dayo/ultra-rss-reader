import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ArticleEmptyStateViewProps = {
  eyebrow?: string;
  message: string;
  description?: string;
  hints?: string[];
  containerClassName?: string;
  cardClassName?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "link";
  }>;
};

const EMPTY_HINTS: string[] = [];
const EMPTY_ACTIONS: NonNullable<ArticleEmptyStateViewProps["actions"]> = [];

export function ArticleEmptyStateView({
  eyebrow,
  message,
  description,
  hints = EMPTY_HINTS,
  containerClassName,
  cardClassName,
  actions = EMPTY_ACTIONS,
}: ArticleEmptyStateViewProps) {
  return (
    <div
      className={cn(
        "relative flex flex-1 items-center justify-center overflow-hidden px-6 pt-6 pb-12",
        containerClassName,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[16%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(245,78,0,0.08)_0%,rgba(245,78,0,0)_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(192,168,221,0.10)_0%,rgba(192,168,221,0)_72%)]" />
        <div className="absolute right-[8%] top-[22%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(192,133,50,0.12)_0%,rgba(192,133,50,0)_74%)] blur-[84px] dark:bg-[radial-gradient(circle,rgba(201,151,87,0.12)_0%,rgba(201,151,87,0)_76%)]" />
      </div>
      <div
        className={cn(
          "relative w-full max-w-[40rem] overflow-hidden rounded-3xl border border-border/75 bg-[linear-gradient(180deg,rgba(247,247,244,0.94)_0%,rgba(242,241,237,0.86)_100%)] px-8 py-8 text-left text-foreground-soft shadow-[0_32px_78px_-48px_rgba(38,37,30,0.24)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_50%,rgba(255,255,255,0)_100%)] dark:border-border/90 dark:bg-[linear-gradient(180deg,rgba(40,35,30,0.96)_0%,rgba(28,25,21,0.94)_100%)] dark:shadow-[0_36px_96px_-56px_rgba(0,0,0,0.68)] dark:before:bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.10)_50%,rgba(255,255,255,0)_100%)]",
          hints.length > 0 && "min-h-44",
          cardClassName,
        )}
      >
        {eyebrow ? (
          <div className="mb-4 inline-flex rounded-full border border-border/70 bg-surface-1/88 px-3 py-1 text-[0.68rem] font-medium tracking-[0.14em] text-foreground-soft uppercase">
            {eyebrow}
          </div>
        ) : null}
        <p className="max-w-[28rem] text-left text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
          {message}
        </p>
        {description ? (
          <p className="mt-3 max-w-[29rem] text-[0.97rem] leading-6 text-foreground-soft">{description}</p>
        ) : null}
        {actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button key={action.label} type="button" variant={action.variant ?? "default"} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
        {hints.length > 0 ? (
          <ul className="mt-7 max-w-[29rem] list-disc space-y-2.5 border-t border-border/55 pt-5 pl-5 text-left text-sm leading-6 marker:text-foreground-soft dark:border-border/75">
            {hints.map((hint) => (
              <li key={hint} className="leading-6">
                {hint}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
