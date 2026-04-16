export type FeedFaviconSize = "sm" | "md" | "lg";

export type FeedFaviconProps = {
  title: string;
  url: string;
  siteUrl: string;
  grayscale?: boolean;
  size?: FeedFaviconSize;
};
