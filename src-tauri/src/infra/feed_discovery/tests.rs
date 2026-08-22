use super::*;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;

#[test]
fn test_extract_feed_links_rss() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="Main Feed" href="/feed.xml">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0].url, "https://example.com/feed.xml");
    assert_eq!(feeds[0].title, "Main Feed");
}

#[test]
fn test_extract_feed_links_atom() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="https://example.com/atom.xml">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0].url, "https://example.com/atom.xml");
    assert_eq!(feeds[0].title, "Atom Feed");
}

#[test]
fn test_extract_multiple_feeds() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert_eq!(feeds.len(), 2);
}

#[test]
fn test_extract_feed_links_with_rel_token_list() {
    let html = r#"
        <html><head>
        <link rel="alternate nofollow" type="application/rss+xml" title="RSS" href="/rss.xml">
        <link rel="canonical alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert_eq!(feeds.len(), 2);
    assert_eq!(feeds[0].url, "https://example.com/rss.xml");
    assert_eq!(feeds[1].url, "https://example.com/atom.xml");
}

#[test]
fn test_extract_feed_links_json_feed() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/feed+json" title="JSON Feed" href="/feed.json">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0].url, "https://example.com/feed.json");
    assert_eq!(feeds[0].title, "JSON Feed");
}

#[test]
fn test_extract_feed_links_accepts_attribute_whitespace_around_equals() {
    let html = r#"
        <html><head>
        <link rel = "alternate" type = "application/rss+xml" title = "RSS" href = "/rss.xml">
        <link rel='alternate' type = 'application/atom+xml' title='Atom' href = 'atom.xml'>
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.com/rss.xml", "RSS"),
            ("https://example.com/articles/atom.xml", "Atom"),
        ],
    );
}

#[test]
fn test_extract_feed_links_accepts_unquoted_attributes() {
    let html = r#"
        <html><head>
        <link rel=alternate type=application/rss+xml href=/feed.xml title=Feed>
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![("https://example.com/feed.xml", "Feed")],
    );
}

#[test]
fn test_extract_feed_links_dedupes_resolved_urls_preserving_first_order() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="First RSS" href="/feed.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
        <link rel="alternate" type="application/rss+xml" title="Duplicate RSS" href="https://example.com/feed.xml">
        <link rel="alternate" type="application/feed+json" title="JSON" href="/feed.json">
        <link rel="alternate" type="application/rss+xml" title="Duplicate Atom" href="./atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.com/feed.xml", "First RSS"),
            ("https://example.com/atom.xml", "Atom"),
            ("https://example.com/feed.json", "JSON"),
        ],
    );
}

#[test]
fn test_extract_feed_links_normalizes_candidates_without_network() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml; charset=utf-8" title="RSS" href="./feed.xml">
        <link rel="alternate" type="application/atom+xml" title="" href="//cdn.example.com/atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.com/articles/feed.xml", "RSS"),
            ("https://cdn.example.com/atom.xml", ""),
        ],
    );
}

#[test]
fn test_extract_feed_links_rejects_non_alternate_rel_tokens() {
    let html = r#"
        <html><head>
        <link rel="alternate-stylesheet" type="application/rss+xml" title="RSS" href="/rss.xml">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert!(feeds.is_empty());
}

#[test]
fn test_extract_no_feeds() {
    let html = r#"
        <html><head>
        <link rel="stylesheet" href="/style.css">
        </head><body></body></html>
    "#;
    let feeds = extract_feed_links(html, "https://example.com");
    assert!(feeds.is_empty());
}

#[test]
fn test_resolve_url_absolute() {
    assert_eq!(
        resolve_url("https://example.com", "https://other.com/feed.xml"),
        "https://other.com/feed.xml"
    );
}

#[test]
fn test_resolve_url_root_relative() {
    assert_eq!(
        resolve_url("https://example.com/page", "/feed.xml"),
        "https://example.com/feed.xml"
    );
}

#[test]
fn test_extract_feed_links_resolves_relative_href_from_final_page_url() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="../atom.xml">
        <link rel="alternate" type="application/feed+json" title="JSON" href="/json/feed.json">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(feeds.len(), 3);
    assert_eq!(
        feeds[0].url,
        "https://example.com/articles/2026/feeds/rss.xml"
    );
    assert_eq!(feeds[1].url, "https://example.com/articles/atom.xml");
    assert_eq!(feeds[2].url, "https://example.com/json/feed.json");
}

#[test]
fn test_extract_feed_links_resolves_relative_href_from_html_base_href() {
    let html = r#"
        <html><head>
        <base href="https://example.com/site/subdir/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="../atom.xml">
        <link rel="alternate" type="application/feed+json" title="JSON" href="/json/feed.json">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.com/site/subdir/feeds/rss.xml", "RSS"),
            ("https://example.com/site/atom.xml", "Atom"),
            ("https://example.com/json/feed.json", "JSON"),
        ],
    );
}

#[test]
fn test_extract_feed_links_resolves_relative_base_href_from_final_page_url() {
    let html = r#"
        <html><head>
        <base href="../feeds/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="rss.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0].url, "https://example.com/articles/feeds/rss.xml");
}

#[test]
fn test_extract_feed_links_handles_protocol_relative_base_and_private_candidate() {
    let html = r#"
        <html><head>
        <base href="//example.com/site/subdir/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Private" href="//127.0.0.1/atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![("https://example.com/site/subdir/feeds/rss.xml", "RSS")],
    );
}

#[test]
fn test_extract_feed_links_allows_same_origin_base_href_path_traversal_after_normalization() {
    let html = r#"
        <html><head>
        <base href="../../feeds/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="./rss.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![("https://example.com/feeds/rss.xml", "RSS")],
    );
}

#[test]
fn test_extract_feed_links_decodes_html_attribute_entities_before_resolution() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="Tom &amp; Jerry" href="/feed.xml?format=rss&amp;lang=ja">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(feeds.len(), 1);
    assert_eq!(
        feeds[0].url,
        "https://example.com/feed.xml?format=rss&lang=ja"
    );
    assert_eq!(feeds[0].title, "Tom & Jerry");
}

#[test]
fn test_extract_feed_links_decodes_numeric_html_attribute_entities_before_resolution() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="Tom &#38; Jerry" href="/feed.xml?format=rss&#x26;lang=ja&#X26;variant=full">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(feeds.len(), 1);
    assert_eq!(
        feeds[0].url,
        "https://example.com/feed.xml?format=rss&lang=ja&variant=full"
    );
    assert_eq!(feeds[0].title, "Tom & Jerry");
}

#[test]
fn test_extract_feed_links_skips_malformed_link_tag_and_continues() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml href="/broken.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="/atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![("https://example.com/atom.xml", "Atom")],
    );
}

#[test]
fn test_extract_feed_links_ignores_cross_origin_base_href() {
    let html = r#"
        <html><head>
        <base href="https://cdn.example.com/site/subdir/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="feeds/rss.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(feeds.len(), 1);
    assert_eq!(
        feeds[0].url,
        "https://example.com/articles/2026/feeds/rss.xml"
    );
}

#[test]
fn test_extract_feed_links_ignores_cross_origin_base_href_even_with_path_traversal() {
    let html = r#"
        <html><head>
        <base href="https://cdn.example.com/site/../../feeds/">
        <link rel="alternate" type="application/rss+xml" title="RSS" href="rss.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/2026/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![("https://example.com/articles/2026/rss.xml", "RSS")],
    );
}

#[test]
fn test_extract_feed_links_dedupes_normalized_final_urls() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="First RSS" href="/feeds/../feed.xml">
        <link rel="alternate" type="application/rss+xml" title="Duplicate RSS" href="https://example.com:443/feed.xml">
        <link rel="alternate" type="application/atom+xml" title="Atom" href="./atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.com/feed.xml", "First RSS"),
            ("https://example.com/articles/atom.xml", "Atom"),
        ],
    );
}

#[test]
fn test_extract_feed_links_filters_resolved_private_and_unsupported_candidates() {
    let html = r#"
        <html><head>
        <base href="http://127.0.0.1/private/">
        <link rel="alternate" type="application/rss+xml" title="Loopback Relative" href="rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Loopback Absolute" href="http://127.0.0.1/atom.xml">
        <link rel="alternate" type="application/feed+json" title="File Feed" href="file:///tmp/feed.json">
        <link rel="alternate" type="application/rss+xml" title="Public Feed" href="https://example.com/feed.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.org/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://example.org/articles/rss.xml", "Loopback Relative"),
            ("https://example.com/feed.xml", "Public Feed"),
        ],
    );
}

#[test]
fn test_extract_feed_links_filters_private_url_corpus_after_base_resolution() {
    let html = r#"
        <html><head>
        <link rel="alternate" type="application/rss+xml" title="Loopback Relative" href="//127.0.0.1/rss.xml">
        <link rel="alternate" type="application/rss+xml" title="Localhost Trailing Dot" href="http://localhost./rss.xml">
        <link rel="alternate" type="application/rss+xml" title="Unspecified IPv4" href="http://0.0.0.0/rss.xml">
        <link rel="alternate" type="application/rss+xml" title="Link Local IPv4" href="http://169.254.1.1/rss.xml">
        <link rel="alternate" type="application/rss+xml" title="Unique Local IPv6" href="http://[fd00::1]/rss.xml">
        <link rel="alternate" type="application/atom+xml" title="Mapped IPv6" href="http://[::ffff:7f00:1]/atom.xml">
        <link rel="alternate" type="application/feed+json" title="Zone IPv6" href="http://[fe80::1%25en0]/feed.json">
        <link rel="alternate" type="application/rss+xml" title="Public IDNA" href="https://例え.テスト/feed.xml">
        <link rel="alternate" type="application/atom+xml" title="Punycode" href="https://xn--r8jz45g.xn--zckzah/atom.xml">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.org/articles/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.url.as_str(), feed.title.as_str()))
            .collect::<Vec<_>>(),
        vec![
            ("https://xn--r8jz45g.xn--zckzah/feed.xml", "Public IDNA"),
            ("https://xn--r8jz45g.xn--zckzah/atom.xml", "Punycode"),
        ],
    );
}

#[test]
fn validate_resolved_host_rejects_dns_answers_to_private_ip() {
    let url = reqwest::Url::parse("http://localhost/feed.xml").unwrap();

    assert!(matches!(
        validate_resolved_host_is_public(&url),
        Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_request_url_maps_unknown_test_hosts_to_dns_failure() {
    let url = reqwest::Url::parse("https://unknown.test.invalid/feed.xml").unwrap();

    assert!(matches!(
        validate_discovery_request_url(&url),
        Err(DomainError::Network(message))
            if message.contains("failed to resolve test host")
                && message.contains("unknown.test.invalid")
    ));
}

#[test]
fn validate_discovery_request_url_allows_known_public_fixture_hosts() {
    for raw_url in [
        "https://public.test.invalid/feed.xml",
        "https://example.com/feed.xml",
        "https://example.org/feed.xml",
    ] {
        let url = reqwest::Url::parse(raw_url).unwrap();

        assert!(validate_discovery_request_url(&url).is_ok(), "{raw_url}");
    }
}

#[test]
fn validate_discovery_request_url_returns_public_socket_addresses_for_request_pinning() {
    let url = reqwest::Url::parse("https://public.test.invalid/feed.xml").unwrap();

    let addresses = validate_and_resolve_discovery_request_url(&url).unwrap();

    assert_eq!(addresses, vec![SocketAddr::from(([93, 184, 216, 34], 0))]);
}

#[test]
fn validate_discovery_request_url_rejects_known_private_fixture_hosts() {
    let url = reqwest::Url::parse("https://private.test.invalid/feed.xml").unwrap();

    assert!(matches!(
        validate_discovery_request_url(&url),
        Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_redirect_rejects_dns_rebinding_private_hostname_targets() {
    let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];
    let next = reqwest::Url::parse("https://localhost./feed.xml").unwrap();

    assert!(matches!(
        validate_discovery_redirect(&previous, &next),
        Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_request_url_rejects_private_initial_boundary_corpus() {
    for raw_url in [
        "http://LOCALHOST./feed.xml",
        "http://localhost./feed.xml",
        "http://0.0.0.0/feed.xml",
        "http://169.254.1.1/feed.xml",
        "http://[fd00::1]/feed.xml",
        "http://[fe80::1]/feed.xml",
        "http://[::ffff:a9fe:101]/feed.xml",
    ] {
        let url = reqwest::Url::parse(raw_url).unwrap();

        assert!(
            matches!(
                validate_discovery_request_url(&url),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ),
            "{raw_url}"
        );
    }
}

#[test]
fn test_resolve_url_protocol_relative() {
    assert_eq!(
        resolve_url("https://example.com", "//cdn.example.com/feed.xml"),
        "https://cdn.example.com/feed.xml"
    );
}

#[test]
fn validate_discovery_url_allows_public_http_and_https_urls() {
    for url in [
        reqwest::Url::parse("https://example.com/feed.xml").unwrap(),
        reqwest::Url::parse("http://example.com/feed.xml").unwrap(),
    ] {
        assert!(validate_discovery_url(&url).is_ok());
    }
}

#[test]
fn validate_discovery_url_rejects_private_and_loopback_redirect_targets() {
    for url in [
        reqwest::Url::parse("http://localhost/feed.xml").unwrap(),
        reqwest::Url::parse("http://127.0.0.1/feed.xml").unwrap(),
        reqwest::Url::parse("http://10.0.0.2/feed.xml").unwrap(),
        reqwest::Url::parse("http://[::1]/feed.xml").unwrap(),
        reqwest::Url::parse("http://[::ffff:7f00:1]/feed.xml").unwrap(),
        reqwest::Url::parse("http://[::ffff:a00:2]/feed.xml").unwrap(),
    ] {
        assert!(matches!(
            validate_discovery_url(&url),
            Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn discover_feeds_rejects_ipv6_zone_identifier_urls_before_network() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let error = runtime
        .block_on(discover_feeds("http://[fe80::1%25en0]/feed.xml"))
        .expect_err("IPv6 zone identifier URL should be rejected before request");

    assert!(matches!(
        error,
        DomainError::Validation(message) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_url_allows_idna_and_punycode_public_hosts() {
    for (raw_url, expected_host) in [
        ("https://例え.テスト/feed.xml", "xn--r8jz45g.xn--zckzah"),
        (
            "https://xn--r8jz45g.xn--zckzah/feed.xml",
            "xn--r8jz45g.xn--zckzah",
        ),
    ] {
        let url = reqwest::Url::parse(raw_url).unwrap();

        assert_eq!(url.host_str(), Some(expected_host));
        assert!(validate_discovery_url(&url).is_ok());
    }
}

#[test]
fn validate_discovery_url_rejects_credential_bearing_urls() {
    let url = reqwest::Url::parse("https://alice:secret@example.com/feed.xml").unwrap();

    assert!(validate_discovery_url(&url).is_err());
}

#[test]
fn extract_feed_links_skips_private_and_credential_bearing_fixture_corpus() {
    let html = r#"
        <html><head>
        <base href="https://example.com/articles/">
        <link rel="alternate" type="application/rss+xml" title="Private Host" href="http://127.0.0.1/feed.xml">
        <link rel="alternate" type="application/rss+xml" title="Credential URL" href="https://alice:secret@example.com/feed.xml?token=raw">
        <link rel="alternate" type="application/rss+xml" title="Public Feed" href="feed.xml?token=raw">
        </head><body></body></html>
    "#;

    let feeds = extract_feed_links(html, "https://example.com/index.html");

    assert_eq!(
        feeds
            .iter()
            .map(|feed| (feed.title.as_str(), feed.url.as_str()))
            .collect::<Vec<_>>(),
        vec![(
            "Public Feed",
            "https://example.com/articles/feed.xml?token=raw"
        )],
    );
}

#[test]
fn discover_feeds_rejects_private_and_unsupported_initial_urls_before_network() {
    let runtime = tokio::runtime::Runtime::new().unwrap();

    for url in [
        "http://localhost/feed.xml",
        "http://127.0.0.1/feed.xml",
        "http://10.0.0.2/feed.xml",
    ] {
        let error = runtime
            .block_on(discover_feeds(url))
            .expect_err("private initial discovery URL should be rejected");

        assert!(matches!(
            error,
            DomainError::Validation(message) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }

    for url in ["file:///tmp/feed.xml", "mailto:feed@example.com"] {
        let error = runtime
            .block_on(discover_feeds(url))
            .expect_err("unsupported initial discovery URL should be rejected");

        assert!(matches!(
            error,
            DomainError::Validation(message) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn decode_discovery_response_body_uses_lossy_utf8_policy() {
    let body = b"<html><head><title>\xE3\x81broken</title></head></html>";

    assert_eq!(
        decode_discovery_response_body(body),
        "<html><head><title>\u{FFFD}broken</title></head></html>"
    );
}

#[test]
fn validate_discovery_url_rejects_unsupported_redirect_schemes() {
    let url = reqwest::Url::parse("file:///etc/passwd").unwrap();

    assert!(matches!(
        validate_discovery_url(&url),
        Err(DomainError::Validation(message)) if message == UNSUPPORTED_URL_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_redirect_rejects_https_to_http_downgrade() {
    let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];
    let next = reqwest::Url::parse("http://example.com/feed.xml").unwrap();

    assert!(matches!(
        validate_discovery_redirect(&previous, &next),
        Err(DomainError::Validation(message)) if message == DOWNGRADE_REDIRECT_VALIDATION_MESSAGE
    ));
}

#[test]
fn validate_discovery_redirect_allows_http_to_https_upgrade() {
    let previous = vec![reqwest::Url::parse("http://example.com/page").unwrap()];
    let next = reqwest::Url::parse("https://example.com/feed.xml").unwrap();

    assert!(validate_discovery_redirect(&previous, &next).is_ok());
}

#[test]
fn validate_discovery_redirect_rejects_private_redirect_targets() {
    let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];

    for next in [
        reqwest::Url::parse("https://localhost/feed.xml").unwrap(),
        reqwest::Url::parse("https://127.0.0.1/feed.xml").unwrap(),
        reqwest::Url::parse("https://10.0.0.2/feed.xml").unwrap(),
        reqwest::Url::parse("https://[::ffff:7f00:1]/feed.xml").unwrap(),
    ] {
        assert!(matches!(
            validate_discovery_redirect(&previous, &next),
            Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
        ));
    }
}

#[test]
fn validate_discovery_redirect_rejects_private_boundary_corpus() {
    let previous = vec![reqwest::Url::parse("https://example.com/page").unwrap()];

    for raw_url in [
        "https://LOCALHOST./feed.xml",
        "https://localhost./feed.xml",
        "https://0.0.0.0/feed.xml",
        "https://169.254.1.1/feed.xml",
        "https://[fd00::1]/feed.xml",
        "https://[fe80::1]/feed.xml",
        "https://[::ffff:a9fe:101]/feed.xml",
    ] {
        let next = reqwest::Url::parse(raw_url).unwrap();

        assert!(
            matches!(
                validate_discovery_redirect(&previous, &next),
                Err(DomainError::Validation(message)) if message == PRIVATE_URL_VALIDATION_MESSAGE
            ),
            "{raw_url}"
        );
    }
}

#[test]
fn test_is_feed_content_type() {
    assert!(is_feed_content_type("application/rss+xml; charset=utf-8"));
    assert!(is_feed_content_type("application/atom+xml"));
    assert!(is_feed_content_type("application/feed+json"));
    assert!(is_feed_content_type("text/xml"));
    assert!(!is_feed_content_type("text/html; charset=utf-8"));
    assert!(!is_feed_content_type(
        "text/plain; note=application/rss+xml"
    ));
}

#[test]
fn validates_feed_body_before_accepting_xml_or_json_feed_content_types() {
    for (body, content_type) in [
        (
            r#"<rss version="2.0"><channel><title>RSS</title></channel></rss>"#,
            "application/rss+xml",
        ),
        (
            r#"<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title></feed>"#,
            "application/xml",
        ),
        (
            r#"{"version":"https://jsonfeed.org/version/1.1","items":[]}"#,
            "application/feed+json; charset=utf-8",
        ),
    ] {
        assert!(
            validate_feed_body_for_content_type(body, content_type).is_ok(),
            "{content_type}"
        );
    }

    for (body, content_type) in [
        (
            r#"<config><feed enabled="false"/></config>"#,
            "application/xml",
        ),
        (
            r#"{"version":"https://jsonfeed.org/version/1.1","items":{}}"#,
            "application/feed+json",
        ),
        (r#"{"items":[]}"#, "application/feed+json"),
    ] {
        assert!(
            matches!(
                validate_feed_body_for_content_type(body, content_type),
                Err(DomainError::Validation(message))
                    if message == "Feed discovery response is not a valid feed document"
            ),
            "{content_type}: {body}"
        );
    }
}

#[test]
fn validate_discovery_response_content_type_allows_html_and_missing_type() {
    assert!(validate_discovery_response_content_type("text/html; charset=utf-8").is_ok());
    assert!(validate_discovery_response_content_type("").is_ok());
}

#[test]
fn validate_discovery_response_content_type_rejects_binary_type() {
    assert!(matches!(
        validate_discovery_response_content_type("application/octet-stream"),
        Err(DomainError::Validation(message))
            if message.contains("Unsupported feed discovery response content type")
    ));
}

#[test]
fn validate_discovery_response_content_type_rejects_text_plain_xml_sniffing() {
    assert!(matches!(
        validate_discovery_response_content_type("text/plain; charset=utf-8"),
        Err(DomainError::Validation(message))
            if message.contains("Unsupported feed discovery response content type")
    ));
}

#[test]
fn test_feed_body_fallback_accepts_rss_atom_and_xml_when_content_type_is_misleading_or_missing() {
    for body in [
        r#"<rss version="2.0"><channel><title>RSS</title></channel></rss>"#,
        r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title></feed>"#,
        r#"<?xml version="1.0"?><rss version="2.0"></rss>"#,
        r#"
            <?xml version="1.0"?><feed></feed>
        "#,
    ] {
        assert!(
            is_feed_body_fallback(body),
            "body should be treated as a feed fallback: {body}"
        );
    }
}

#[test]
fn test_feed_body_fallback_rejects_html_when_content_type_is_misleading_or_missing() {
    for body in [
        r#"<html><head><title>Site</title></head><body></body></html>"#,
        r#"{"version":"https://jsonfeed.org/version/1.1","items":[]}"#,
        "",
    ] {
        assert!(
            !is_feed_body_fallback(body),
            "body should not be treated as a feed fallback: {body}"
        );
    }
}

#[tokio::test]
async fn discovery_http_client_sends_shared_user_agent_and_does_not_prefetch_robots() {
    assert_eq!(
        DISCOVERY_USER_AGENT_POLICY,
        http_defaults::PROVIDER_USER_AGENT
    );

    let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
    let address = listener
        .local_addr()
        .expect("test server should expose local address");
    let (request_tx, request_rx) = mpsc::channel();
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("client should connect");
        let mut request = [0_u8; 2048];
        let bytes_read = stream.read(&mut request).unwrap_or(0);
        request_tx
            .send(String::from_utf8_lossy(&request[..bytes_read]).into_owned())
            .expect("test should receive captured request");
        stream
            .write_all(b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n")
            .expect("test server should write response");
    });

    let response = discovery_http_client_builder()
        .build()
        .expect("discovery client should build")
        .get(format!("http://{address}/page"))
        .send()
        .await
        .expect("discovery client should send request");

    assert_eq!(response.status(), reqwest::StatusCode::NO_CONTENT);
    server.join().expect("test server should finish");
    let request = request_rx
        .recv()
        .expect("test should capture discovery request")
        .to_ascii_lowercase();
    assert!(request.starts_with("get /page "));
    assert!(!request.contains("/robots.txt"));
    assert!(request.contains(&format!(
        "user-agent: {}",
        DISCOVERY_USER_AGENT_POLICY.to_ascii_lowercase()
    )));
}

#[test]
fn test_extract_attribute_double_quotes() {
    let tag = r#"<link rel="alternate" type="application/rss+xml" href="/feed.xml">"#;
    assert_eq!(
        extract_attribute(tag, "href"),
        Some("/feed.xml".to_string())
    );
    assert_eq!(
        extract_attribute(tag, "type"),
        Some("application/rss+xml".to_string())
    );
}

#[test]
fn test_extract_attribute_single_quotes() {
    let tag = "<link rel='alternate' type='application/rss+xml' href='/feed.xml'>";
    assert_eq!(
        extract_attribute(tag, "href"),
        Some("/feed.xml".to_string())
    );
}

#[test]
fn test_extract_attribute_allows_whitespace_around_equals() {
    let tag = r#"<link rel = "alternate" type = 'application/rss+xml' href = "/feed.xml">"#;

    assert_eq!(
        extract_attribute(tag, "href"),
        Some("/feed.xml".to_string())
    );
    assert_eq!(
        extract_attribute(tag, "type"),
        Some("application/rss+xml".to_string())
    );
}

#[test]
fn test_extract_attribute_accepts_unquoted_values() {
    let tag = r#"<link rel=alternate type=application/rss+xml href=/feed.xml title=Feed>"#;

    assert_eq!(extract_attribute(tag, "rel"), Some("alternate".to_string()));
    assert_eq!(
        extract_attribute(tag, "type"),
        Some("application/rss+xml".to_string())
    );
    assert_eq!(
        extract_attribute(tag, "href"),
        Some("/feed.xml".to_string())
    );
    assert_eq!(extract_attribute(tag, "title"), Some("Feed".to_string()));
}

#[test]
fn test_extract_attribute_ignores_attribute_like_text_inside_values() {
    let tag = r#"<link title='href = "/not-feed.xml"' href = "/feed.xml">"#;

    assert_eq!(
        extract_attribute(tag, "href"),
        Some("/feed.xml".to_string())
    );
}
