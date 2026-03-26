export function ArticleContent({ html }: { html: string }) {
  return (
    <div
      style={{ fontSize: "var(--font-size-body)", lineHeight: 1.7, color: "var(--text-secondary)" }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
