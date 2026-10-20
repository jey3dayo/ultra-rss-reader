export function ChangedFieldIndicator({ label }: { label: string }) {
  return (
    <span data-slot="changed-field-indicator" className="inline-flex items-center align-middle">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--settings-field-changed-border)]" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
