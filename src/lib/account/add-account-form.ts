import { Result } from "@praha/byethrow";
import type { CloudflareAccessUpdate } from "@/api/schemas";
import { validateFreshRssServerUrl } from "@/lib/account/server-url";
import { resolveCloudflareAccessUpdate } from "./cloudflare-access";

export type AddAccountProviderKind = "Local" | "FreshRss";

export type AddAccountPayload = {
  kind: AddAccountProviderKind;
  name: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  cloudflareAccess?: CloudflareAccessUpdate;
};

export type AddAccountValidationError =
  | "missing_server_url"
  | "invalid_server_url"
  | "server_url_credentials"
  | "missing_username"
  | "missing_password"
  | "missing_cloudflare_access_client_id"
  | "missing_cloudflare_access_client_secret"
  | "cloudflare_access_https_required";

export type AddAccountFormState = {
  kind: AddAccountProviderKind;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessClientId: string;
  cloudflareAccessClientSecret: string;
};

export type AddAccountFormAction =
  | { type: "setKind"; value: AddAccountProviderKind }
  | {
      type: "setField";
      field:
        | "name"
        | "serverUrl"
        | "username"
        | "password"
        | "cloudflareAccessClientId"
        | "cloudflareAccessClientSecret";
      value: string;
    }
  | { type: "setCloudflareAccessEnabled"; value: boolean };

export const addAccountFormInitialState: AddAccountFormState = {
  kind: "Local",
  name: "",
  serverUrl: "",
  username: "",
  password: "",
  cloudflareAccessEnabled: false,
  cloudflareAccessClientId: "",
  cloudflareAccessClientSecret: "",
};

export function addAccountFormReducer(state: AddAccountFormState, action: AddAccountFormAction): AddAccountFormState {
  switch (action.type) {
    case "setKind":
      return { ...state, kind: action.value };
    case "setField":
      return { ...state, [action.field]: action.value };
    case "setCloudflareAccessEnabled":
      return {
        ...state,
        cloudflareAccessEnabled: action.value,
        cloudflareAccessClientId: action.value ? state.cloudflareAccessClientId : "",
        cloudflareAccessClientSecret: action.value ? state.cloudflareAccessClientSecret : "",
      };
  }
}

type AddAccountFormInput = Omit<
  AddAccountFormState,
  "cloudflareAccessEnabled" | "cloudflareAccessClientId" | "cloudflareAccessClientSecret"
> &
  Partial<
    Pick<AddAccountFormState, "cloudflareAccessEnabled" | "cloudflareAccessClientId" | "cloudflareAccessClientSecret">
  >;

type AddAccountValidationMessageKey =
  | "account.error_server_url_required"
  | "account.error_server_url_invalid"
  | "account.error_username_required"
  | "account.error_password_required"
  | "account.error_cloudflare_access_client_id_required"
  | "account.error_cloudflare_access_secret_required"
  | "account.error_cloudflare_access_https_required";

type AddAccountFormConfig = {
  sectionHeading: "Account" | "Server" | "Credentials";
  showServerUrl: boolean;
  credentialLabel: "Username" | null;
  credentialName: "username" | null;
  requiresCredentials: boolean;
};

export function getAddAccountFormConfig(kind: AddAccountProviderKind): AddAccountFormConfig {
  switch (kind) {
    case "FreshRss":
      return {
        sectionHeading: "Server",
        showServerUrl: true,
        credentialLabel: "Username",
        credentialName: "username",
        requiresCredentials: true,
      };
    case "Local":
      return {
        sectionHeading: "Account",
        showServerUrl: false,
        credentialLabel: null,
        credentialName: null,
        requiresCredentials: false,
      };
  }
}

export function formatAddAccountValidationError(
  _kind: AddAccountProviderKind,
  error: AddAccountValidationError,
): AddAccountValidationMessageKey {
  switch (error) {
    case "missing_server_url":
      return "account.error_server_url_required";
    case "invalid_server_url":
      return "account.error_server_url_invalid";
    case "server_url_credentials":
      return "account.error_server_url_invalid";
    case "missing_username":
      return "account.error_username_required";
    case "missing_password":
      return "account.error_password_required";
    case "missing_cloudflare_access_client_id":
      return "account.error_cloudflare_access_client_id_required";
    case "missing_cloudflare_access_client_secret":
      return "account.error_cloudflare_access_secret_required";
    case "cloudflare_access_https_required":
      return "account.error_cloudflare_access_https_required";
  }
}

function validateCredentials(
  input: AddAccountFormInput,
): Result.Result<{ username: string; password: string }, AddAccountValidationError> {
  const username = input.username.trim();
  if (!username) {
    return Result.fail("missing_username");
  }

  const password = input.password;
  if (!password.trim()) {
    return Result.fail("missing_password");
  }

  return Result.succeed({ username, password });
}

export function buildAddAccountPayload(
  input: AddAccountFormInput,
): Result.Result<AddAccountPayload, AddAccountValidationError> {
  const config = getAddAccountFormConfig(input.kind);
  const name = input.name.trim() || input.kind;

  if (config.showServerUrl) {
    const serverUrl = input.serverUrl.trim();
    if (!serverUrl) {
      return Result.fail("missing_server_url");
    }
    const serverUrlResult = validateFreshRssServerUrl(serverUrl);
    if (Result.isFailure(serverUrlResult)) {
      return Result.fail(Result.unwrapError(serverUrlResult));
    }

    const accessResolution = resolveCloudflareAccessUpdate({
      draft: {
        enabled: input.cloudflareAccessEnabled ?? false,
        clientId: input.cloudflareAccessClientId ?? "",
        clientSecret: input.cloudflareAccessClientSecret ?? "",
      },
      serverUrl: Result.unwrap(serverUrlResult),
      savedClientId: null,
      savedOrigin: null,
    });
    if (Result.isFailure(accessResolution)) {
      switch (Result.unwrapError(accessResolution)) {
        case "client_id_required":
          return Result.fail("missing_cloudflare_access_client_id");
        case "client_secret_required":
          return Result.fail("missing_cloudflare_access_client_secret");
        case "https_required":
          return Result.fail("cloudflare_access_https_required");
      }
    }

    const accessUpdate = Result.unwrap(accessResolution);

    return Result.pipe(
      validateCredentials(input),
      Result.map((creds) => ({
        kind: input.kind,
        name,
        serverUrl: Result.unwrap(serverUrlResult),
        ...creds,
        ...(accessUpdate.action === "replace" ? { cloudflareAccess: accessUpdate } : {}),
      })),
    );
  }

  if (config.requiresCredentials) {
    return Result.pipe(
      validateCredentials(input),
      Result.map((creds) => ({
        kind: input.kind,
        name,
        ...creds,
      })),
    );
  }

  return Result.succeed({
    kind: input.kind,
    name,
  });
}

export function isAddAccountFormSubmittable(input: AddAccountFormInput): boolean {
  return Result.isSuccess(buildAddAccountPayload(input));
}

export function matchAddAccountPayload<T>(
  input: AddAccountFormInput,
  handlers: {
    success: (payload: AddAccountPayload) => T;
    failure: (error: AddAccountValidationError) => T;
  },
): T {
  const payloadResult = buildAddAccountPayload(input);
  return Result.isSuccess(payloadResult)
    ? handlers.success(Result.unwrap(payloadResult))
    : handlers.failure(Result.unwrapError(payloadResult));
}
