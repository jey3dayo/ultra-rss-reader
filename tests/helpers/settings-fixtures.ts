import type { listAccounts, listMuteKeywords, listTags } from "@/api/tauri-commands";
import {
  type CommandListItem,
  cloneFixtureSeed,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
} from "./fixture-types";

type AccountFixture = CommandListItem<typeof listAccounts>;
type MuteKeywordFixture = CommandListItem<typeof listMuteKeywords>;
type TagFixture = CommandListItem<typeof listTags>;

export const sampleAccountSeeds: ReadonlyFixtureSeed<AccountFixture> = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    display_name: "Local",
    icon_url: null,
    capabilities: {
      supports_folders: false,
      supports_starring: false,
      supports_search: false,
      supports_delta_sync: false,
      supports_remote_state: false,
    },
    username: null,
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "freshrss",
    name: "FreshRSS",
    display_name: "FreshRSS",
    icon_url: null,
    capabilities: {
      supports_folders: true,
      supports_starring: true,
      supports_search: true,
      supports_delta_sync: true,
      supports_remote_state: true,
    },
    username: "user",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

export const sampleMuteKeywordSeeds: ReadonlyFixtureSeed<MuteKeywordFixture> = [
  {
    id: "mute-1",
    keyword: "Kindle Unlimited",
    scope: "title_and_body",
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T01:00:00Z",
  },
];

export const sampleTagSeeds: ReadonlyFixtureSeed<TagFixture> = [
  {
    id: "tag-1",
    name: "Tech",
    color: "#6f8eb8",
  },
  {
    id: "tag-2",
    name: "Later",
    color: null,
  },
];

export const sampleAccounts: MutableTestFixture<AccountFixture> = cloneFixtureSeed(sampleAccountSeeds);
export const sampleMuteKeywords: MutableTestFixture<MuteKeywordFixture> = cloneFixtureSeed(sampleMuteKeywordSeeds);
export const sampleTags: MutableTestFixture<TagFixture> = cloneFixtureSeed(sampleTagSeeds);

export function createSampleAccounts(): MutableTestFixture<AccountFixture> {
  return cloneFixtureSeed(sampleAccountSeeds);
}

export function createSampleMuteKeywords(): MutableTestFixture<MuteKeywordFixture> {
  return cloneFixtureSeed(sampleMuteKeywordSeeds);
}

export function createSampleTags(): MutableTestFixture<TagFixture> {
  return cloneFixtureSeed(sampleTagSeeds);
}
