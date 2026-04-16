import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { DiscoveredFeedOptionsViewProps } from "./add-feed-dialog.types";

export function DiscoveredFeedOptionsView({
  summary,
  name,
  value,
  options,
  onValueChange,
}: DiscoveredFeedOptionsViewProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-foreground-soft">{summary}</p>
      <RadioGroup
        name={name}
        value={value}
        onValueChange={onValueChange}
        className="max-h-32 overflow-y-auto rounded-md border border-border/70 bg-surface-1/72"
      >
        {options.map((option) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Radio.Root renders a hidden input but Biome cannot trace namespace components
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1/72 ${
              value === option.value ? "bg-surface-1/72" : ""
            }`}
          >
            <Radio.Root
              value={option.value}
              aria-label={option.label}
              className="flex size-4 items-center justify-center rounded-full border border-primary"
            >
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </Radio.Root>
            <span className="truncate" aria-hidden="true">
              {option.label}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
