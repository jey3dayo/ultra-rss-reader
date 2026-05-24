import { useUiStore } from "@/stores/ui-store";

export function TestToastHost() {
  const { toastMessage, clearToast } = useUiStore();

  if (!toastMessage) {
    return null;
  }

  return (
    <div data-testid="test-toast-host">
      <span>{toastMessage.message}</span>
      {toastMessage.actions?.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      <button type="button" onClick={clearToast}>
        dismiss
      </button>
    </div>
  );
}
