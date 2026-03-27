use serde::Serialize;

use crate::domain::error::DomainError;

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AppError {
    UserVisible { message: String },
    Retryable { message: String },
}

impl From<DomainError> for AppError {
    fn from(e: DomainError) -> Self {
        match &e {
            DomainError::Network(_) => AppError::Retryable {
                message: e.to_string(),
            },
            _ => AppError::UserVisible {
                message: e.to_string(),
            },
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::UserVisible { message } | AppError::Retryable { message } => {
                write!(f, "{}", message)
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AccountDto {
    pub id: String,
    pub kind: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct FolderDto {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct FeedDto {
    pub id: String,
    pub account_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub url: String,
    pub site_url: String,
    pub unread_count: i32,
}

#[derive(Debug, Serialize)]
pub struct ArticleDto {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub content_sanitized: String,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    pub published_at: String,
    pub thumbnail: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
}

#[derive(Debug, Serialize)]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

impl From<crate::domain::tag::Tag> for TagDto {
    fn from(t: crate::domain::tag::Tag) -> Self {
        Self {
            id: t.id.0,
            name: t.name,
            color: t.color,
        }
    }
}

impl From<crate::domain::account::Account> for AccountDto {
    fn from(a: crate::domain::account::Account) -> Self {
        Self {
            id: a.id.0,
            kind: format!("{:?}", a.kind),
            name: a.name,
        }
    }
}

impl From<crate::domain::folder::Folder> for FolderDto {
    fn from(f: crate::domain::folder::Folder) -> Self {
        Self {
            id: f.id.0,
            account_id: f.account_id.0,
            name: f.name,
            sort_order: f.sort_order,
        }
    }
}

impl From<crate::domain::feed::Feed> for FeedDto {
    fn from(f: crate::domain::feed::Feed) -> Self {
        Self {
            id: f.id.0,
            account_id: f.account_id.0,
            folder_id: f.folder_id.map(|id| id.0),
            title: f.title,
            url: f.url,
            site_url: f.site_url,
            unread_count: f.unread_count,
        }
    }
}

impl From<crate::domain::article::Article> for ArticleDto {
    fn from(a: crate::domain::article::Article) -> Self {
        Self {
            id: a.id.0,
            feed_id: a.feed_id.0,
            title: a.title,
            content_sanitized: a.content_sanitized,
            summary: a.summary,
            url: a.url,
            author: a.author,
            published_at: a.published_at.to_rfc3339(),
            thumbnail: a.thumbnail,
            is_read: a.is_read,
            is_starred: a.is_starred,
        }
    }
}
