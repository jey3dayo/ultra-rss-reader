import { Result } from "@praha/byethrow";
import { useState } from "react";
import { extractSiteHost } from "@/lib/feed/feed";
import { cn } from "@/lib/utils";
import type { FeedFaviconProps, FeedFaviconSize } from "./feed-favicon.types";

type FaviconSizeClassNames = {
  fallback: string;
  image: string;
  requestSize: number;
};

const faviconSizeClassNames: Record<FeedFaviconSize, FaviconSizeClassNames> = {
  sm: {
    fallback: "h-5 w-5 text-[10px]",
    image: "h-4 w-4",
    requestSize: 32,
  },
  md: {
    fallback: "h-6 w-6 text-[11px]",
    image: "h-5 w-5",
    requestSize: 40,
  },
  lg: {
    fallback: "h-7 w-7 text-xs",
    image: "h-6 w-6",
    requestSize: 64,
  },
};

export function FeedFavicon({ title, url, siteUrl, grayscale = false, size = "sm" }: FeedFaviconProps) {
  const [failed, setFailed] = useState(false);
  let host: string | null = null;
  Result.pipe(
    extractSiteHost(siteUrl, url),
    Result.inspect((resolvedHost) => {
      host = resolvedHost;
    }),
  );
  const sizeClassName = faviconSizeClassNames[size];
  const fallbackLabel = title.trim().charAt(0).toUpperCase() || "?";

  if (!host || failed) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded bg-surface-1/72 font-bold text-foreground-soft",
          sizeClassName.fallback,
        )}
      >
        {fallbackLabel}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=${sizeClassName.requestSize}`}
      alt=""
      className={cn(sizeClassName.image, "shrink-0 rounded", grayscale && "grayscale")}
      onError={() => setFailed(true)}
    />
  );
}
