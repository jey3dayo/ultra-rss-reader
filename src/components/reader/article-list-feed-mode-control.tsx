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
        className="min-w-0 max-w-[148px] border-0 bg-surface-1/72 shadow-none hover:bg-surface-2/72 focus-visible:ring-2 focus-visible:ring-ring/45 sm:max-w-[168px]"
      >
        <SelectOptionValue options={options} />
      </SelectTrigger>
      <AppSelectPopup>
        <SelectOptionItems options={options} />
      </AppSelectPopup>
    </Select>
  );
}
