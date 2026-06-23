import { useId } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { Radio, RadioGroup } from "@/design-system";
import type { DiscoveredFeedOption } from "./add-feed-dialog.types";

type DiscoveredFeedOptionsViewProps = {
  summary: string;
  name: string;
  value: string;
  options: DiscoveredFeedOption[];
  onValueChange: (value: string) => void;
};

export function DiscoveredFeedOptionsView({
  summary,
  name,
  value,
  options,
  onValueChange,
}: DiscoveredFeedOptionsViewProps) {
  const summaryId = useId();

  return (
    <div
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 space-y-1.5`}
    >
      <p id={summaryId} className="text-xs text-foreground-soft">
        {summary}
      </p>
      <RadioGroup
        name={name}
        value={value}
        aria-labelledby={summaryId}
        onValueChange={onValueChange}
        className="grid max-h-32 gap-1 overflow-y-auto"
      >
        {options.map((option) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Radio.Root renders a hidden input but Biome cannot trace namespace components
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors duration-150 hover:bg-surface-2 motion-reduce:transition-none ${
              value === option.value ? "bg-surface-2 text-foreground" : "text-foreground-soft"
            }`}
          >
            <Radio.Root
              value={option.value}
              aria-label={option.description ? `${option.label} ${option.description}` : option.label}
              className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-1 data-[checked]:border-primary"
            >
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </Radio.Root>
            <span className="min-w-0" aria-hidden="true">
              <span className="block truncate">{option.label}</span>
              {option.description ? (
                <span className="block break-all text-xs leading-snug text-foreground-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
