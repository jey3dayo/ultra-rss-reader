export const FRONTEND_SCHEMA_CONTRACT_VERSION = 1;
export const QUERY_CACHE_KEY_VERSION = `schema-v${FRONTEND_SCHEMA_CONTRACT_VERSION}`;

export type SchemaParseFailureActionState = {
  enabled: false;
  reason: "schema-parse-failure";
};

export const SCHEMA_PARSE_FAILURE_ACTION_STATE = {
  enabled: false,
  reason: "schema-parse-failure",
} as const satisfies SchemaParseFailureActionState;

export function createSchemaVersionedQueryKey<const TRoot extends string>(
  root: TRoot,
): readonly [typeof QUERY_CACHE_KEY_VERSION, TRoot] {
  return [QUERY_CACHE_KEY_VERSION, root] as const;
}
