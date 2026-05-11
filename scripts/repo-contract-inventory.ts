import { readdirSync, readFileSync } from "node:fs";

export type EnumDriftContract = {
  name: string;
  rust: readonly string[];
  typescript: readonly string[];
  labels: readonly string[];
  unknownFallback: string;
};

export type EnumDriftRow = {
  name: string;
  rust: string;
  typescript: string;
  labels: string;
  unknownFallback: string;
  drift: string;
};

export type MigrationInventory = {
  columnsByTable: Map<string, Set<string>>;
  indexes: Set<string>;
  tables: Set<string>;
};

export type RepositorySqlReference = {
  columns: readonly string[];
  file: string;
  indexes: readonly string[];
  sql: string;
  tables: readonly string[];
};

export type RepositorySqlInventoryReport = {
  dynamicSqlAllowlist: readonly string[];
  migrationInventory: MigrationInventory;
  parserLimits: readonly string[];
  references: readonly RepositorySqlReference[];
  unknownColumns: readonly string[];
  unknownIndexes: readonly string[];
  unknownTables: readonly string[];
};

const SQL_KEYWORDS = new Set([
  "abort",
  "after",
  "and",
  "as",
  "begin",
  "by",
  "cascade",
  "case",
  "collate",
  "conflict",
  "count",
  "create",
  "delete",
  "desc",
  "distinct",
  "else",
  "end",
  "exists",
  "from",
  "group",
  "if",
  "in",
  "index",
  "insert",
  "into",
  "is",
  "join",
  "left",
  "limit",
  "max",
  "min",
  "not",
  "null",
  "of",
  "on",
  "or",
  "order",
  "primary",
  "raise",
  "references",
  "replace",
  "select",
  "set",
  "table",
  "then",
  "trigger",
  "unique",
  "update",
  "values",
  "where",
]);

const SQLITE_INTERNAL_TABLES = new Set(["sqlite_master", "sqlite_stat1"]);

const DYNAMIC_SQL_ALLOWLIST = [
  "__ultra_rss_backup_metadata",
  "articles_fts",
  "idx_folders_account_name_nocase_unique",
  "idx_folders_account_sort_order_unique",
  "pragma",
  "probe",
  "sqlite_master",
  "sqlite_stat1",
  "vacuum_probe",
] as const;

const SQL_PARSER_LIMITS = [
  "The inventory parser checks repository SQL strings for migration-defined tables, indexes, and qualified or statement-local columns.",
  "Dynamic identifiers must stay on the explicit allowlist and should be backed by local validation before interpolation.",
  "SQLite virtual-table internals, PRAGMA output columns, and test-only probe tables are intentionally outside migration inventory.",
] as const;

const normalizeIdentifier = (value: string): string => value.replace(/^["'`[]|["'`\]]$/g, "");

const removeSqlComments = (source: string): string => source.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const splitCommaList = (source: string): string[] => {
  const values: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      values.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  values.push(source.slice(start).trim());
  return values.filter(Boolean);
};

const addColumn = (inventory: MigrationInventory, table: string, column: string): void => {
  const columns = inventory.columnsByTable.get(table) ?? new Set<string>();
  columns.add(column);
  inventory.columnsByTable.set(table, columns);
};

const createEmptyMigrationInventory = (): MigrationInventory => ({
  columnsByTable: new Map<string, Set<string>>(),
  indexes: new Set<string>(),
  tables: new Set<string>(),
});

export function buildEnumDriftRows(contracts: readonly EnumDriftContract[]): EnumDriftRow[] {
  return contracts.map((contract) => {
    const rust = [...contract.rust].sort();
    const typescript = [...contract.typescript].sort();
    const labels = [...contract.labels].sort();
    const missingInTypescript = rust.filter((variant) => !typescript.includes(variant));
    const deadTypescript = typescript.filter((variant) => !rust.includes(variant));
    const missingLabels = typescript.filter((variant) => !labels.includes(variant));
    const drift = [
      ...missingInTypescript.map((variant) => `missing-ts:${variant}`),
      ...deadTypescript.map((variant) => `dead-ts:${variant}`),
      ...missingLabels.map((variant) => `missing-label:${variant}`),
    ];

    return {
      name: contract.name,
      rust: rust.join(", "),
      typescript: typescript.join(", "),
      labels: labels.join(", "),
      unknownFallback: contract.unknownFallback,
      drift: drift.length > 0 ? drift.join(", ") : "ok",
    };
  });
}

export function formatEnumDriftTable(rows: readonly EnumDriftRow[]): string {
  return [
    "| Enum | Rust | TypeScript | Labels | Unknown fallback | Drift |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.name} | ${row.rust} | ${row.typescript} | ${row.labels} | ${row.unknownFallback} | ${row.drift} |`,
    ),
  ].join("\n");
}

export function parseMigrationInventory(migrationSources: readonly string[]): MigrationInventory {
  const inventory = createEmptyMigrationInventory();

  for (const source of migrationSources) {
    const sql = removeSqlComments(source);

    for (const match of sql.matchAll(
      /CREATE\s+(?:VIRTUAL\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)\s*\(([\s\S]*?)\);/gi,
    )) {
      const table = normalizeIdentifier(match[1] ?? "");
      const body = match[2] ?? "";
      inventory.tables.add(table);
      for (const definition of splitCommaList(body)) {
        const column = normalizeIdentifier(definition.match(/^\s*([A-Za-z_][\w]*)\b/)?.[1] ?? "");
        if (column && !["CHECK", "CONSTRAINT", "FOREIGN", "PRIMARY", "UNIQUE"].includes(column.toUpperCase())) {
          addColumn(inventory, table, column);
        }
      }
    }

    for (const match of sql.matchAll(/ALTER\s+TABLE\s+([A-Za-z_][\w]*)\s+ADD\s+COLUMN\s+([A-Za-z_][\w]*)/gi)) {
      const table = normalizeIdentifier(match[1] ?? "");
      const column = normalizeIdentifier(match[2] ?? "");
      if (table && column) {
        inventory.tables.add(table);
        addColumn(inventory, table, column);
      }
    }

    for (const match of sql.matchAll(
      /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)\s+ON\s+([A-Za-z_][\w]*)/gi,
    )) {
      const index = normalizeIdentifier(match[1] ?? "");
      const table = normalizeIdentifier(match[2] ?? "");
      if (index) {
        inventory.indexes.add(index);
      }
      if (table) {
        inventory.tables.add(table);
      }
    }
  }

  return inventory;
}

const extractRustStringLiterals = (source: string): string[] => {
  const literals: string[] = [];
  for (const match of source.matchAll(/"((?:\\.|[^"\\])*)"/gs)) {
    const literal = match[1]?.replace(/\\"/g, '"').replace(/\\n/g, "\n");
    if (literal && /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|PRAGMA)\b/i.test(literal)) {
      literals.push(literal);
    }
  }
  return literals;
};

const extractTableReferences = (sql: string): string[] => {
  const tables = new Set<string>();
  for (const match of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][\w]*)/gi)) {
    const table = normalizeIdentifier(match[1] ?? "");
    if (table && !SQL_KEYWORDS.has(table.toLowerCase())) {
      tables.add(table);
    }
  }
  for (const match of sql.matchAll(/\bCREATE\s+(?:VIRTUAL\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)/gi)) {
    const table = normalizeIdentifier(match[1] ?? "");
    if (table && !SQL_KEYWORDS.has(table.toLowerCase())) {
      tables.add(table);
    }
  }
  for (const match of sql.matchAll(/\bALTER\s+TABLE\s+([A-Za-z_][\w]*)/gi)) {
    const table = normalizeIdentifier(match[1] ?? "");
    if (table && !SQL_KEYWORDS.has(table.toLowerCase())) {
      tables.add(table);
    }
  }
  return [...tables].sort();
};

const extractIndexReferences = (sql: string): string[] => {
  const indexes = new Set<string>();
  for (const match of sql.matchAll(/\bINDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][\w]*)/gi)) {
    const index = normalizeIdentifier(match[1] ?? "");
    if (index) {
      indexes.add(index);
    }
  }
  return [...indexes].sort();
};

const extractStatementLocalColumns = (sql: string): string[] => {
  const columns = new Set<string>();

  for (const match of sql.matchAll(/\bINSERT(?:\s+OR\s+\w+)?\s+INTO\s+[A-Za-z_][\w]*\s*\(([^)]*)\)/gi)) {
    for (const column of splitCommaList(match[1] ?? "")) {
      columns.add(normalizeIdentifier(column));
    }
  }

  for (const match of sql.matchAll(
    /\bUPDATE\s+[A-Za-z_][\w]*\s+SET\s+([\s\S]*?)(?:\bWHERE\b|\bORDER\b|\bLIMIT\b|$)/gi,
  )) {
    for (const assignment of splitCommaList(match[1] ?? "")) {
      const column = normalizeIdentifier(assignment.match(/^\s*([A-Za-z_][\w]*)\s*=/)?.[1] ?? "");
      if (column) {
        columns.add(column);
      }
    }
  }

  return [...columns].sort();
};

const isAllowedDynamicIdentifier = (identifier: string): boolean =>
  DYNAMIC_SQL_ALLOWLIST.some((allowed) => identifier === allowed || identifier.startsWith(`${allowed}_`));

const hasColumnInAnyTable = (inventory: MigrationInventory, column: string): boolean =>
  [...inventory.columnsByTable.values()].some((columns) => columns.has(column));

export function analyzeRepositorySqlInventory(params: {
  migrationSources: readonly string[];
  repositorySources: readonly { file: string; source: string }[];
}): RepositorySqlInventoryReport {
  const migrationInventory = parseMigrationInventory(params.migrationSources);
  const references = params.repositorySources.flatMap(({ file, source }) =>
    extractRustStringLiterals(source).map((sql) => ({
      columns: extractStatementLocalColumns(sql),
      file,
      indexes: extractIndexReferences(sql),
      sql,
      tables: extractTableReferences(sql),
    })),
  );
  const knownTables = new Set([...migrationInventory.tables, ...SQLITE_INTERNAL_TABLES]);
  const unknownTables = new Set<string>();
  const unknownIndexes = new Set<string>();
  const unknownColumns = new Set<string>();

  for (const reference of references) {
    for (const table of reference.tables) {
      if (!knownTables.has(table) && !isAllowedDynamicIdentifier(table)) {
        unknownTables.add(`${reference.file}:${table}`);
      }
    }
    for (const index of reference.indexes) {
      if (!migrationInventory.indexes.has(index) && !isAllowedDynamicIdentifier(index)) {
        unknownIndexes.add(`${reference.file}:${index}`);
      }
    }
    for (const column of reference.columns) {
      const hasOnlyDynamicTables =
        reference.tables.length > 0 && reference.tables.every((table) => isAllowedDynamicIdentifier(table));
      if (hasOnlyDynamicTables) {
        continue;
      }
      if (!hasColumnInAnyTable(migrationInventory, column) && !isAllowedDynamicIdentifier(column)) {
        unknownColumns.add(`${reference.file}:${column}`);
      }
    }
  }

  return {
    dynamicSqlAllowlist: DYNAMIC_SQL_ALLOWLIST,
    migrationInventory,
    parserLimits: SQL_PARSER_LIMITS,
    references,
    unknownColumns: [...unknownColumns].sort(),
    unknownIndexes: [...unknownIndexes].sort(),
    unknownTables: [...unknownTables].sort(),
  };
}

export function readMigrationSources(migrationDir: string): string[] {
  return readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => readFileSync(`${migrationDir}/${fileName}`, "utf8"));
}

export function formatRepositorySqlInventoryReport(report: RepositorySqlInventoryReport): string {
  const tables = [...report.migrationInventory.tables].sort();
  const columns = tables.flatMap((table) =>
    [...(report.migrationInventory.columnsByTable.get(table) ?? [])].sort().map((column) => `${table}.${column}`),
  );

  return [
    `migration tables: ${tables.join(", ")}`,
    `migration columns: ${columns.join(", ")}`,
    `migration indexes: ${[...report.migrationInventory.indexes].sort().join(", ")}`,
    `repository SQL strings: ${report.references.length}`,
    `dynamic SQL allowlist: ${report.dynamicSqlAllowlist.join(", ")}`,
    `parser limits: ${report.parserLimits.join(" ")}`,
    `unknown tables: ${report.unknownTables.join(", ") || "none"}`,
    `unknown indexes: ${report.unknownIndexes.join(", ") || "none"}`,
    `unknown columns: ${report.unknownColumns.join(", ") || "none"}`,
  ].join("\n");
}
