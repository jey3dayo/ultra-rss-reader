// biome-ignore-all lint/security/noDangerouslySetInnerHtml: ArticleContentView is the sanitized HTML rendering boundary.
import { useMemo } from "react";
import { normalizeArticleBodyHtml } from "@/lib/content/html";

declare const sanitizedArticleHtmlBrand: unique symbol;

export type SanitizedArticleHtml = string & {
  readonly [sanitizedArticleHtmlBrand]: true;
};

export function fromSanitizedArticleHtml(contentHtml: string): SanitizedArticleHtml {
  return contentHtml as SanitizedArticleHtml;
}

type ArticleContentViewProps = {
  thumbnailUrl?: string | null;
  contentHtml: SanitizedArticleHtml;
  feedName?: string | null;
};

export function ArticleContentView({ thumbnailUrl, contentHtml, feedName }: ArticleContentViewProps) {
  const displayHtml = useMemo(() => normalizeArticleBodyHtml(contentHtml, feedName), [contentHtml, feedName]);

  return (
    <>
      {thumbnailUrl && (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-lg bg-surface-1/70">
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div
        className="prose prose-stone dark:prose-invert max-w-none font-serif text-[1.02rem] leading-8 text-foreground prose-headings:font-sans prose-headings:font-normal prose-headings:tracking-[-0.02em] prose-headings:text-foreground prose-p:font-serif prose-li:font-serif prose-blockquote:font-serif prose-strong:text-foreground"
        // react-doctor-disable-next-line react/no-danger -- contentHtml is SanitizedArticleHtml from the Rust sanitizer boundary.
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </>
  );
}
