import { useMemo } from "react";
import { stripLeadingDuplicateLabel } from "@/lib/html";
import type { ArticleContentViewProps } from "./article-view.types";

export function ArticleContentView({ thumbnailUrl, contentHtml, feedName }: ArticleContentViewProps) {
  const displayHtml = useMemo(() => stripLeadingDuplicateLabel(contentHtml, feedName), [contentHtml, feedName]);

  return (
    <>
      {thumbnailUrl && (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div
        className="prose prose-invert max-w-none text-base leading-relaxed text-foreground/90"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </>
  );
}
