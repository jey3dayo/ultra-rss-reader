type CommonMockStringArg =
  | "accountId"
  | "articleId"
  | "feedId"
  | "folderId"
  | "muteKeywordId"
  | "tagId"
  | "url"
  | "title"
  | "name"
  | "text";

type CommonMockBooleanArg = "background" | "read" | "starred" | "unreadOnly" | "starredOnly" | "enabled";

export type RawMockTauriCommandArgs = Record<string, unknown>;

/**
 * Args after the test Tauri IPC mock has applied the command args schema.
 * Recorder calls intentionally store this shape, not the raw IPC payload.
 */
export type ValidatedMockTauriCommandArgs = RawMockTauriCommandArgs &
  Record<CommonMockStringArg, string> &
  Record<CommonMockBooleanArg, boolean> &
  Record<"articleIds", string[]>;

/**
 * Schema output captured by the call recorder. It remains structurally broad
 * because this helper does not model command-specific validated arg shapes.
 */
export type ValidatedMockTauriRecordedArgs = Record<string, unknown>;

export type MockTauriCommandArgs = ValidatedMockTauriCommandArgs;

export type ValidatedMockTauriCommandCall = {
  cmd: string;
  args: ValidatedMockTauriRecordedArgs;
};

export type MockTauriCommandCall = ValidatedMockTauriCommandCall;
