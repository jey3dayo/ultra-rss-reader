import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { unwrapStrictObjectSchema } from "@/api/schemas/validation";

export const APP_ERROR_MESSAGE_MAX_CHARS = 2048;

function hasForbiddenControlCharacter(message: string): boolean {
  return [...message].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

const appErrorMessageSchema = v.pipe(
  v.string(),
  v.check((message) => message.trim().length > 0, "AppError message must not be empty"),
  v.maxLength(
    APP_ERROR_MESSAGE_MAX_CHARS,
    `AppError message must be ${APP_ERROR_MESSAGE_MAX_CHARS} characters or less`,
  ),
  v.check(
    (message) => !hasForbiddenControlCharacter(message),
    "AppError message must not contain newlines or control characters",
  ),
);

export const AppErrorSchema = v.variant("type", [
  unwrapStrictObjectSchema(s.strictObject({ type: v.literal("UserVisible"), message: appErrorMessageSchema })),
  unwrapStrictObjectSchema(s.strictObject({ type: v.literal("Retryable"), message: appErrorMessageSchema })),
  unwrapStrictObjectSchema(s.strictObject({ type: v.literal("Diagnostics"), message: appErrorMessageSchema })),
]);

export type AppError = v.InferOutput<typeof AppErrorSchema>;
