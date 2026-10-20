import * as s from "@/api/schemas/validation";
import { CredentialStorageKindSchema } from "../platform-info";

export const setCredentialStorageArgs = s.object({
  storage: CredentialStorageKindSchema,
});
