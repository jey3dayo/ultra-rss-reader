use std::time::Duration;

pub const PROVIDER_HTTP_TIMEOUT: Duration = Duration::from_secs(15);
pub const PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";

pub fn http_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .timeout(PROVIDER_HTTP_TIMEOUT)
        .user_agent(PROVIDER_USER_AGENT)
}
