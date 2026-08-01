import { PHRASE_AWARE_TEXT_CLASS_NAME } from "@/constants";
import { LabelChip } from "@/design-system";
import { cn } from "@/lib/utils";

type AccountConnectionSummaryProps = {
  statusLabel: string;
  statusTone: "success" | "warning" | "danger";
  detail?: string;
  className?: string;
};

export function AccountConnectionSummary({
  statusLabel,
  statusTone,
  detail,
  className,
}: AccountConnectionSummaryProps) {
  return (
    <div
      data-testid="account-connection-summary"
      className={cn("flex w-full flex-col items-start gap-1 sm:items-end", className)}
    >
      <LabelChip tone={statusTone} size="compact">
        {statusLabel}
      </LabelChip>
      {detail ? (
        <p
          className={cn(
            "font-sans text-[12px] leading-[1.35] text-foreground/72 sm:text-right",
            PHRASE_AWARE_TEXT_CLASS_NAME,
          )}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}
