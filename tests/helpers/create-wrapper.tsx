import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUiStore } from "@/stores/ui-store";

function TestToastHost() {
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

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        <TestToastHost />
      </QueryClientProvider>
    );
  };
}
