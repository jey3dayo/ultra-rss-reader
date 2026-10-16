//! ClientLogin authentication, API access verification, and mutation/subscription edits.

use super::*;

impl GReaderProvider {
    pub(in crate::infra::provider::greader) async fn authenticate_with_client_login(
        &mut self,
        credentials: &ProviderCredentials,
    ) -> DomainResult<()> {
        let password = credentials
            .password
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Password is required".into()))?;

        // The Email/username field is stored in token
        let username = credentials
            .token
            .as_deref()
            .ok_or_else(|| DomainError::Auth("Username is required".into()))?;

        let url = self.auth_url("/accounts/ClientLogin");
        let body = format!(
            "Email={}&Passwd={}",
            urlencoded(username),
            urlencoded(password)
        );

        let response = self
            .request(reqwest::Method::POST, &url)?
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|error| self.map_request_error(error))?;

        let response = Self::ensure_success_response(response)?;
        let text = Self::read_text_response(response).await?;
        let auth_token = text
            .lines()
            .find_map(|line| line.strip_prefix("Auth="))
            .map(|s| s.to_string())
            .ok_or_else(|| DomainError::Auth("Auth token not found in response".into()))?;

        self.auth_token = Some(auth_token);
        Ok(())
    }

    pub(crate) async fn verify_api_access(&self) -> DomainResult<()> {
        self.get_folders()
            .await
            .map(|_| ())
            .map_err(|error| match error {
                DomainError::Auth(message) => {
                    let context = if message.contains("HTTP 401") {
                        "tag-list HTTP 401 Unauthorized"
                    } else if message.contains("HTTP 403") {
                        "tag-list HTTP 403 Forbidden"
                    } else if message.contains("HTML page") {
                        "tag-list returned an HTML page"
                    } else {
                        "tag-list access denied"
                    };
                    DomainError::Auth(context.into())
                }
                error => error,
            })
    }

    pub(in crate::infra::provider::greader) async fn push_mutations_impl(
        &self,
        mutations: &[Mutation],
    ) -> DomainResult<()> {
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

            let response = self
                .request(reqwest::Method::POST, &url)?
                .header("Authorization", auth.clone())
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(body)
                .send()
                .await
                .map_err(|error| self.map_request_error(error))
                .and_then(Self::ensure_success_response)?;
            Self::read_text_response(response).await?;
        }

        Ok(())
    }

    pub(in crate::infra::provider::greader) async fn delete_subscription_impl(
        &self,
        id: &FeedIdentifier,
    ) -> DomainResult<()> {
        let remote_id = match id {
            FeedIdentifier::Remote { remote_id } => remote_id,
            FeedIdentifier::Local { .. } => {
                return Err(DomainError::Validation(
                    "GReaderProvider does not support local feed identifiers".into(),
                ));
            }
        };

        let url = self.api_url("/reader/api/0/subscription/edit");
        let auth = self.auth_header()?;
        let body = format!("ac=unsubscribe&s={}", urlencoded(remote_id));

        let response = self
            .request(reqwest::Method::POST, &url)?
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|error| self.map_request_error(error))
            .and_then(Self::ensure_success_response)?;
        Self::read_text_response(response).await?;

        Ok(())
    }

    pub(in crate::infra::provider::greader) async fn edit_subscription_impl(
        &self,
        remote_id: &str,
        title: Option<&str>,
        add_folder_label: Option<&str>,
        remove_folder_label: Option<&str>,
    ) -> DomainResult<()> {
        if title.is_none() && add_folder_label.is_none() && remove_folder_label.is_none() {
            return Ok(());
        }

        let url = self.api_url("/reader/api/0/subscription/edit");
        let auth = self.auth_header()?;
        let mut body = format!("ac=edit&s={}", urlencoded(remote_id));
        if let Some(title) = title {
            body.push_str(&format!("&t={}", urlencoded(title)));
        }
        if let Some(folder_name) = add_folder_label {
            body.push_str(&format!(
                "&a={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }
        if let Some(folder_name) = remove_folder_label {
            body.push_str(&format!(
                "&r={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }

        let response = self
            .request(reqwest::Method::POST, &url)?
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|error| self.map_request_error(error))
            .and_then(Self::ensure_success_response)?;
        Self::read_text_response(response).await?;

        Ok(())
    }
}
