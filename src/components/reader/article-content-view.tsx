export type ArticleContentViewProps = {
  thumbnailUrl?: string | null;
  contentHtml: string;
};

export function ArticleContentView({ thumbnailUrl, contentHtml }: ArticleContentViewProps) {
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
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </>
  );
}
