// biome-ignore-all lint/security/noDangerouslySetInnerHtml: ArticleContentView is the sanitized HTML rendering boundary.
import { useEffect, useMemo, useRef } from "react";
import {
  applyReaderContentPrivacyPolicy,
  normalizeArticleBodyHtml,
  normalizeReaderContentImageUrl,
  type SanitizedArticleHtml,
} from "@/lib/content/html";

type ArticleContentViewProps = {
  thumbnailUrl?: string | null;
  contentHtml: SanitizedArticleHtml;
  feedName?: string | null;
  confirmPrivateLinks?: boolean;
};

export function ArticleContentView({
  thumbnailUrl,
  contentHtml,
  feedName,
  confirmPrivateLinks = false,
}: ArticleContentViewProps) {
  // React 19 resets innerHTML whenever the dangerouslySetInnerHTML object identity
  // changes, even for equal markup, which reloads every <img> on unrelated re-renders.
  // Keep the {__html} object itself memoized so re-renders leave the DOM untouched.
  const displayHtmlProp = useMemo(
    () => ({
      __html: applyReaderContentPrivacyPolicy(normalizeArticleBodyHtml(contentHtml, feedName), confirmPrivateLinks),
    }),
    [contentHtml, feedName, confirmPrivateLinks],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !displayHtmlProp.__html) return;

    const scrollRegions = Array.from(content.querySelectorAll<HTMLElement>("table, pre")).filter(
      (region) => !region.hasAttribute("tabindex"),
    );
    const updateKeyboardAccess = () => {
      for (const region of scrollRegions) {
        if (region.scrollWidth > region.clientWidth) {
          region.tabIndex = 0;
        } else {
          region.removeAttribute("tabindex");
        }
      }
    };
    updateKeyboardAccess();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateKeyboardAccess);
    for (const region of scrollRegions) observer.observe(region);
    return () => {
      observer.disconnect();
      for (const region of scrollRegions) region.removeAttribute("tabindex");
    };
  }, [displayHtmlProp]);
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
        ref={contentRef}
        data-reader-content-contract="native-contiguous-dom"
        data-reader-selection-contract="native-dom-selection"
        data-reader-search-highlight-contract="browser-find-no-inline-marks"
        data-reader-scroll-anchor="article-content"
        data-reader-image-loading-contract="lazy-native"
        className="prose prose-stone dark:prose-invert min-w-0 max-w-none font-sans text-[1.02rem] leading-8 text-foreground prose-headings:font-sans prose-headings:font-normal prose-headings:tracking-[-0.02em] prose-code:break-words prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:rounded-lg prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:focus-visible:outline-2 prose-pre:focus-visible:outline-ring prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-table:focus-visible:outline-2 prose-table:focus-visible:outline-ring [&_:where(blockquote,h1,h2,h3,h4,h5,h6,li,p,td,th):not([dir]):not([dir]_*)]:[unicode-bidi:plaintext] [&_:where(blockquote,h2,h3,h4,h5,h6,ol,ul)]:max-w-[72ch] [&_:where(figure,p:has(img))]:w-full [&_:where(figure,p:has(img))]:max-w-[min(100%,56rem)] [&_:where(blockquote,p,li)]:[overflow-wrap:anywhere] [&_p:not(:has(img))]:max-w-[72ch]"
        // react-doctor-disable-next-line react/no-danger -- contentHtml is SanitizedArticleHtml from the Rust sanitizer boundary.
        dangerouslySetInnerHTML={displayHtmlProp}
      />
    </>
  );
}
