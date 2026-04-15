use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MuteKeywordScope {
    Title,
    Body,
    TitleAndBody,
}

impl MuteKeywordScope {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Title => "title",
            Self::Body => "body",
            Self::TitleAndBody => "title_and_body",
        }
    }
}

impl TryFrom<&str> for MuteKeywordScope {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "title" => Ok(Self::Title),
            "body" => Ok(Self::Body),
            "title_and_body" => Ok(Self::TitleAndBody),
            other => Err(format!("Unknown mute keyword scope: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MuteKeyword {
    pub id: String,
    pub keyword: String,
    pub scope: MuteKeywordScope,
    pub created_at: String,
    pub updated_at: String,
}
