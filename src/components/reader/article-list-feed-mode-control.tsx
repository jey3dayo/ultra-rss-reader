import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedDisplayPresetOption } from "@/lib/article-display";

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
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue as FeedDisplayPresetOption)}
    >
      <SelectTrigger aria-label={ariaLabel} className="min-w-[168px]">
        <SelectValue>
          {(selectedValue: string | null) =>
            options.find((option) => option.value === (selectedValue ?? ""))?.label ?? selectedValue ?? ""
          }
        </SelectValue>
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
