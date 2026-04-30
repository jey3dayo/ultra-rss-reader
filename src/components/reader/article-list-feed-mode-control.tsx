import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedDisplayPresetOption } from "@/lib/article-display";
import { getOptionLabelByValue } from "@/lib/options";
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
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue as FeedDisplayPresetOption)}
    >
      <SelectTrigger aria-label={ariaLabel} className="min-w-[168px]">
        <SelectValue>{(selectedValue: string | null) => getOptionLabelByValue(options, selectedValue)}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
