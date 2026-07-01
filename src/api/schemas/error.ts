import { z } from "zod";

export const APP_ERROR_MESSAGE_MAX_CHARS = 2048;

function hasForbiddenControlCharacter(message: string): boolean {
  return [...message].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

const appErrorMessageSchema = z
  .string()
  .refine((message) => message.trim().length > 0, {
    message: "AppError message must not be empty",
  })
  .max(APP_ERROR_MESSAGE_MAX_CHARS, {
    message: `AppError message must be ${APP_ERROR_MESSAGE_MAX_CHARS} characters or less`,
  })
  .refine((message) => !hasForbiddenControlCharacter(message), {
    message: "AppError message must not contain newlines or control characters",
  });

export const AppErrorSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("UserVisible"), message: appErrorMessageSchema }),
  z.strictObject({ type: z.literal("Retryable"), message: appErrorMessageSchema }),
  z.strictObject({ type: z.literal("Diagnostics"), message: appErrorMessageSchema }),
]);

export type AppError = z.infer<typeof AppErrorSchema>;
