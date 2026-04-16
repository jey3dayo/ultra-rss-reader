import { useMemo } from "react";
import { stripLeadingDuplicateLabel } from "@/lib/html";
import type { ArticleContentViewProps } from "./article-view.types";

export function ArticleContentView({ thumbnailUrl, contentHtml, feedName }: ArticleContentViewProps) {
  const displayHtml = useMemo(() => stripLeadingDuplicateLabel(contentHtml, feedName), [contentHtml, feedName]);

  return (
    <>
      {thumbnailUrl && (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-md bg-surface-1/70">
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div
        className="prose prose-stone dark:prose-invert max-w-none font-serif text-[1.02rem] leading-8 text-foreground/88 prose-headings:font-sans prose-headings:font-normal prose-headings:tracking-[-0.02em] prose-headings:text-foreground prose-p:font-serif prose-li:font-serif prose-blockquote:font-serif prose-strong:text-foreground"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </>
  );
}
