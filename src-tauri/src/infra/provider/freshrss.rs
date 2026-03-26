use async_trait::async_trait;
use chrono::DateTime;
use reqwest::header::HeaderValue;
use serde::Deserialize;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::traits::{Credentials, FeedProvider};

// --- Google Reader API response types ---

#[derive(Deserialize)]
struct SubscriptionListResponse {
    subscriptions: Vec<GReaderSubscription>,
}

#[derive(Deserialize)]
struct GReaderSubscription {
    id: String,
    title: String,
    url: String,
    #[serde(rename = "htmlUrl")]
    html_url: String,
    categories: Vec<GReaderCategory>,
    #[serde(rename = "iconUrl")]
    icon_url: Option<String>,
}

#[derive(Deserialize)]
struct GReaderCategory {
    id: String,
    #[allow(dead_code)]
    label: String,
}

#[derive(Deserialize)]
struct StreamContentsResponse {
    items: Vec<GReaderItem>,
    continuation: Option<String>,
}

#[derive(Deserialize)]
struct GReaderItem {
    id: String,
    title: Option<String>,
    #[allow(dead_code)]
    canonical: Option<Vec<GReaderLink>>,
    alternate: Option<Vec<GReaderLink>>,
    summary: Option<GReaderContent>,
    content: Option<GReaderContent>,
    author: Option<String>,
    published: Option<i64>,
    updated: Option<i64>,
    origin: Option<GReaderOrigin>,
    categories: Vec<String>,
}

#[derive(Deserialize)]
struct GReaderLink {
    href: String,
}

#[derive(Deserialize)]
struct GReaderContent {
    content: String,
}

#[derive(Deserialize)]
struct GReaderOrigin {
    #[serde(rename = "streamId")]
    stream_id: String,
    #[allow(dead_code)]
    title: Option<String>,
}

#[derive(Deserialize)]
struct TagListResponse {
    tags: Vec<GReaderTag>,
}

#[derive(Deserialize)]
struct GReaderTag {
    id: String,
}

#[derive(Deserialize)]
struct StreamItemIdsResponse {
    #[serde(rename = "itemRefs")]
    item_refs: Option<Vec<ItemRef>>,
}

#[derive(Deserialize)]
struct ItemRef {
    id: String,
}

// --- Constants ---

const STATE_READ: &str = "user/-/state/com.google/read";
const STATE_STARRED: &str = "user/-/state/com.google/starred";
const STATE_READING_LIST: &str = "user/-/state/com.google/reading-list";
const LABEL_PREFIX: &str = "user/-/label/";

// --- Provider ---

pub struct FreshRssProvider {
    http_client: reqwest::Client,
    server_url: String,
    auth_token: Option<String>,
}

impl FreshRssProvider {
    pub fn new(server_url: &str) -> Self {
        Self {
            http_client: reqwest::Client::new(),
            server_url: server_url.trim_end_matches('/').to_string(),
            auth_token: None,
        }
    }

    fn api_url(&self, path: &str) -> String {
        format!("{}/api/greader.php{}", self.server_url, path)
    }

    fn auth_header(&self) -> DomainResult<HeaderValue> {
        let token = self
            .auth_token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Not authenticated".into()))?;
        HeaderValue::from_str(&format!("GoogleLogin auth={token}"))
            .map_err(|e| DomainError::Auth(e.to_string()))
    }

    fn map_item_to_entry(item: GReaderItem) -> Option<RemoteEntry> {
        let origin = item.origin?;

        let url = item
            .alternate
            .as_ref()
            .and_then(|links| links.first())
            .map(|l| l.href.clone());

        let content = item
            .content
            .map(|c| c.content)
            .or_else(|| item.summary.as_ref().map(|s| s.content.clone()))
            .unwrap_or_default();

        let summary = item.summary.map(|s| s.content);

        let is_read = if item.categories.iter().any(|c| c.contains(STATE_READ)) {
            Some(true)
        } else {
            Some(false)
        };

        let is_starred = if item.categories.iter().any(|c| c.contains(STATE_STARRED)) {
            Some(true)
        } else {
            Some(false)
        };

        let published_at = item
            .published
            .and_then(|ts| DateTime::from_timestamp(ts, 0));

        let updated_at = item.updated.and_then(|ts| DateTime::from_timestamp(ts, 0));

        Some(RemoteEntry {
            id: Some(item.id),
            source_feed_id: FeedIdentifier::Remote {
                remote_id: origin.stream_id,
            },
            title: item.title.unwrap_or_default(),
            content,
            summary,
            url,
            published_at,
            updated_at,
            thumbnail: None,
            author: item.author,
            is_read,
            is_starred,
        })
    }
}

#[async_trait]
impl FeedProvider for FreshRssProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::FreshRss
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_folders: true,
            supports_starring: true,
            supports_search: true,
            supports_delta_sync: true,
            supports_remote_state: true,
        }
    }

    async fn authenticate(&mut self, credentials: &Credentials) -> DomainResult<()> {
        let password = credentials
            .password
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Password is required".into()))?;

        // The Email field is stored in token for FreshRSS (username)
        let username = credentials
            .token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Username is required".into()))?;

        let url = self.api_url("/accounts/ClientLogin");
        let body = format!(
            "Email={}&Passwd={}",
            urlencoded(username),
            urlencoded(password)
        );

        let response = self
            .http_client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(DomainError::Auth(format!(
                "Authentication failed: {}",
                response.status()
            )));
        }

        let text = response.text().await?;
        let auth_token = text
            .lines()
            .find_map(|line| line.strip_prefix("Auth="))
            .map(|s| s.to_string())
            .ok_or_else(|| DomainError::Auth("Auth token not found in response".into()))?;

        self.auth_token = Some(auth_token);
        Ok(())
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        let url = self.api_url("/reader/api/0/subscription/list?output=json");
        let resp: SubscriptionListResponse = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let subscriptions = resp
            .subscriptions
            .into_iter()
            .map(|s| {
                let folder_remote_id = s.categories.first().map(|c| c.id.clone());
                RemoteSubscription {
                    remote_id: s.id,
                    title: s.title,
                    url: s.url,
                    site_url: s.html_url,
                    folder_remote_id,
                    icon_url: s.icon_url,
                }
            })
            .collect();

        Ok(subscriptions)
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        let url = self.api_url("/reader/api/0/tag/list?output=json");
        let resp: TagListResponse = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let folders = resp
            .tags
            .into_iter()
            .filter_map(|tag| {
                tag.id.strip_prefix(LABEL_PREFIX).map(|label| RemoteFolder {
                    remote_id: tag.id.clone(),
                    name: label.to_string(),
                    sort_order: None,
                })
            })
            .collect();

        Ok(folders)
    }

    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        let (stream_id, exclude_target) = match &scope {
            PullScope::Feed(FeedIdentifier::Remote { remote_id }) => (remote_id.clone(), None),
            PullScope::Feed(FeedIdentifier::Local { .. }) => {
                return Err(DomainError::Validation(
                    "FreshRssProvider does not support local feeds".into(),
                ));
            }
            PullScope::All => (STATE_READING_LIST.to_string(), None),
            PullScope::Unread => (STATE_READING_LIST.to_string(), Some(STATE_READ.to_string())),
            PullScope::Starred => (STATE_STARRED.to_string(), None),
        };

        let mut url = format!(
            "{}?output=json&n=50",
            self.api_url(&format!(
                "/reader/api/0/stream/contents/{}",
                urlencoded(&stream_id)
            ))
        );

        if let Some(ref xt) = exclude_target {
            url.push_str(&format!("&xt={}", urlencoded(xt)));
        }

        if let Some(ref c) = cursor {
            if let Some(ref cont) = c.continuation {
                url.push_str(&format!("&c={}", urlencoded(cont)));
            }
        }

        let resp: StreamContentsResponse = self
            .http_client
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?
            .json()
            .await?;

        let has_more = resp.continuation.is_some();
        let next_cursor = resp.continuation.map(|c| SyncCursor {
            continuation: Some(c),
            ..Default::default()
        });

        let entries = resp
            .items
            .into_iter()
            .filter_map(Self::map_item_to_entry)
            .collect();

        Ok(PullResult {
            entries,
            next_cursor,
            has_more,
        })
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        let read_url = format!(
            "{}?output=json&n=10000",
            self.api_url(&format!(
                "/reader/api/0/stream/items/ids?s={}",
                urlencoded(STATE_READ)
            ))
        );

        let starred_url = format!(
            "{}?output=json&n=10000",
            self.api_url(&format!(
                "/reader/api/0/stream/items/ids?s={}",
                urlencoded(STATE_STARRED)
            ))
        );

        let auth = self.auth_header()?;

        let (read_resp, starred_resp) = tokio::try_join!(
            async {
                self.http_client
                    .get(&read_url)
                    .header("Authorization", auth.clone())
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| DomainError::Network(e.to_string()))?
                    .json::<StreamItemIdsResponse>()
                    .await
                    .map_err(DomainError::from)
            },
            async {
                self.http_client
                    .get(&starred_url)
                    .header("Authorization", auth.clone())
                    .send()
                    .await?
                    .error_for_status()
                    .map_err(|e| DomainError::Network(e.to_string()))?
                    .json::<StreamItemIdsResponse>()
                    .await
                    .map_err(DomainError::from)
            }
        )?;

        let read_ids = read_resp
            .item_refs
            .unwrap_or_default()
            .into_iter()
            .map(|r| r.id)
            .collect();

        let starred_ids = starred_resp
            .item_refs
            .unwrap_or_default()
            .into_iter()
            .map(|r| r.id)
            .collect();

        Ok(RemoteState {
            read_ids,
            starred_ids,
        })
    }

    async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()> {
        let url = self.api_url("/reader/api/0/edit-tag");
        let auth = self.auth_header()?;

        for mutation in mutations {
            let body = match mutation {
                Mutation::MarkRead { remote_entry_id } => {
                    format!(
                        "i={}&a={}",
                        urlencoded(remote_entry_id),
                        urlencoded(STATE_READ)
                    )
                }
                Mutation::MarkUnread { remote_entry_id } => {
                    format!(
                        "i={}&r={}",
                        urlencoded(remote_entry_id),
                        urlencoded(STATE_READ)
                    )
                }
                Mutation::SetStarred {
                    remote_entry_id,
                    starred,
                } => {
                    let action = if *starred { "a" } else { "r" };
                    format!(
                        "i={}&{}={}",
                        urlencoded(remote_entry_id),
                        action,
                        urlencoded(STATE_STARRED)
                    )
                }
            };

            self.http_client
                .post(&url)
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await?
                .error_for_status()
                .map_err(|e| DomainError::Network(e.to_string()))?;
        }

        Ok(())
    }

    async fn create_subscription(
        &self,
        url: &str,
        folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        let api_url = self.api_url("/reader/api/0/subscription/quickadd");
        let auth = self.auth_header()?;

        let mut body = format!("quickadd={}", urlencoded(url));
        if let Some(folder_name) = folder {
            body.push_str(&format!(
                "&a={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }

        let resp = self
            .http_client
            .post(&api_url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?;

        let _text = resp.text().await?;

        // After quickadd, fetch subscriptions to find the new one
        let subs = self.get_subscriptions().await?;
        subs.into_iter()
            .find(|s| s.url == url || s.remote_id.contains(url))
            .ok_or_else(|| {
                DomainError::Validation(format!(
                    "Subscription was created but could not be found: {url}"
                ))
            })
    }

    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()> {
        let remote_id = match id {
            FeedIdentifier::Remote { remote_id } => remote_id,
            FeedIdentifier::Local { .. } => {
                return Err(DomainError::Validation(
                    "FreshRssProvider does not support local feed identifiers".into(),
                ));
            }
        };

        let url = self.api_url("/reader/api/0/subscription/edit");
        let auth = self.auth_header()?;
        let body = format!("ac=unsubscribe&s={}", urlencoded(remote_id));

        self.http_client
            .post(&url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| DomainError::Network(e.to_string()))?;

        Ok(())
    }
}

/// Simple percent-encoding for URL form values.
fn urlencoded(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                String::from(b as char)
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn authenticate_successful() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_header("Content-Type", "application/x-www-form-urlencoded")
            .with_status(200)
            .with_body("SID=unused\nLSID=unused\nAuth=test-token-123\n")
            .create_async()
            .await;

        let mut provider = FreshRssProvider::new(&server.url());
        let creds = Credentials {
            password: Some("mypassword".into()),
            token: Some("myuser".into()),
        };

        provider.authenticate(&creds).await.unwrap();
        assert_eq!(provider.auth_token.as_deref(), Some("test-token-123"));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_subscriptions_parses_list() {
        let mut server = mockito::Server::new_async().await;
        let auth_mock = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let sub_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/subscription/list?output=json",
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/rss",
                            "title": "Example Feed",
                            "url": "https://example.com/rss",
                            "htmlUrl": "https://example.com",
                            "categories": [
                                {"id": "user/-/label/Tech", "label": "Tech"}
                            ],
                            "iconUrl": "https://example.com/icon.png"
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

        let mut provider = FreshRssProvider::new(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let subs = provider.get_subscriptions().await.unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0].title, "Example Feed");
        assert_eq!(subs[0].remote_id, "feed/https://example.com/rss");
        assert_eq!(
            subs[0].folder_remote_id.as_deref(),
            Some("user/-/label/Tech")
        );
        assert_eq!(
            subs[0].icon_url.as_deref(),
            Some("https://example.com/icon.png")
        );

        auth_mock.assert_async().await;
        sub_mock.assert_async().await;
    }

    #[tokio::test]
    async fn get_folders_filters_labels() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let tag_mock = server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list?output=json")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "tags": [
                        {"id": "user/-/state/com.google/starred"},
                        {"id": "user/-/state/com.google/reading-list"},
                        {"id": "user/-/label/Tech"},
                        {"id": "user/-/label/News"}
                    ]
                }"#,
            )
            .create_async()
            .await;

        let mut provider = FreshRssProvider::new(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let folders = provider.get_folders().await.unwrap();
        assert_eq!(folders.len(), 2);
        assert_eq!(folders[0].name, "Tech");
        assert_eq!(folders[0].remote_id, "user/-/label/Tech");
        assert_eq!(folders[1].name, "News");

        tag_mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_parses_stream_with_continuation() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let stream_mock = server
            .mock(
                "GET",
                mockito::Matcher::Regex(
                    r"/api/greader.php/reader/api/0/stream/contents/.*output=json.*".to_string(),
                ),
            )
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Test Article",
                            "alternate": [{"href": "https://example.com/article"}],
                            "summary": {"content": "Short summary"},
                            "content": {"content": "<p>Full content</p>"},
                            "author": "Alice",
                            "published": 1700000000,
                            "updated": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": [
                                "user/-/state/com.google/reading-list",
                                "user/-/state/com.google/read"
                            ]
                        },
                        {
                            "id": "entry-2",
                            "title": "No Origin Article",
                            "categories": []
                        }
                    ],
                    "continuation": "page2token"
                }"#,
            )
            .create_async()
            .await;

        let mut provider = FreshRssProvider::new(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let result = provider.pull_entries(PullScope::All, None).await.unwrap();

        // entry-2 has no origin, so it's filtered out
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title, "Test Article");
        assert_eq!(
            result.entries[0].url.as_deref(),
            Some("https://example.com/article")
        );
        assert_eq!(result.entries[0].content, "<p>Full content</p>");
        assert_eq!(result.entries[0].summary.as_deref(), Some("Short summary"));
        assert_eq!(result.entries[0].author.as_deref(), Some("Alice"));
        assert_eq!(result.entries[0].is_read, Some(true));
        assert_eq!(result.entries[0].is_starred, Some(false));

        // Check source_feed_id
        match &result.entries[0].source_feed_id {
            FeedIdentifier::Remote { remote_id } => {
                assert_eq!(remote_id, "feed/https://example.com/rss");
            }
            _ => panic!("Expected Remote feed identifier"),
        }

        // Continuation
        assert!(result.has_more);
        let cursor = result.next_cursor.unwrap();
        assert_eq!(cursor.continuation.as_deref(), Some("page2token"));

        stream_mock.assert_async().await;
    }

    #[tokio::test]
    async fn push_mutations_sends_edit_tags() {
        let mut server = mockito::Server::new_async().await;
        server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .with_status(200)
            .with_body("Auth=tok\n")
            .create_async()
            .await;

        let mark_read_mock = server
            .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body("OK")
            .expect(3)
            .create_async()
            .await;

        let mut provider = FreshRssProvider::new(&server.url());
        provider
            .authenticate(&Credentials {
                password: Some("p".into()),
                token: Some("u".into()),
            })
            .await
            .unwrap();

        let mutations = vec![
            Mutation::MarkRead {
                remote_entry_id: "entry-1".into(),
            },
            Mutation::MarkUnread {
                remote_entry_id: "entry-2".into(),
            },
            Mutation::SetStarred {
                remote_entry_id: "entry-3".into(),
                starred: true,
            },
        ];

        provider.push_mutations(&mutations).await.unwrap();
        mark_read_mock.assert_async().await;
    }
}
