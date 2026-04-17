import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagPickerView } from "./article-tag-picker-view";

function ArticleReadingRhythmCanvas() {
  return (
    <article className="mx-auto max-w-[44rem] bg-background px-7 pb-20 pt-10 text-foreground md:px-11 md:pt-13">
      <ArticleMetaView
        title="イランの攻撃被害額４３兆円、米国とイスラエルに賠償要求へ"
        author="damono3856"
        feedName="痛いニュース(ﾉ∀`)"
        publishedLabel="2026/04/15(水) 20:47:05.02"
      />

      <div className="mt-4 border-t border-border/20 pt-3">
        <ArticleTagPickerView
          assignedTags={[
            { id: "tag-1", name: "Fav", color: "#caa75e" },
            { id: "tag-2", name: "news", color: "#8d73d8" },
          ]}
          availableTags={[]}
          newTagName=""
          isExpanded={false}
          labels={{
            sectionTitle: "Tags",
            addTag: "Add tag",
            availableTags: "Available tags",
            newTagPlaceholder: "Create tag",
            createTag: "Create tag",
            removeTag: (name: string) => `Remove tag ${name}`,
          }}
          onExpandedChange={() => {}}
          onNewTagNameChange={() => {}}
          onAssignTag={() => {}}
          onRemoveTag={() => {}}
          onCreateTag={() => {}}
        />
      </div>

      <div className="mt-7 font-serif text-[1.02rem] leading-8 text-foreground">
        <p>1 名前：番の市 ★：2026/04/15(水) 20:47:05.02 ID:zdCQxhZs0.net</p>
        <p className="mt-4">
          イランの攻撃被害額４３兆円、米国とイスラエルに賠償要求へ。外交当局は被害算定と今後の対応をめぐって声明を準備している。
        </p>
      </div>
    </article>
  );
}

const meta = {
  title: "Reader/ArticleReadingRhythm",
  component: ArticleReadingRhythmCanvas,
  tags: ["autodocs"],
} satisfies Meta<typeof ArticleReadingRhythmCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
