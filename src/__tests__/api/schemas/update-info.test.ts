import { describe, expect, it } from "vitest";
import { UpdateDownloadProgressEventPayloadSchema, UpdateReadyEventPayloadSchema } from "@/api/schemas/update-info";

describe("updater event payload schemas", () => {
  it("preserves unknown event fields while validating known drift-sensitive fields", () => {
    expect(
      UpdateDownloadProgressEventPayloadSchema.parse({
        session_id: 1,
        percent: 50,
        loaded: 1024,
        content_length: 2048,
      }),
    ).toEqual({
      session_id: 1,
      percent: 50,
      loaded: 1024,
      content_length: 2048,
    });
    expect(
      UpdateReadyEventPayloadSchema.parse({
        session_id: 2,
        artifact_path: "/tmp/update",
      }),
    ).toEqual({
      session_id: 2,
      artifact_path: "/tmp/update",
    });
  });

  it("rejects missing or malformed required updater event fields", () => {
    expect(UpdateDownloadProgressEventPayloadSchema.safeParse({ loaded: 100 }).success).toBe(false);
    expect(
      UpdateDownloadProgressEventPayloadSchema.safeParse({
        session_id: 1,
        percent: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(UpdateReadyEventPayloadSchema.safeParse({ session_id: 0 }).success).toBe(false);
  });
});
