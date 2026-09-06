import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { textEncoder } from "./shared";

// Must stay aligned with SETTINGS_PROFILE_IMPORT_MAX_BYTES in src-tauri/src/commands/settings_profile_commands/mod.rs.
export const SETTINGS_PROFILE_IMPORT_MAX_BYTES = 1024 * 1024;
export const SETTINGS_PROFILE_IMPORT_TOO_LARGE_MESSAGE = `Settings profile import file must be ${SETTINGS_PROFILE_IMPORT_MAX_BYTES} UTF-8 bytes or less`;

export const importSettingsProfileArgs = s.strictObject({
  profileJson: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1),
    v.check(
      (value) => textEncoder.encode(value).length <= SETTINGS_PROFILE_IMPORT_MAX_BYTES,
      SETTINGS_PROFILE_IMPORT_TOO_LARGE_MESSAGE,
    ),
  ),
});

export const exportSettingsProfileToFileArgs = s.strictObject({
  path: v.pipe(v.string(), v.trim(), v.minLength(1)),
});
