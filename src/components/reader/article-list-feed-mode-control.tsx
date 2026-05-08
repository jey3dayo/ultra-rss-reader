import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
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
      <SelectTrigger aria-label={ariaLabel} className="min-w-[168px]">
        <SelectOptionValue options={options} />
      </SelectTrigger>
      <SelectPopup>
        <SelectOptionItems options={options} />
      </SelectPopup>
    </Select>
  );
}
