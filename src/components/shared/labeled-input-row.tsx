import { type KeyboardEventHandler, type ReactNode, type RefObject, useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LabeledInputRowProps = {
  inputId?: string;
  label: string;
  name?: string;
  type?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
  ariaDescribedBy?: string;
  ariaErrorMessage?: string;
  ariaInvalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  rowClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
  inputClassName?: string;
  actionLabel?: string;
  actionAriaLabel?: string;
  actionTooltipLabel?: string;
  actionIcon?: ReactNode;
  actionPlacement?: "inline" | "inside";
  actionVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  actionSize?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  actionClassName?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
};

export function LabeledInputRow({
  inputId,
  label,
  name,
  type,
  value,
  placeholder,
  disabled,
  readOnly,
  title,
  ariaDescribedBy,
  ariaErrorMessage,
  ariaInvalid,
  inputRef,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  rowClassName,
  labelClassName,
  controlClassName,
  inputClassName,
  actionLabel,
  actionAriaLabel,
  actionTooltipLabel,
  actionIcon,
  actionPlacement = "inline",
  actionVariant,
  actionSize,
  actionClassName,
  onAction,
  actionDisabled,
}: LabeledInputRowProps) {
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? generatedInputId;
  const hasInsideAction = actionPlacement === "inside" && Boolean(actionLabel && onAction);
  const isInsideIconAction = hasInsideAction && Boolean(actionIcon);
  const resolvedActionVariant = actionVariant ?? (hasInsideAction ? "ghost" : "outline");
  const resolvedActionSize = actionSize ?? (hasInsideAction ? (isInsideIconAction ? "icon-sm" : "sm") : "default");
  const actionButton =
    actionLabel && onAction ? (
      <Button
        type="button"
        variant={resolvedActionVariant}
        size={resolvedActionSize}
        onClick={onAction}
        disabled={actionDisabled}
        aria-label={actionAriaLabel ?? `${actionLabel}: ${label}`}
        className={cn(
          actionPlacement === "inside" &&
            "absolute top-1/2 right-1 -translate-y-1/2 text-foreground-soft transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2 motion-reduce:transition-none",
          actionPlacement === "inside" && !actionIcon && "h-7 min-w-14 px-2 text-xs font-medium",
          actionClassName,
        )}
      >
        {actionIcon ?? actionLabel}
        {actionIcon ? <span className="sr-only">{actionLabel}</span> : null}
      </Button>
    ) : null;

  return (
    <LabeledControlRow label={label} htmlFor={resolvedInputId} className={rowClassName} labelClassName={labelClassName}>
      <div className={cn("flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end", controlClassName)}>
        <div className={cn("w-full", actionPlacement === "inside" && "relative")}>
          <Input
            id={resolvedInputId}
            ref={inputRef}
            name={name}
            type={type}
            value={value}
            readOnly={readOnly}
            title={title}
            aria-describedby={ariaDescribedBy}
            aria-errormessage={ariaErrorMessage}
            aria-invalid={ariaInvalid || undefined}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={cn(hasInsideAction ? (isInsideIconAction ? "pr-11" : "pr-20") : undefined, inputClassName)}
            disabled={disabled}
          />
          {actionPlacement === "inside" && actionButton ? (
            actionTooltipLabel ? (
              <AppTooltip label={actionTooltipLabel}>{actionButton}</AppTooltip>
            ) : (
              actionButton
            )
          ) : null}
        </div>
        {actionPlacement === "inline" && actionButton ? actionButton : null}
      </div>
    </LabeledControlRow>
  );
}
