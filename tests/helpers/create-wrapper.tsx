import type { QueryClientConfig } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n-setup";
import { TestToastHost } from "./test-toast-host";

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
      mutations: { retry: false, ...queryClientConfig?.defaultOptions?.mutations },
    },
  });
}

export function createQueryWrapper({ includeToastHost = false, queryClientConfig }: CreateQueryWrapperOptions = {}) {
  const queryClient = createTestQueryClient(queryClientConfig);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          {children}
          {includeToastHost ? <TestToastHost /> : null}
        </QueryClientProvider>
      </I18nextProvider>
    );
  }

  return { queryClient, wrapper: Wrapper };
}

export function createWrapper() {
  return createQueryWrapper({ includeToastHost: true }).wrapper;
}
