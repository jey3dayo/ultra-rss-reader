import { AppSelectPopup, Select, SelectOptionItems, SelectOptionValue, SelectTrigger } from "@/design-system";
import { type FeedDisplayPresetOption, isFeedDisplayPresetOption } from "@/lib/articles/article-display";

type ArticleListFeedModeControlProps = {
  ariaLabel: string;
  value: FeedDisplayPresetOption;
  options: Array<{ value: FeedDisplayPresetOption; label: string }>;
  onValueChange: (value: FeedDisplayPresetOption) => void;
};

export function ArticleListFeedModeControl({
  ariaLabel,
  value,
  options,
  onValueChange,
}: ArticleListFeedModeControlProps) {
  return (
    <Select
      name="feed-display-preset"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue && isFeedDisplayPresetOption(nextValue)) {
          onValueChange(nextValue);
        }
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="min-h-9 min-w-0 max-w-[148px] border-transparent bg-transparent px-2.5 py-1.5 text-[13px] text-foreground-soft shadow-none hover:border-border/70 hover:bg-[var(--workspace-header-action-surface)] hover:text-foreground focus-visible:border-border-strong/60 focus-visible:bg-[var(--workspace-header-action-surface)] focus-visible:ring-2 focus-visible:ring-ring/35 sm:max-w-[168px]"
      >
        <SelectOptionValue options={options} />
      </SelectTrigger>
      <AppSelectPopup>
        <SelectOptionItems options={options} />
      </AppSelectPopup>
    </Select>
  );
}
