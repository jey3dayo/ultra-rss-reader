import { SelectOptionItems, SelectOptionValue } from "@/components/shared/select-option-content";
import { Select, SelectPopup, SelectTrigger } from "@/components/ui/select";
import { isFeedDisplayPresetOption } from "@/lib/articles/article-display";
import type { ArticleListFeedModeControlProps } from "./article-list.types";

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
