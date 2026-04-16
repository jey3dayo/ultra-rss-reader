use std::net::ToSocketAddrs;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Persistence error: {0}")]
    Persistence(String),
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("Migration error: {0}")]
    Migration(String),
}

pub type DomainResult<T> = Result<T, DomainError>;

fn classify_reqwest_network_error(error: &reqwest::Error) -> String {
    let message = error.to_string();
    let normalized = message.to_ascii_lowercase();

    if error.is_timeout() {
        return "Request timed out. Check the server URL or your network connection.".to_string();
    }

    let resolution_failed = error.url().is_some_and(|url| {
        let Some(host) = url.host_str() else {
            return false;
        };
        let Some(port) = url.port_or_known_default() else {
            return false;
        };

        (host, port).to_socket_addrs().is_err()
    });

    if resolution_failed
        || normalized.contains("dns error")
        || normalized.contains("failed to lookup address information")
        || normalized.contains("name or service not known")
        || normalized.contains("could not resolve host")
        || normalized.contains("no such host")
        || normalized.contains("nodename nor servname provided")
        || normalized.contains("temporary failure in name resolution")
    {
        return "Could not resolve the server name. Check the server URL or your DNS/network settings."
            .to_string();
    }

    if error.is_connect() {
        return "Could not connect to the server. Check the server URL and whether the server is reachable."
            .to_string();
    }

    message
}

impl From<rusqlite::Error> for DomainError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Persistence(e.to_string())
    }
}

impl From<reqwest::Error> for DomainError {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(classify_reqwest_network_error(&e))
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::DomainError;

    #[tokio::test]
    async fn reqwest_dns_errors_are_mapped_to_actionable_message() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("client should build");

        let error = client
            .post("http://nonexistent.invalid/api/greader.php/accounts/ClientLogin")
            .send()
            .await
            .expect_err("request should fail");

        let domain_error = DomainError::from(error);

        assert_eq!(
            domain_error.to_string(),
            "Network error: Could not resolve the server name. Check the server URL or your DNS/network settings."
        );
    }

    #[tokio::test]
    async fn reqwest_connect_errors_remain_connectivity_failures() {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("client should build");

        let error = client
            .post("http://127.0.0.1:9/api/greader.php/accounts/ClientLogin")
            .send()
            .await
            .expect_err("request should fail");

        let domain_error = DomainError::from(error);

        assert_eq!(
            domain_error.to_string(),
            "Network error: Could not connect to the server. Check the server URL and whether the server is reachable."
        );
    }
}
