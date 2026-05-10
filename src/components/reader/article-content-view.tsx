// biome-ignore-all lint/security/noDangerouslySetInnerHtml: ArticleContentView is the sanitized HTML rendering boundary.
import { useMemo } from "react";
import {
  applyReaderContentPrivacyPolicy,
  fromSanitizedArticleHtml,
  fromSanitizedArticleHtmlDto,
  normalizeArticleBodyHtml,
  normalizeReaderContentImageUrl,
  type SanitizedArticleHtml,
} from "@/lib/content/html";

/**
 * HTML that has crossed the Rust sanitizer boundary as `content_sanitized`.
 *
 * ArticleContentView intentionally does not sanitize again in React; callers must
 * brand only Rust-sanitized article bodies before passing them to this danger boundary.
 */
export { fromSanitizedArticleHtml, fromSanitizedArticleHtmlDto, type SanitizedArticleHtml };

type ArticleContentViewProps = {
  thumbnailUrl?: string | null;
  contentHtml: SanitizedArticleHtml;
  feedName?: string | null;
};

export function ArticleContentView({ thumbnailUrl, contentHtml, feedName }: ArticleContentViewProps) {
  const displayHtml = useMemo(
    () => applyReaderContentPrivacyPolicy(normalizeArticleBodyHtml(contentHtml, feedName)),
    [contentHtml, feedName],
  );
  const normalizedThumbnailUrl = useMemo(() => normalizeReaderContentImageUrl(thumbnailUrl), [thumbnailUrl]);

  return (
    <>
      {normalizedThumbnailUrl && (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-lg bg-surface-1/70">
          <img
            src={normalizedThumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div
        className="prose prose-stone dark:prose-invert min-w-0 max-w-none overflow-x-hidden font-serif text-[1.02rem] leading-8 text-foreground prose-headings:font-sans prose-headings:font-normal prose-headings:tracking-[-0.02em] prose-headings:text-foreground prose-p:font-serif prose-li:font-serif prose-blockquote:font-serif prose-strong:text-foreground prose-code:break-words prose-pre:max-w-full prose-pre:overflow-x-auto prose-table:block prose-table:max-w-full prose-table:overflow-x-auto"
        // react-doctor-disable-next-line react/no-danger -- contentHtml is SanitizedArticleHtml from the Rust sanitizer boundary.
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </>
  );
}
