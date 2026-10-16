//! Response status checks and bounded body reading for GReader API calls.

use super::*;

impl GReaderProvider {
    pub(in crate::infra::provider::greader) fn ensure_success_response(
        response: reqwest::Response,
    ) -> DomainResult<reqwest::Response> {
        let status = response.status();
        if matches!(status.as_u16(), 401 | 403) {
            log_greader_api_failure(
                SafeGReaderFailureContext::from_response(&response),
                SafeGReaderFailureReason::HttpAuth,
            );
            return Err(DomainError::Auth(format!(
                "HTTP {status}. Check FreshRSS API credentials and any access gateway settings."
            )));
        }
        if status.is_success() {
            return Ok(response);
        }

        Err(DomainError::from_provider_http_response_status(
            status,
            response.headers(),
        ))
    }

    pub(in crate::infra::provider::greader) async fn read_json_response<T>(
        response: reqwest::Response,
    ) -> DomainResult<T>
    where
        T: DeserializeOwned,
    {
        let is_html = has_html_content_type(&response);
        let failure_context = SafeGReaderFailureContext::from_response(&response);
        if is_html
            && !response
                .url()
                .path()
                .ends_with("/reader/api/0/stream/items/ids")
        {
            log_greader_api_failure(failure_context, SafeGReaderFailureReason::HtmlContentType);
            return Err(access_html_error());
        }
        let body = Self::read_response_body(response).await?;
        if is_html && !has_item_ids_response_shape(&body) {
            log_greader_api_failure(failure_context, SafeGReaderFailureReason::HtmlContentType);
            return Err(access_html_error());
        }
        serde_json::from_slice::<T>(&body).map_err(|_| {
            if is_html {
                log_greader_api_failure(failure_context, SafeGReaderFailureReason::HtmlContentType);
                access_html_error()
            } else {
                DomainError::Parse("Invalid GReader JSON response".into())
            }
        })
    }

    pub(super) async fn read_response_body(response: reqwest::Response) -> DomainResult<Vec<u8>> {
        let failure_context = SafeGReaderFailureContext::from_response(&response);
        let body = http_defaults::response_bytes_with_decoded_cap(
            response,
            http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES,
            || {
                log::warn!(
                    "{} limit_bytes={}",
                    failure_context.format(SafeGReaderFailureReason::BodyCap),
                    http_defaults::PROVIDER_RESPONSE_BODY_CAP_BYTES
                );
                greader_json_body_too_large_error()
            },
            DomainError::from_provider_http_error,
        )
        .await?;
        let prefix = String::from_utf8_lossy(&body[..body.len().min(512)]);
        let prefix = prefix
            .trim_start_matches('\u{feff}')
            .trim_start()
            .to_ascii_lowercase();
        if prefix.starts_with("<!doctype html") || prefix.starts_with("<html") {
            log_greader_api_failure(failure_context, SafeGReaderFailureReason::HtmlBody);
            return Err(access_html_error());
        }
        Ok(body)
    }

    pub(in crate::infra::provider::greader) async fn read_text_response(
        response: reqwest::Response,
    ) -> DomainResult<String> {
        if has_html_content_type(&response) {
            let failure_context = SafeGReaderFailureContext::from_response(&response);
            let path = response.url().path().to_owned();
            let body = Self::read_response_body(response).await?;
            if let Ok(text) = String::from_utf8(body) {
                if html_mime_mutation_success(&path, &text) {
                    return Ok(text);
                }
            }
            let reason = if matches!(
                failure_context.endpoint,
                SafeGReaderEndpoint::SubscriptionQuickadd
                    | SafeGReaderEndpoint::SubscriptionEdit
                    | SafeGReaderEndpoint::EditTag
            ) {
                SafeGReaderFailureReason::InvalidMutationShape
            } else {
                SafeGReaderFailureReason::HtmlContentType
            };
            log_greader_api_failure(failure_context, reason);
            return Err(access_html_error());
        }
        String::from_utf8(Self::read_response_body(response).await?)
            .map_err(|_| DomainError::Parse("Invalid GReader text response".into()))
    }
}
