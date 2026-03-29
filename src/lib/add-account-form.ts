import { Result } from "@praha/byethrow";

export type AddAccountProviderKind = "Local" | "FreshRss" | "Inoreader";

export type AddAccountPayload = {
  kind: AddAccountProviderKind;
  name: string;
  serverUrl?: string;
  username?: string;
  password?: string;
};

export type AddAccountValidationError = "missing_server_url" | "missing_username" | "missing_password";

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

type AddAccountFormConfig = {
  sectionHeading: "Account" | "Server" | "Credentials";
  showServerUrl: boolean;
  credentialLabel: "Username" | "Email" | null;
  credentialName: "username" | "email" | null;
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
    case "Inoreader":
      return {
        sectionHeading: "Credentials",
        showServerUrl: false,
        credentialLabel: "Email",
        credentialName: "email",
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
  kind: AddAccountProviderKind,
  error: AddAccountValidationError,
): string {
  switch (error) {
    case "missing_server_url":
      return "Server URL is required";
    case "missing_username":
      return kind === "Inoreader" ? "Email is required" : "Username is required";
    case "missing_password":
      return "Password is required";
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

    return Result.pipe(
      validateCredentials(input),
      Result.map((creds) => ({ kind: input.kind, name, serverUrl, ...creds })),
    );
  }

  if (config.requiresCredentials) {
    return Result.pipe(
      validateCredentials(input),
      Result.map((creds) => ({ kind: input.kind, name, ...creds })),
    );
  }

  return Result.succeed({
    kind: input.kind,
    name,
  });
}
