export type ArticleEmptyStateViewProps = {
  message: string;
};

export function ArticleEmptyStateView({ message }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  );
}
