import { describe, expect, it } from "vitest";
import {
  UpdateDownloadProgressEventPayloadSchema,
  UpdateInfoDtoSchema,
  UpdateReadyEventPayloadSchema,
} from "@/api/schemas/update-info";

describe("updater event payload schemas", () => {
  it("keeps update command responses strict while event payloads remain forward-compatible", () => {
    const updateInfo = {
      version: "1.2.3",
      body: null,
      channel: "stable",
      prerelease: false,
      source: "github",
    };

    expect(UpdateInfoDtoSchema.parse(updateInfo)).toEqual(updateInfo);
    expect(
      UpdateInfoDtoSchema.safeParse({
        ...updateInfo,
        future_response_field: "unexpected",
      }).success,
    ).toBe(false);
    expect(
      UpdateReadyEventPayloadSchema.parse({
        session_id: 2,
        future_event_field: "preserved",
      }),
    ).toEqual({
      session_id: 2,
      future_event_field: "preserved",
    });
  });

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
