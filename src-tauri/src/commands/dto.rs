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
pub struct FeedDto {
    pub id: String,
    pub account_id: String,
    pub title: String,
    pub url: String,
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

impl From<crate::domain::account::Account> for AccountDto {
    fn from(a: crate::domain::account::Account) -> Self {
        Self {
            id: a.id.0,
            kind: format!("{:?}", a.kind),
            name: a.name,
        }
    }
}

impl From<crate::domain::feed::Feed> for FeedDto {
    fn from(f: crate::domain::feed::Feed) -> Self {
        Self {
            id: f.id.0,
            account_id: f.account_id.0,
            title: f.title,
            url: f.url,
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
