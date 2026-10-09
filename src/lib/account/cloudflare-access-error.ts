import type { AppError } from "@/api/schemas";

export const CLOUDFLARE_ACCESS_RECOVERY_REQUIRED = "Cloudflare Access credential recovery required.";

// Only the backend-owned rollback suffix identifies recovery; its error prefix may contain credentials.
const ROLLBACK_RECOVERY_SUFFIX =
  / Credential rollback failed \(FreshRSS password: (failed|restored); Cloudflare Access: (failed|restored)\)\. Recovery required: re-enter credentials or remove Access in account settings before reconnecting\.$/;

export function isCloudflareAccessRollbackFailure(error: AppError): boolean {
  if (error.type !== "UserVisible") return false;
  const match = ROLLBACK_RECOVERY_SUFFIX.exec(error.message);
  return match !== null && (match[1] === "failed" || match[2] === "failed");
}

export function isCloudflareAccessRecoveryRequired(error: AppError): boolean {
  return error.type === "UserVisible" && error.message === CLOUDFLARE_ACCESS_RECOVERY_REQUIRED;
}
