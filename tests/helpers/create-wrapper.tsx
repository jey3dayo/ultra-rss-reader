import type { QueryClientConfig } from "@tanstack/react-query";
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

type CreateQueryWrapperOptions = {
  includeToastHost?: boolean;
  queryClientConfig?: QueryClientConfig;
};

export function createTestQueryClient(queryClientConfig?: QueryClientConfig) {
  return new QueryClient({
    ...queryClientConfig,
    defaultOptions: {
      ...queryClientConfig?.defaultOptions,
      queries: { retry: false, ...queryClientConfig?.defaultOptions?.queries },
    },
  });
}

export function createQueryWrapper({ includeToastHost = false, queryClientConfig }: CreateQueryWrapperOptions = {}) {
  const queryClient = createTestQueryClient(queryClientConfig);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        {includeToastHost ? <TestToastHost /> : null}
      </QueryClientProvider>
    );
  }

  return { queryClient, wrapper: Wrapper };
}

export function createWrapper() {
  return createQueryWrapper({ includeToastHost: true }).wrapper;
}
