import * as v from "valibot";
import * as s from "@/schemas/validation";

export const PackageJsonSchema = s.object({
  version: v.optional(v.string()),
  packageManager: v.optional(v.string()),
  private: v.optional(v.boolean()),
  type: v.optional(v.string()),
  engines: v.optional(s.record(v.string(), v.string())),
  scripts: v.optional(s.record(v.string(), v.string())),
  devDependencies: v.optional(s.record(v.string(), v.string())),
  knip: v.optional(
    s.object({
      ignoreDependencies: v.optional(v.array(v.string())),
    }),
  ),
});

export type PackageJson = v.InferOutput<typeof PackageJsonSchema>;

export const TauriUpdaterConfigSchema = s.object({
  bundle: v.optional(
    s.object({
      createUpdaterArtifacts: v.boolean(),
    }),
  ),
  plugins: s.object({
    updater: s.object({
      endpoints: v.array(v.string()),
      pubkey: v.string(),
    }),
  }),
});

export type TauriUpdaterConfig = v.InferOutput<typeof TauriUpdaterConfigSchema>;

export const TauriReleaseConfigSchema = s.object({
  identifier: v.string(),
  bundle: s.object({
    createUpdaterArtifacts: v.boolean(),
    macOS: v.optional(
      s.object({
        signingIdentity: v.string(),
      }),
    ),
  }),
});

export type TauriReleaseConfig = v.InferOutput<typeof TauriReleaseConfigSchema>;

export const TauriConfigSchema = s.object({
  $schema: v.optional(v.string()),
  productName: v.optional(v.string()),
  identifier: v.optional(v.string()),
  build: v.optional(
    s.object({
      beforeDevCommand: v.optional(v.string()),
      devUrl: v.optional(v.string()),
      beforeBuildCommand: v.optional(v.string()),
      frontendDist: v.optional(v.string()),
    }),
  ),
  app: v.optional(
    s.object({
      security: v.optional(
        s.object({
          csp: v.optional(v.string()),
        }),
      ),
      windows: v.optional(
        v.array(
          s.object({
            title: v.optional(v.string()),
          }),
        ),
      ),
    }),
  ),
});

export type TauriConfig = v.InferOutput<typeof TauriConfigSchema>;

const TauriCapabilityPermissionUrlSchema = s.object({
  url: v.string(),
});

export const TauriCapabilityPermissionSchema = v.union([
  v.string(),
  s.object({
    identifier: v.string(),
    allow: v.optional(v.array(TauriCapabilityPermissionUrlSchema)),
    deny: v.optional(v.array(TauriCapabilityPermissionUrlSchema)),
  }),
]);

export const TauriCapabilitySchema = s.object({
  identifier: v.optional(v.string()),
  webviews: v.optional(v.array(v.string())),
  permissions: v.array(TauriCapabilityPermissionSchema),
});

export const TauriCapabilityFileSchema = v.union([TauriCapabilitySchema, v.array(TauriCapabilitySchema)]);

export type TauriCapabilityPermission = v.InferOutput<typeof TauriCapabilityPermissionSchema>;
export type TauriCapability = v.InferOutput<typeof TauriCapabilitySchema>;
export type TauriCapabilityFile = v.InferOutput<typeof TauriCapabilityFileSchema>;
