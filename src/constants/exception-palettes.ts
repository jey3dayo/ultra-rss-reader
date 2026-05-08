export const exceptionSemanticToneRoles = ["danger", "warning", "success", "neutral"] as const;

export type ExceptionSemanticToneRole = (typeof exceptionSemanticToneRoles)[number];

type ExceptionSemanticToneTokens = {
  border: string;
  surface: string;
  foreground: string;
};

export const EXCEPTION_SEMANTIC_TONE_TOKENS = {
  danger: {
    border: "state-danger-border",
    surface: "state-danger-surface",
    foreground: "state-danger-foreground",
  },
  warning: {
    border: "state-warning-border",
    surface: "state-warning-surface",
    foreground: "state-warning-foreground",
  },
  success: {
    border: "state-success-border",
    surface: "state-success-surface",
    foreground: "state-success-foreground",
  },
  neutral: {
    border: "border",
    surface: "surface-1",
    foreground: "foreground-soft",
  },
} as const satisfies Record<ExceptionSemanticToneRole, ExceptionSemanticToneTokens>;
