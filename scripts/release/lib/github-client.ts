export type ReleaseEnvironment = Readonly<Record<string, string | undefined>>;
export type GitHubClient = {
  request: (method: "GET" | "POST", endpoint: string, body?: unknown, optional?: boolean) => Promise<unknown>;
};

export const createGitHubClient = (
  repository: string,
  token: string,
  caller: "start" | "build",
  requestFetch: typeof fetch = fetch,
): GitHubClient => ({
  async request(method, endpoint, body, optional = false) {
    const response = await requestFetch(
      endpoint === "graphql"
        ? "https://api.github.com/graphql"
        : `https://api.github.com/repos/${repository}/${endpoint}`,
      {
        method: caller === "start" ? method : undefined,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          ...(caller === "start" ? { "Content-Type": "application/json" } : {}),
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (optional && response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(
        caller === "start"
          ? `GitHub ${method} ${endpoint} failed with HTTP ${response.status}; do not blindly retry writes`
          : `Cannot verify release build slot: HTTP ${response.status}`,
      );
    }
    const value: unknown = await response.json();
    return value;
  },
});
