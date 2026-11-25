import { cn } from "cn";
import type { ReactNode } from "react";
import { useId } from "react";
import { MOTION_CONTEXTUAL_SURFACE_CLASS_NAME, PHRASE_AWARE_TEXT_CLASS_NAME } from "@/constants";

type LabeledControlRowA11y = {
  descriptionId: string | undefined;
};

type LabeledControlRowProps = {
  label: string;
  description?: string;
  descriptionPlacement?: "column" | "below";
  children?: ReactNode | ((a11y: LabeledControlRowA11y) => ReactNode);
  htmlFor?: string;
  labelId?: string;
  descriptionId?: string;
  className?: string;
  leading?: ReactNode;
  labelAccessory?: ReactNode;
  labelClassName?: string;
};

type LabeledControlRowLabelColumnProps = {
  label: string;
  descriptionInColumn: ReactNode;
  htmlFor?: string;
  labelId?: string;
  leading?: ReactNode;
  labelAccessory?: ReactNode;
  labelClassName?: string;
};

function LabeledControlRowLabelColumn({
  label,
  descriptionInColumn,
  htmlFor,
  labelId,
  leading,
  labelAccessory,
  labelClassName,
}: LabeledControlRowLabelColumnProps) {
  const labelClasses = cn(
    "select-none font-sans text-(length:--font-size-sm) leading-[1.35] font-medium text-[color:var(--form-row-label)]",
    labelClassName,
  );
  const titleContent = htmlFor ? (
    <label htmlFor={htmlFor}>
      <span id={labelId} className={labelClasses}>
        {label}
      </span>
    </label>
  ) : (
    <span id={labelId} className={labelClasses}>
      {label}
    </span>
  );
  const labelTextContent = labelAccessory ? (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="block leading-[1.35]">
        {titleContent}
        <span className="ml-1 inline-flex align-middle">{labelAccessory}</span>
      </span>
      {descriptionInColumn}
    </span>
  ) : (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className={labelClasses}>
        {label}
      </span>
      {descriptionInColumn}
    </span>
  );
  return leading ? (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-1/72 text-foreground-soft">
        {leading}
      </span>
      {labelTextContent}
    </span>
  ) : (
    labelTextContent
  );
}

export function LabeledControlRow({
  label,
  description,
  descriptionPlacement = "column",
  children,
  htmlFor,
  labelId,
  descriptionId,
  className,
  leading,
  labelAccessory,
  labelClassName,
}: LabeledControlRowProps) {
  const generatedDescriptionId = useId();
  const resolvedDescriptionId = description ? (descriptionId ?? generatedDescriptionId) : undefined;
  const resolvedChildren =
    typeof children === "function" ? children({ descriptionId: resolvedDescriptionId }) : children;
  const descriptionContent = description ? (
    <span
      id={resolvedDescriptionId}
      className={cn(
        "font-sans text-(length:--font-size-sm) leading-[1.5] text-foreground-soft",
        PHRASE_AWARE_TEXT_CLASS_NAME,
      )}
    >
      {description}
    </span>
  ) : null;
  const descriptionBelow = descriptionPlacement === "below" ? descriptionContent : null;
  const labelContent = (
    <LabeledControlRowLabelColumn
      label={label}
      descriptionInColumn={descriptionBelow === null ? descriptionContent : null}
      htmlFor={htmlFor}
      labelId={labelId}
      leading={leading}
      labelAccessory={labelAccessory}
      labelClassName={labelClassName}
    />
  );
  const rowLabel = labelAccessory ? (
    labelContent
  ) : htmlFor ? (
    <label htmlFor={htmlFor} className="min-w-0">
      {labelContent}
    </label>
  ) : (
    <span className="min-w-0">{labelContent}</span>
  );

  return (
    <div
      className={cn(
        MOTION_CONTEXTUAL_SURFACE_CLASS_NAME,
        "grid min-h-[48px] grid-cols-1 items-start gap-y-2.5 border-b border-border/60 py-3 last:border-b-0 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] lg:items-center lg:gap-x-8 lg:gap-y-3",
        className,
      )}
    >
      {rowLabel}
      <div className="min-w-0 overflow-visible lg:flex lg:items-center lg:justify-end lg:pr-2">{resolvedChildren}</div>
      {descriptionBelow ? <div className="col-span-full">{descriptionBelow}</div> : null}
    </div>
  );
}
