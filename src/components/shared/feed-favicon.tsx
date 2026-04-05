import { Result } from "@praha/byethrow";
import { useState } from "react";
import { extractSiteHost } from "@/lib/feed";
import { cn } from "@/lib/utils";

type FeedFaviconProps = {
  title: string;
  url: string;
  siteUrl: string;
  grayscale?: boolean;
};

export function FeedFavicon({ title, url, siteUrl, grayscale = false }: FeedFaviconProps) {
  const [failed, setFailed] = useState(false);
  let host: string | null = null;
  Result.pipe(
    extractSiteHost(siteUrl, url),
    Result.inspect((resolvedHost) => {
      host = resolvedHost;
    }),
  );

  if (!host || failed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
        {title.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      className={cn("h-4 w-4 shrink-0 rounded", grayscale && "grayscale")}
      onError={() => setFailed(true)}
    />
  );
}
