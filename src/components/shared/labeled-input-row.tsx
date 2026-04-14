import { useId } from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LabeledInputRowProps } from "./form-row.types";

export function LabeledInputRow({
  label,
  name,
  type,
  value,
  placeholder,
  disabled,
  readOnly,
  title,
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
  actionVariant = "outline",
  actionSize = "default",
  actionClassName,
  onAction,
  actionDisabled,
}: LabeledInputRowProps) {
  const inputId = useId();
  const actionButton =
    actionLabel && onAction ? (
      <Button
        type="button"
        variant={actionVariant}
        size={actionSize}
        onClick={onAction}
        disabled={actionDisabled}
        aria-label={actionAriaLabel ?? `${actionLabel}: ${label}`}
        className={cn(
          actionPlacement === "inside" &&
            "absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2",
          actionClassName,
        )}
      >
        {actionIcon ?? actionLabel}
        {actionIcon ? <span className="sr-only">{actionLabel}</span> : null}
      </Button>
    ) : null;

  return (
    <LabeledControlRow label={label} htmlFor={inputId} className={rowClassName} labelClassName={labelClassName}>
      <div className={cn("flex w-full items-center gap-2", controlClassName)}>
        <div className={cn("w-full", actionPlacement === "inside" && "relative")}>
          <Input
            id={inputId}
            ref={inputRef}
            name={name}
            type={type}
            value={value}
            readOnly={readOnly}
            title={title}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={cn(actionPlacement === "inside" && actionButton ? "pr-11" : undefined, inputClassName)}
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
