import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "cn";
import {
  type ComponentProps,
  type KeyboardEventHandler,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
  useId,
} from "react";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppTooltip } from "@/components/ui/tooltip";

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
  errorText?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  rowClassName?: string;
  labelClassName?: string;
  labelAccessory?: ReactNode;
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

type ActionPlacement = NonNullable<LabeledInputRowProps["actionPlacement"]>;
type ActionVariant = NonNullable<LabeledInputRowProps["actionVariant"]>;
type ActionSize = NonNullable<LabeledInputRowProps["actionSize"]>;

function isErrorTextVisible(errorText: string | undefined): boolean {
  return errorText != null && errorText.trim().length > 0;
}

function resolveActionPresence(
  actionPlacement: ActionPlacement,
  actionLabel: string | undefined,
  actionIcon: ReactNode,
  onAction: (() => void) | undefined,
): { hasInsideAction: boolean; isInsideIconAction: boolean } {
  const hasAction = Boolean(actionLabel && onAction);
  const hasInsideAction = actionPlacement === "inside" && hasAction;
  const isInsideIconAction = hasInsideAction && Boolean(actionIcon);
  return { hasInsideAction, isInsideIconAction };
}

function resolveActionVariant(actionVariant: ActionVariant | undefined, hasInsideAction: boolean): ActionVariant {
  return actionVariant ?? (hasInsideAction ? "ghost" : "outline");
}

function resolveActionSize(
  actionSize: ActionSize | undefined,
  hasInsideAction: boolean,
  isInsideIconAction: boolean,
): ActionSize {
  if (actionSize) {
    return actionSize;
  }
  if (!hasInsideAction) {
    return "default";
  }
  return isInsideIconAction ? "icon" : "default";
}

function resolveActionButtonClassName(
  actionPlacement: ActionPlacement,
  actionIcon: ReactNode,
  actionClassName: string | undefined,
): string {
  return cn(
    actionPlacement === "inside" &&
      "absolute top-1/2 right-1 -translate-y-1/2 text-foreground-soft transition-colors duration-200 hover:text-foreground active:not-aria-[haspopup]:-translate-y-1/2 motion-reduce:transition-none",
    actionPlacement === "inside" && !actionIcon && "h-11 min-w-20 px-3 text-xs font-medium",
    actionPlacement === "inside" && actionIcon && "size-11",
    actionClassName,
  );
}

function resolveInputClassName(
  hasInsideAction: boolean,
  isInsideIconAction: boolean,
  inputClassName: string | undefined,
): string {
  return cn(hasInsideAction ? (isInsideIconAction ? "min-h-11 pr-12" : "min-h-11 pr-24") : undefined, inputClassName);
}

type InputActionButtonProps = Omit<
  ComponentProps<typeof ButtonPrimitive>,
  "children" | "className" | "onClick" | "ref"
> & {
  label: string;
  actionLabel: string;
  actionAriaLabel?: string;
  actionIcon?: ReactNode;
  actionPlacement: ActionPlacement;
  variant: ActionVariant;
  size: ActionSize;
  disabled?: boolean;
  onAction: () => void;
  className: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
};

function InputActionButton({
  label,
  actionLabel,
  actionAriaLabel,
  actionIcon,
  actionPlacement,
  variant,
  size,
  disabled,
  onAction,
  className,
  ref,
  ...rest
}: InputActionButtonProps) {
  return (
    <Button
      ref={ref}
      {...mergeProps(rest, {
        type: "button",
        variant,
        size,
        onMouseDown:
          actionPlacement === "inside" ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : undefined,
        onClick: onAction,
        disabled,
        "aria-label": actionAriaLabel ?? `${actionLabel}: ${label}`,
        className,
      })}
    >
      {actionIcon ?? actionLabel}
      {actionIcon ? <span className="sr-only">{actionLabel}</span> : null}
    </Button>
  );
}

type InputActionConfig = {
  label: string;
  actionLabel?: string;
  actionAriaLabel?: string;
  actionIcon?: ReactNode;
  actionPlacement: ActionPlacement;
  actionVariant?: ActionVariant;
  actionSize?: ActionSize;
  actionClassName?: string;
  actionDisabled?: boolean;
  disabled?: boolean;
  onAction?: () => void;
  hasInsideAction: boolean;
  isInsideIconAction: boolean;
};

function renderInputActionButton(config: InputActionConfig): ReactElement | null {
  if (!config.actionLabel || !config.onAction) {
    return null;
  }
  return (
    <InputActionButton
      label={config.label}
      actionLabel={config.actionLabel}
      actionAriaLabel={config.actionAriaLabel}
      actionIcon={config.actionIcon}
      actionPlacement={config.actionPlacement}
      variant={resolveActionVariant(config.actionVariant, config.hasInsideAction)}
      size={resolveActionSize(config.actionSize, config.hasInsideAction, config.isInsideIconAction)}
      disabled={config.actionDisabled ?? config.disabled}
      onAction={config.onAction}
      className={resolveActionButtonClassName(config.actionPlacement, config.actionIcon, config.actionClassName)}
    />
  );
}

function InsideActionSlot({ tooltipLabel, children }: { tooltipLabel?: string; children: ReactElement }) {
  if (tooltipLabel) {
    return <AppTooltip label={tooltipLabel}>{children}</AppTooltip>;
  }
  return <>{children}</>;
}

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
  errorText,
  inputRef,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  rowClassName,
  labelClassName,
  labelAccessory,
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
  const errorMessageId = `${resolvedInputId}-error`;
  const showError = isErrorTextVisible(errorText);
  const { hasInsideAction, isInsideIconAction } = resolveActionPresence(
    actionPlacement,
    actionLabel,
    actionIcon,
    onAction,
  );
  const actionButton = renderInputActionButton({
    label,
    actionLabel,
    actionAriaLabel,
    actionIcon,
    actionPlacement,
    actionVariant,
    actionSize,
    actionClassName,
    actionDisabled,
    disabled,
    onAction,
    hasInsideAction,
    isInsideIconAction,
  });

  return (
    <LabeledControlRow
      label={label}
      htmlFor={resolvedInputId}
      className={rowClassName}
      labelClassName={labelClassName}
      labelAccessory={labelAccessory}
    >
      <div
        className={cn(
          "flex w-full gap-2 sm:max-w-[30rem] sm:justify-end",
          showError ? "items-start" : "items-center",
          controlClassName,
        )}
      >
        <div className="w-full">
          <div className={cn(actionPlacement === "inside" && "relative")}>
            <Input
              id={resolvedInputId}
              ref={inputRef}
              name={name}
              type={type}
              value={value}
              readOnly={readOnly}
              title={title}
              aria-describedby={
                [ariaDescribedBy, showError ? errorMessageId : undefined].filter(Boolean).join(" ") || undefined
              }
              aria-errormessage={showError ? errorMessageId : ariaErrorMessage}
              aria-invalid={ariaInvalid || showError || undefined}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              onFocus={onFocus}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={resolveInputClassName(hasInsideAction, isInsideIconAction, inputClassName)}
              disabled={disabled}
            />
            {actionPlacement === "inside" && actionButton ? (
              <InsideActionSlot tooltipLabel={actionTooltipLabel}>{actionButton}</InsideActionSlot>
            ) : null}
          </div>
          {showError ? (
            <p id={errorMessageId} className="mt-1.5 text-xs leading-5 text-state-danger-foreground">
              {errorText}
            </p>
          ) : null}
        </div>
        {actionPlacement === "inline" && actionButton ? actionButton : null}
      </div>
    </LabeledControlRow>
  );
}
