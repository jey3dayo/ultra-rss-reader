import { Result } from "@praha/byethrow";
import { useState } from "react";
import { extractSiteHost } from "@/lib/feed/feed";
import { cn } from "@/lib/utils";

type FeedFaviconSize = "sm" | "md" | "lg";

type FeedFaviconProps = {
  title: string;
  url: string;
  siteUrl: string;
  grayscale?: boolean;
  size?: FeedFaviconSize;
};

type FaviconSizeClassNames = {
  fallback: string;
  image: string;
  pixels: number;
  requestSize: number;
};

const GOOGLE_FAVICON_ENDPOINT = "https://www.google.com/s2/favicons";

const faviconSizeClassNames: Record<FeedFaviconSize, FaviconSizeClassNames> = {
  sm: {
    fallback: "h-5 w-5 text-[10px]",
    image: "h-5 w-5",
    pixels: 20,
    requestSize: 32,
  },
  md: {
    fallback: "h-6 w-6 text-[11px]",
    image: "h-6 w-6",
    pixels: 24,
    requestSize: 40,
  },
  lg: {
    fallback: "h-7 w-7 text-xs",
    image: "h-7 w-7",
    pixels: 28,
    requestSize: 64,
  },
};

function resolveGoogleFaviconSrc(host: string, requestSize: number): string {
  const params = new URLSearchParams({
    domain: host,
    sz: String(requestSize),
  });
  return `${GOOGLE_FAVICON_ENDPOINT}?${params.toString()}`;
}

export function FeedFavicon({ title, url, siteUrl, grayscale = false, size = "sm" }: FeedFaviconProps) {
  const [failedFaviconSrc, setFailedFaviconSrc] = useState<string | null>(null);
  let resolvedHost: string | null = null;
  Result.pipe(
    extractSiteHost(siteUrl, url),
    Result.inspect((host) => {
      resolvedHost = host;
    }),
  );
  const sizeClassName = faviconSizeClassNames[size];
  const fallbackLabel = title.trim().charAt(0).toUpperCase() || "?";
  const faviconSrc = resolvedHost ? resolveGoogleFaviconSrc(resolvedHost, sizeClassName.requestSize) : null;

  return faviconSrc === null || failedFaviconSrc === faviconSrc ? (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded bg-surface-1/72 font-bold text-foreground-soft",
        sizeClassName.fallback,
      )}
    >
      {fallbackLabel}
    </span>
  ) : (
    <img
      src={faviconSrc}
      alt=""
      className={cn(sizeClassName.image, "shrink-0 rounded", grayscale && "grayscale")}
      width={sizeClassName.pixels}
      height={sizeClassName.pixels}
      referrerPolicy="no-referrer"
      onError={() => {
        setFailedFaviconSrc(faviconSrc);
      }}
    />
  );
}
