import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";

export type DiscoveredFeedOption = {
  value: string;
  label: string;
};

export function DiscoveredFeedOptionsView({
  summary,
  name,
  value,
  options,
  onValueChange,
}: {
  summary: string;
  name: string;
  value: string;
  options: DiscoveredFeedOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{summary}</p>
      <RadioGroup
        name={name}
        value={value}
        onValueChange={onValueChange}
        className="max-h-32 overflow-y-auto rounded-md border border-input"
      >
        {options.map((option) => (
          // biome-ignore lint/a11y/noLabelWithoutControl: Radio.Root renders a hidden input but Biome cannot trace namespace components
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
              value === option.value ? "bg-accent" : ""
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
