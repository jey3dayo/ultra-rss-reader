import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
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
  return (
    <div
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} space-y-1`}
    >
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
              aria-label={option.description ? `${option.label} ${option.description}` : option.label}
              className="flex size-4 items-center justify-center rounded-full border border-primary"
            >
              <Radio.Indicator className="size-2 rounded-full bg-primary" />
            </Radio.Root>
            <span className="min-w-0" aria-hidden="true">
              <span className="block truncate">{option.label}</span>
              {option.description ? (
                <span className="block truncate text-xs text-foreground-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
