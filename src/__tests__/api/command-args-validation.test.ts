import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@praha/byethrow";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { TagDtoSchema } from "@/api/schemas";
import {
  ACCOUNT_NAME_MAX_CHARS,
  createFolderArgs,
  createTagArgs,
  FEED_TITLE_MAX_CHARS,
  FOLDER_NAME_MAX_CHARS,
  normalizeTagColorForCommand,
  normalizeTagColorForView,
  renameAccountArgs,
  renameFeedArgs,
  renameTagArgs,
  TAG_COLOR_VALIDATION_MESSAGE,
  TAG_NAME_MAX_CHARS,
} from "@/api/schemas/commands";
import {
  createTag,
  renameAccount,
  renameFeed,
  renameTag,
} from "@/api/tauri-commands";

function readRustCommandSource(fileName: string) {
  return readFileSync(
    join(process.cwd(), "src-tauri/src/commands", fileName),
    "utf8",
  );
}

function extractRustUsizeConst(source: string, constName: string) {
  const match = source.match(new RegExp(`const ${constName}: usize = (\\d+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1]);
}

function extractRustValidationLimit(source: string, messagePrefix: string) {
  const match = source.match(
    new RegExp(`${messagePrefix} must be (\\d+) characters or less`),
  );
  expect(
    match,
    `${messagePrefix} max length validation should exist`,
  ).not.toBeNull();
  return Number(match?.[1]);
}

describe("command args validation parity", () => {
  it("keeps frontend command name lengths aligned with Rust validation", () => {
    expect(
      renameAccountArgs.parse({
        accountId: "acc-1",
        name: ` ${"a".repeat(ACCOUNT_NAME_MAX_CHARS)} `,
      }),
    ).toEqual({
      accountId: "acc-1",
      name: "a".repeat(ACCOUNT_NAME_MAX_CHARS),
    });
    expect(
      renameFeedArgs.parse({
        feedId: "feed-1",
        title: ` ${"a".repeat(FEED_TITLE_MAX_CHARS)} `,
      }),
    ).toEqual({
      feedId: "feed-1",
      title: "a".repeat(FEED_TITLE_MAX_CHARS),
    });
    expect(
      createFolderArgs.parse({
        accountId: "acc-1",
        name: ` ${"a".repeat(FOLDER_NAME_MAX_CHARS)} `,
      }),
    ).toEqual({
      accountId: "acc-1",
      name: "a".repeat(FOLDER_NAME_MAX_CHARS),
    });
    expect(
      renameTagArgs.parse({
        tagId: "tag-1",
        name: ` ${"a".repeat(TAG_NAME_MAX_CHARS)} `,
      }),
    ).toEqual({
      tagId: "tag-1",
      name: "a".repeat(TAG_NAME_MAX_CHARS),
    });

    expect(() =>
      renameAccountArgs.parse({
        accountId: "acc-1",
        name: "a".repeat(ACCOUNT_NAME_MAX_CHARS + 1),
      }),
    ).toThrow(
      `Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`,
    );
    expect(() =>
      renameFeedArgs.parse({
        feedId: "feed-1",
        title: "a".repeat(FEED_TITLE_MAX_CHARS + 1),
      }),
    ).toThrow(`Feed title must be ${FEED_TITLE_MAX_CHARS} characters or less`);
    expect(() =>
      createFolderArgs.parse({
        accountId: "acc-1",
        name: "a".repeat(FOLDER_NAME_MAX_CHARS + 1),
      }),
    ).toThrow(
      `Folder name must be ${FOLDER_NAME_MAX_CHARS} characters or less`,
    );
    expect(() =>
      renameTagArgs.parse({
        tagId: "tag-1",
        name: "a".repeat(TAG_NAME_MAX_CHARS + 1),
      }),
    ).toThrow(`Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`);

    expect(
      extractRustValidationLimit(
        readRustCommandSource("account_commands.rs"),
        "Account name",
      ),
    ).toBe(ACCOUNT_NAME_MAX_CHARS);
    expect(
      extractRustUsizeConst(
        readRustCommandSource("feed_commands.rs"),
        "FEED_TITLE_MAX_CHARS",
      ),
    ).toBe(FEED_TITLE_MAX_CHARS);
    expect(
      extractRustUsizeConst(
        readRustCommandSource("feed_commands.rs"),
        "FOLDER_NAME_MAX_CHARS",
      ),
    ).toBe(FOLDER_NAME_MAX_CHARS);
    expect(
      extractRustValidationLimit(
        readRustCommandSource("tag_commands.rs"),
        "Tag name",
      ),
    ).toBe(TAG_NAME_MAX_CHARS);
  });

  it("normalizes tag colors with the same command and view helper contract", () => {
    expect(
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#Cf7868" }),
    ).toEqual({
      tagId: "tag-1",
      name: "Review",
      color: "#cf7868",
    });
    expect(
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "   " }),
    ).toEqual({
      tagId: "tag-1",
      name: "Review",
      color: null,
    });
    expect(
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: null }),
    ).toEqual({
      tagId: "tag-1",
      name: "Review",
      color: null,
    });
    expect(createTagArgs.parse({ name: "Review", color: "   " })).toEqual({
      name: "Review",
      color: undefined,
    });
    expect(normalizeTagColorForCommand("#FF0000")).toBe("#ff0000");
    expect(normalizeTagColorForCommand("   ")).toBeNull();
    expect(normalizeTagColorForView("#Cf7868")).toBe("#cf7868");
    expect(normalizeTagColorForView("#fff")).toBeNull();
    expect(
      TagDtoSchema.parse({ id: "tag-1", name: "Review", color: "#ABCDEF" })
        .color,
    ).toBe("#abcdef");

    expect(() =>
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#fff" }),
    ).toThrow(TAG_COLOR_VALIDATION_MESSAGE);
    expect(() =>
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "ff0000" }),
    ).toThrow(TAG_COLOR_VALIDATION_MESSAGE);
    expect(() =>
      renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#gg0000" }),
    ).toThrow(TAG_COLOR_VALIDATION_MESSAGE);
    expect(readRustCommandSource("tag_commands.rs")).toContain(
      TAG_COLOR_VALIDATION_MESSAGE,
    );
  });

  it("rejects max length drift and invalid tag colors before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (
        cmd === "rename_account" ||
        cmd === "rename_feed" ||
        cmd === "rename_tag"
      ) {
        invoked = true;
      }
      return null;
    });

    const accountResult = await renameAccount(
      "acc-1",
      "a".repeat(ACCOUNT_NAME_MAX_CHARS + 1),
    );
    const feedResult = await renameFeed(
      "feed-1",
      "a".repeat(FEED_TITLE_MAX_CHARS + 1),
    );
    const tagNameResult = await renameTag(
      "tag-1",
      "a".repeat(TAG_NAME_MAX_CHARS + 1),
      null,
    );
    const tagColorResult = await renameTag("tag-1", "Review", "#fff");

    expect(Result.isFailure(accountResult)).toBe(true);
    expect(Result.isFailure(feedResult)).toBe(true);
    expect(Result.isFailure(tagNameResult)).toBe(true);
    expect(Result.isFailure(tagColorResult)).toBe(true);
    expect(Result.unwrapError(accountResult).message).toContain(
      `Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`,
    );
    expect(Result.unwrapError(feedResult).message).toContain(
      `Feed title must be ${FEED_TITLE_MAX_CHARS} characters or less`,
    );
    expect(Result.unwrapError(tagNameResult).message).toContain(
      `Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`,
    );
    expect(Result.unwrapError(tagColorResult).message).toContain(
      TAG_COLOR_VALIDATION_MESSAGE,
    );
    expect(invoked).toBe(false);
  });

  it("normalizes valid tag colors before invoking Tauri", async () => {
    const invokedArgs: unknown[] = [];
    setupTauriMocks((cmd, args) => {
      if (cmd === "create_tag" || cmd === "rename_tag") {
        invokedArgs.push(args);
      }
      return cmd === "create_tag" || cmd === "rename_tag"
        ? { id: "tag-1", name: "Review", color: "#cf7868" }
        : null;
    });

    Result.unwrap(await createTag("Review", "#Cf7868"));
    Result.unwrap(await renameTag("tag-1", "Review", "   "));

    expect(invokedArgs).toEqual([
      { name: "Review", color: "#cf7868" },
      { tagId: "tag-1", name: "Review", color: null },
    ]);
  });
});
