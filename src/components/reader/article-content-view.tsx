import { useMemo } from "react";
import { stripLeadingDuplicateLabel } from "@/lib/html";
import type { ArticleContentViewProps } from "./article-view.types";

export function ArticleContentView({ thumbnailUrl, contentHtml, feedName }: ArticleContentViewProps) {
  const displayHtml = useMemo(() => stripLeadingDuplicateLabel(contentHtml, feedName), [contentHtml, feedName]);

  return (
    <>
      {thumbnailUrl && (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted/20">
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div
        className="prose prose-invert max-w-none text-[1.02rem] leading-8 text-foreground/88 prose-headings:text-foreground prose-strong:text-foreground"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </>
  );
}
