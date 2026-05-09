import { Result } from "@praha/byethrow";

export type AddAccountProviderKind = "Local" | "FreshRss";

export type AddAccountPayload = {
  kind: AddAccountProviderKind;
  name: string;
  serverUrl?: string;
  username?: string;
  password?: string;
};

export type AddAccountValidationError =
  | "missing_server_url"
  | "invalid_server_url"
  | "insecure_server_url"
  | "server_url_credentials"
  | "missing_username"
  | "missing_password";

export type AddAccountFormState = {
  kind: AddAccountProviderKind;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
};

export type AddAccountFormAction =
  | { type: "setKind"; value: AddAccountProviderKind }
  | { type: "setField"; field: "name" | "serverUrl" | "username" | "password"; value: string };

export const addAccountFormInitialState: AddAccountFormState = {
  kind: "Local",
  name: "",
  serverUrl: "",
  username: "",
  password: "",
};

export function addAccountFormReducer(state: AddAccountFormState, action: AddAccountFormAction): AddAccountFormState {
  switch (action.type) {
    case "setKind":
      return { ...state, kind: action.value };
    case "setField":
      return { ...state, [action.field]: action.value };
  }
}

type AddAccountFormInput = AddAccountFormState;

type AddAccountValidationMessageKey =
  | "account.error_server_url_required"
  | "account.error_server_url_invalid"
  | "account.error_username_required"
  | "account.error_password_required";

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
    case "insecure_server_url":
    case "server_url_credentials":
      return "account.error_server_url_invalid";
    case "missing_username":
      return "account.error_username_required";
    case "missing_password":
      return "account.error_password_required";
  }
}

type ServerUrlValidationResult = { ok: true; value: string } | { ok: false; error: AddAccountValidationError };

function isLoopbackFreshRssHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function validateFreshRssServerUrl(value: string): ServerUrlValidationResult {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "invalid_server_url" };
    }

    if (url.username || url.password) {
      return { ok: false, error: "server_url_credentials" };
    }

    if (url.protocol === "http:" && !isLoopbackFreshRssHost(url.hostname)) {
      return { ok: false, error: "insecure_server_url" };
    }

    return { ok: true, value: value.trim().replace(/\/+$/, "") };
  } catch {
    return { ok: false, error: "invalid_server_url" };
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
    if (!serverUrlResult.ok) {
      return Result.fail(serverUrlResult.error);
    }

    return Result.pipe(
      validateCredentials(input),
      Result.map((creds) => ({
        kind: input.kind,
        name,
        serverUrl: serverUrlResult.value,
        ...creds,
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
