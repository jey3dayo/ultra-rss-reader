import { describe, expect, it } from "vitest";
import type { FeedDto, RemoteFeedSyncStatusDto } from "@/api/tauri-commands";
import { isBridgeFeedUrl, resolveRemoteFeedFetchFailures } from "@/lib/subscriptions/remote-feed-fetch-failure";

const BRIDGE_URL = "http://manga-feeds.freshrss.svc.cluster.local:8080/example/series-1.xml";

function feed(id: string, url: string): FeedDto {
  return {
    id,
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: id,
    url,
    site_url: "https://example.com",
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
  };
}

function status(feedId: string, lastSuccessAt: string | null): RemoteFeedSyncStatusDto {
  return { feed_id: feedId, last_success_at: lastSuccessAt };
}

describe("isBridgeFeedUrl", () => {
  it("matches the manga-rss-bridge cluster service only", () => {
    expect(isBridgeFeedUrl(BRIDGE_URL)).toBe(true);
    expect(isBridgeFeedUrl("http://manga-feeds:8080/example/series-1.xml")).toBe(true);
    expect(isBridgeFeedUrl("https://example.com/feed.xml")).toBe(false);
    expect(isBridgeFeedUrl("http://changedetection.freshrss.svc.cluster.local:8080/feed.xml")).toBe(false);
    expect(isBridgeFeedUrl("http://manga-feeds.example.com/feed.xml")).toBe(false);
    expect(isBridgeFeedUrl("not a url")).toBe(false);
  });
});

describe("resolveRemoteFeedFetchFailures", () => {
  const feeds = [
    feed("bridge-stopped", BRIDGE_URL),
    feed("bridge-active", "http://manga-feeds.freshrss.svc.cluster.local:8080/example/series-2.xml"),
    feed("official", "https://example.com/official.xml"),
  ];

  it("flags a bridge feed whose last success lags the account's freshest by 48h or more", () => {
    const failures = resolveRemoteFeedFetchFailures({
      feeds,
      statuses: [
        status("bridge-stopped", "2026-11-10T00:00:00Z"),
        status("bridge-active", "2026-11-20T00:00:00Z"),
        status("official", "2026-11-20T00:00:00Z"),
      ],
    });
    expect([...failures.keys()]).toEqual(["bridge-stopped"]);
    expect(failures.get("bridge-stopped")?.lastSuccessAt).toBe("2026-11-10T00:00:00Z");
  });

  it("does not flag non-bridge feeds even when their last success is old", () => {
    const failures = resolveRemoteFeedFetchFailures({
      feeds,
      statuses: [status("bridge-active", "2026-11-20T00:00:00Z"), status("official", "2026-11-01T00:00:00Z")],
    });
    expect(failures.size).toBe(0);
  });

  it("flags nothing when every feed stopped together (no lag)", () => {
    const failures = resolveRemoteFeedFetchFailures({
      feeds,
      statuses: [
        status("bridge-stopped", "2026-11-01T00:00:00Z"),
        status("bridge-active", "2026-11-01T12:00:00Z"),
        status("official", "2026-11-01T00:00:00Z"),
      ],
    });
    expect(failures.size).toBe(0);
  });

  it("ignores feeds that never succeeded and missing statuses", () => {
    const failures = resolveRemoteFeedFetchFailures({
      feeds,
      statuses: [status("bridge-stopped", null), status("bridge-active", "2026-11-20T00:00:00Z")],
    });
    expect(failures.size).toBe(0);
    expect(resolveRemoteFeedFetchFailures({ feeds, statuses: undefined }).size).toBe(0);
  });
});
