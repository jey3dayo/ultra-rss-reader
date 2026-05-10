import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@praha/byethrow";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { TagDtoSchema } from "@/api/schemas";
import {
  ACCOUNT_NAME_MAX_CHARS,
  addAccountArgs,
  addLocalFeedArgs,
  addToReadingListArgs,
  copyToClipboardArgs,
  createFolderArgs,
  createTagArgs,
  discoverFeedsArgs,
  FEED_TITLE_MAX_CHARS,
  FOLDER_NAME_MAX_CHARS,
  normalizeTagColorForCommand,
  normalizeTagColorForView,
  openExternalUrlArgs,
  openInBrowserArgs,
  READING_LIST_URL_MAX_BYTES,
  renameAccountArgs,
  renameFeedArgs,
  renameTagArgs,
  SHARE_COMMAND_TEXT_MAX_BYTES,
  SHARE_COMMAND_TEXT_MAX_CHARS,
  TAG_COLOR_VALIDATION_MESSAGE,
  TAG_NAME_MAX_CHARS,
} from "@/api/schemas/commands";
import { createTag, renameAccount, renameFeed, renameTag } from "@/api/tauri-commands";

function readRustCommandSource(fileName: string) {
  return readFileSync(join(process.cwd(), "src-tauri/src/commands", fileName), "utf8");
}

function readRustDomainSource(fileName: string) {
  return readFileSync(join(process.cwd(), "src-tauri/src/domain", fileName), "utf8");
}

function extractRustUsizeConst(source: string, constName: string) {
  const match = source.match(new RegExp(`(?:pub )?const ${constName}: usize = (\\d+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1]);
}

function extractRustValidationLimit(source: string, messagePrefix: string) {
  const match = source.match(new RegExp(`${messagePrefix} must be (\\d+) characters or less`));
  expect(match, `${messagePrefix} max length validation should exist`).not.toBeNull();
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
    ).toThrow(`Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`);
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
    ).toThrow(`Folder name must be ${FOLDER_NAME_MAX_CHARS} characters or less`);
    expect(() =>
      renameTagArgs.parse({
        tagId: "tag-1",
        name: "a".repeat(TAG_NAME_MAX_CHARS + 1),
      }),
    ).toThrow(`Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`);

    expect(extractRustValidationLimit(readRustCommandSource("account_commands.rs"), "Account name")).toBe(
      ACCOUNT_NAME_MAX_CHARS,
    );
    expect(extractRustUsizeConst(readRustCommandSource("feed_commands.rs"), "FEED_TITLE_MAX_CHARS")).toBe(
      FEED_TITLE_MAX_CHARS,
    );
    expect(extractRustUsizeConst(readRustDomainSource("folder.rs"), "FOLDER_NAME_MAX_CHARS")).toBe(
      FOLDER_NAME_MAX_CHARS,
    );
    expect(extractRustValidationLimit(readRustCommandSource("tag_commands.rs"), "Tag name")).toBe(TAG_NAME_MAX_CHARS);
  });

  it("normalizes tag colors with the same command and view helper contract", () => {
    expect(renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#Cf7868" })).toEqual({
      tagId: "tag-1",
      name: "Review",
      color: "#cf7868",
    });
    expect(renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "   " })).toEqual({
      tagId: "tag-1",
      name: "Review",
      color: null,
    });
    expect(renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: null })).toEqual({
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
    expect(TagDtoSchema.parse({ id: "tag-1", name: "Review", color: "#ABCDEF" }).color).toBe("#abcdef");

    expect(() => renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#fff" })).toThrow(
      TAG_COLOR_VALIDATION_MESSAGE,
    );
    expect(() => renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "ff0000" })).toThrow(
      TAG_COLOR_VALIDATION_MESSAGE,
    );
    expect(() => renameTagArgs.parse({ tagId: "tag-1", name: "Review", color: "#gg0000" })).toThrow(
      TAG_COLOR_VALIDATION_MESSAGE,
    );
    expect(readRustCommandSource("tag_commands.rs")).toContain(TAG_COLOR_VALIDATION_MESSAGE);
  });

  it("rejects max length drift and invalid tag colors before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "rename_account" || cmd === "rename_feed" || cmd === "rename_tag") {
        invoked = true;
      }
      return null;
    });

    const accountResult = await renameAccount("acc-1", "a".repeat(ACCOUNT_NAME_MAX_CHARS + 1));
    const feedResult = await renameFeed("feed-1", "a".repeat(FEED_TITLE_MAX_CHARS + 1));
    const tagNameResult = await renameTag("tag-1", "a".repeat(TAG_NAME_MAX_CHARS + 1), null);
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
    expect(Result.unwrapError(tagColorResult).message).toContain(TAG_COLOR_VALIDATION_MESSAGE);
    expect(invoked).toBe(false);
  });

  it("normalizes valid tag colors before invoking Tauri", async () => {
    const invokedArgs: unknown[] = [];
    setupTauriMocks((cmd, args) => {
      if (cmd === "create_tag" || cmd === "rename_tag") {
        invokedArgs.push(args);
      }
      return cmd === "create_tag" || cmd === "rename_tag" ? { id: "tag-1", name: "Review", color: "#cf7868" } : null;
    });

    Result.unwrap(await createTag("Review", "#Cf7868"));
    Result.unwrap(await renameTag("tag-1", "Review", "   "));

    expect(invokedArgs).toEqual([
      { name: "Review", color: "#cf7868" },
      { tagId: "tag-1", name: "Review", color: null },
    ]);
  });

  it("aligns Local account blank credential policy with FreshRSS command args", () => {
    expect(
      addAccountArgs.parse({
        kind: "Local",
        name: " Local ",
        serverUrl: "   ",
        appId: "   ",
        appKey: "   ",
        username: "   ",
        password: "   ",
      }),
    ).toEqual({
      kind: "Local",
      name: "Local",
      serverUrl: undefined,
      appId: undefined,
      appKey: undefined,
      username: undefined,
      password: undefined,
    });
    expect(addAccountArgs.parse({ kind: "Local", name: "Local" })).toEqual({
      kind: "Local",
      name: "Local",
    });

    expect(() =>
      addAccountArgs.parse({
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "   ",
        username: "reader",
        password: "secret",
      }),
    ).toThrow();
    expect(() =>
      addAccountArgs.parse({
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "https://example.com",
        username: "   ",
        password: "secret",
      }),
    ).toThrow();
  });

  it("aligns feed discovery and add URL schemas with browser/open HTTP URL schemas", () => {
    const cases = [
      {
        label: "uppercase scheme",
        input: " HTTPS://example.com/feed.xml ",
        expected: "HTTPS://example.com/feed.xml",
        valid: true,
      },
      {
        label: "https URL",
        input: "https://example.com/feed.xml",
        expected: "https://example.com/feed.xml",
        valid: true,
      },
      {
        label: "http URL",
        input: "http://example.com/feed.xml",
        expected: "http://example.com/feed.xml",
        valid: true,
      },
      { label: "ftp URL", input: "ftp://example.com/feed.xml", valid: false },
      { label: "mailto URL", input: "mailto:reader@example.com", valid: false },
      { label: "newline URL", input: "https://example.com/\nfeed.xml", valid: false },
    ] satisfies Array<{ label: string; input: string; expected?: string; valid: boolean }>;

    for (const { input, expected, valid } of cases) {
      const parsers = [
        () => discoverFeedsArgs.parse({ url: input }),
        () => addLocalFeedArgs.parse({ accountId: "acc-1", url: input }),
        () => openInBrowserArgs.parse({ url: input }),
      ];

      for (const parse of parsers) {
        if (valid) {
          expect(parse().url).toBe(expected);
        } else {
          expect(parse).toThrow();
        }
      }
    }
  });

  it("aligns external URL uppercase scheme policy with browser/open commands", () => {
    expect(openExternalUrlArgs.parse({ url: " HTTPS://example.com/article " })).toEqual({
      url: "HTTPS://example.com/article",
    });
    expect(openExternalUrlArgs.parse({ url: " MAILTO:reader@example.com " })).toEqual({
      url: "MAILTO:reader@example.com",
    });
    expect(openInBrowserArgs.parse({ url: " HTTPS://example.com/article " })).toEqual({
      url: "HTTPS://example.com/article",
    });

    expect(() => openExternalUrlArgs.parse({ url: "javascript:alert(1)" })).toThrow();
    expect(() => openExternalUrlArgs.parse({ url: "https://example.com/\rarticle" })).toThrow();
    expect(() => openInBrowserArgs.parse({ url: "MAILTO:reader@example.com" })).toThrow();
  });

  it("fixes Safari Reading List URL control, whitespace, credential, and length policy", () => {
    expect(addToReadingListArgs.parse({ url: " HTTPS://example.com/article " })).toEqual({
      url: "HTTPS://example.com/article",
    });

    const maxUrl = `https://example.com/article?token=${"x".repeat(
      READING_LIST_URL_MAX_BYTES - "https://example.com/article?token=".length,
    )}`;
    expect(addToReadingListArgs.parse({ url: maxUrl })).toEqual({
      url: maxUrl,
    });

    for (const url of [
      "https://example.com/a\tb",
      "https://example.com/a\u0000b",
      "https://example.com/a b",
      "https://user@example.com/article",
      "https://user:pass@example.com/article",
      `${maxUrl}x`,
    ]) {
      expect(() => addToReadingListArgs.parse({ url })).toThrow();
    }
  });

  it("fixes clipboard text policy by control characters, graphemes, and UTF-8 bytes", () => {
    expect(
      copyToClipboardArgs.parse({
        text: "🙂".repeat(SHARE_COMMAND_TEXT_MAX_CHARS),
      }).text,
    ).toBe("🙂".repeat(SHARE_COMMAND_TEXT_MAX_CHARS));
    expect(copyToClipboardArgs.parse({ text: `e${"\u0301".repeat(16)}` }).text).toBe(`e${"\u0301".repeat(16)}`);
    expect(copyToClipboardArgs.parse({ text: "👨‍👩‍👧‍👦" }).text).toBe("👨‍👩‍👧‍👦");

    for (const text of ["hello\u0000", "hello\tworld", "hello\nworld"]) {
      expect(() => copyToClipboardArgs.parse({ text })).toThrow();
    }

    expect(() =>
      copyToClipboardArgs.parse({
        text: "x".repeat(SHARE_COMMAND_TEXT_MAX_CHARS + 1),
      }),
    ).toThrow();
    expect(() =>
      copyToClipboardArgs.parse({
        text: `e${"\u0301".repeat(SHARE_COMMAND_TEXT_MAX_BYTES / 2 + 1)}`,
      }),
    ).toThrow();
  });
});
