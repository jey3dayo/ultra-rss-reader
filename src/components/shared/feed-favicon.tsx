import { useState } from "react";
import { resolveExternalFaviconHost } from "@/lib/feed/feed";
import { cn } from "@/lib/utils";

type FeedFaviconSize = "sm" | "md" | "lg";

type FeedFaviconProps = {
  title: string;
  url: string;
  siteUrl: string;
  iconUrl?: string | null;
  grayscale?: boolean;
  size?: FeedFaviconSize;
};

type FaviconSizeClassNames = {
  fallback: string;
  image: string;
  pixels: number;
  requestSize: number;
};

type FaviconAttemptState = {
  key: string;
  failedCount: number;
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

const fallbackLabelSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function resolveGoogleFaviconSrc(host: string, requestSize: number): string {
  const params = new URLSearchParams({
    domain: host,
    sz: String(requestSize),
  });
  return `${GOOGLE_FAVICON_ENDPOINT}?${params.toString()}`;
}

function resolveFallbackLabel(title: string): string {
  const trimmedTitle = title.trim().normalize("NFC");
  const firstGrapheme = fallbackLabelSegmenter.segment(trimmedTitle)[Symbol.iterator]().next().value?.segment;

  return firstGrapheme?.toLocaleUpperCase() || "?";
}

export function FeedFavicon({ title, url, siteUrl, iconUrl, grayscale = false, size = "sm" }: FeedFaviconProps) {
  const [attemptState, setAttemptState] = useState<FaviconAttemptState | null>(null);
  const resolvedHost = resolveExternalFaviconHost(siteUrl, url);
  const sizeClassName = faviconSizeClassNames[size];
  const fallbackLabel = resolveFallbackLabel(title);

  const trimmedIconUrl = iconUrl?.trim();
  const candidates = [
    trimmedIconUrl && trimmedIconUrl.length > 0 ? trimmedIconUrl : null,
    resolvedHost ? resolveGoogleFaviconSrc(resolvedHost, sizeClassName.requestSize) : null,
  ].filter((candidate): candidate is string => candidate !== null);

  const candidateKey = `${trimmedIconUrl ?? ""}|${resolvedHost ?? ""}|${siteUrl}`;
  const failedCount = attemptState?.key === candidateKey ? attemptState.failedCount : 0;
  const currentSrc = candidates[failedCount] ?? null;

  if (currentSrc === null) {
    return (
      <span
        aria-hidden="true"
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
      src={currentSrc}
      alt=""
      className={cn(sizeClassName.image, "shrink-0 rounded", grayscale && "grayscale")}
      width={sizeClassName.pixels}
      height={sizeClassName.pixels}
      referrerPolicy="no-referrer"
      onError={() => {
        setAttemptState({ key: candidateKey, failedCount: failedCount + 1 });
      }}
    />
  );
}
