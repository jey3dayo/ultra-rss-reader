use std::collections::HashMap;
use std::io::Cursor;

use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::{Reader, Writer};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpmlFeed {
    pub title: String,
    pub xml_url: String,
    pub html_url: Option<String>,
    pub folder: Option<String>,
}

pub fn parse_opml(xml: &str) -> Result<Vec<OpmlFeed>, String> {
    let mut reader = Reader::from_str(xml);
    let mut feeds = Vec::new();
    let mut folder_stack: Vec<String> = Vec::new();
    let mut depth: usize = 0;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"outline" => {
                let attrs = parse_outline_attrs(e);
                if let Some(xml_url) = attrs.get("xmlUrl").or(attrs.get("xmlurl")) {
                    feeds.push(OpmlFeed {
                        title: attrs
                            .get("title")
                            .or(attrs.get("text"))
                            .cloned()
                            .unwrap_or_default(),
                        xml_url: xml_url.clone(),
                        html_url: attrs.get("htmlUrl").or(attrs.get("htmlurl")).cloned(),
                        folder: folder_stack.last().cloned(),
                    });
                    depth += 1;
                } else {
                    // Folder outline (has children via Start event)
                    let name = attrs
                        .get("title")
                        .or(attrs.get("text"))
                        .cloned()
                        .unwrap_or_default();
                    folder_stack.push(name);
                    depth += 1;
                }
            }
            Ok(Event::Empty(ref e)) if e.name().as_ref() == b"outline" => {
                let attrs = parse_outline_attrs(e);
                if let Some(xml_url) = attrs.get("xmlUrl").or(attrs.get("xmlurl")) {
                    feeds.push(OpmlFeed {
                        title: attrs
                            .get("title")
                            .or(attrs.get("text"))
                            .cloned()
                            .unwrap_or_default(),
                        xml_url: xml_url.clone(),
                        html_url: attrs.get("htmlUrl").or(attrs.get("htmlurl")).cloned(),
                        folder: folder_stack.last().cloned(),
                    });
                }
                // Empty element without xmlUrl is just ignored (no children)
            }
            Ok(Event::End(ref e)) if e.name().as_ref() == b"outline" => {
                depth = depth.saturating_sub(1);
                // If depth matches folder_stack, pop the folder
                if folder_stack.len() > depth {
                    folder_stack.pop();
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("OPML parse error: {e}")),
            _ => {}
        }
    }

    Ok(feeds)
}

fn parse_outline_attrs(e: &quick_xml::events::BytesStart<'_>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for attr in e.attributes().flatten() {
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let value = attr.unescape_value().unwrap_or_default().to_string();
        map.insert(key, value);
    }
    map
}

/// Generate OPML 2.0 XML from a list of feeds.
/// Feeds with a folder are grouped under a folder outline; feeds without a folder are top-level.
pub fn generate_opml(title: &str, feeds: &[OpmlFeed]) -> String {
    let mut buf = Cursor::new(Vec::new());
    let mut writer = Writer::new_with_indent(&mut buf, b' ', 2);

    // XML declaration
    writer
        .write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))
        .expect("write xml decl");

    // <opml version="2.0">
    let mut opml_start = BytesStart::new("opml");
    opml_start.push_attribute(("version", "2.0"));
    writer
        .write_event(Event::Start(opml_start))
        .expect("write opml start");

    // <head><title>...</title></head>
    writer
        .write_event(Event::Start(BytesStart::new("head")))
        .expect("write head start");
    writer
        .write_event(Event::Start(BytesStart::new("title")))
        .expect("write title start");
    writer
        .write_event(Event::Text(BytesText::new(title)))
        .expect("write title text");
    writer
        .write_event(Event::End(BytesEnd::new("title")))
        .expect("write title end");
    writer
        .write_event(Event::End(BytesEnd::new("head")))
        .expect("write head end");

    // <body>
    writer
        .write_event(Event::Start(BytesStart::new("body")))
        .expect("write body start");

    // Group feeds: folder_name -> feeds, preserving insertion order
    let mut folder_order: Vec<String> = Vec::new();
    let mut folder_feeds: HashMap<String, Vec<&OpmlFeed>> = HashMap::new();
    let mut top_level: Vec<&OpmlFeed> = Vec::new();

    for feed in feeds {
        match &feed.folder {
            Some(folder_name) => {
                if !folder_feeds.contains_key(folder_name) {
                    folder_order.push(folder_name.clone());
                }
                folder_feeds
                    .entry(folder_name.clone())
                    .or_default()
                    .push(feed);
            }
            None => top_level.push(feed),
        }
    }

    // Write folder outlines
    for folder_name in &folder_order {
        let mut folder_elem = BytesStart::new("outline");
        folder_elem.push_attribute(("text", folder_name.as_str()));
        folder_elem.push_attribute(("title", folder_name.as_str()));
        writer
            .write_event(Event::Start(folder_elem))
            .expect("write folder start");

        if let Some(folder_items) = folder_feeds.get(folder_name) {
            for feed in folder_items {
                write_feed_outline(&mut writer, feed);
            }
        }

        writer
            .write_event(Event::End(BytesEnd::new("outline")))
            .expect("write folder end");
    }

    // Write top-level feeds
    for feed in &top_level {
        write_feed_outline(&mut writer, feed);
    }

    // </body></opml>
    writer
        .write_event(Event::End(BytesEnd::new("body")))
        .expect("write body end");
    writer
        .write_event(Event::End(BytesEnd::new("opml")))
        .expect("write opml end");

    String::from_utf8(buf.into_inner()).expect("valid utf-8")
}

fn write_feed_outline<W: std::io::Write>(writer: &mut Writer<W>, feed: &OpmlFeed) {
    let mut elem = BytesStart::new("outline");
    elem.push_attribute(("text", feed.title.as_str()));
    elem.push_attribute(("title", feed.title.as_str()));
    elem.push_attribute(("type", "rss"));
    elem.push_attribute(("xmlUrl", feed.xml_url.as_str()));
    if let Some(ref html_url) = feed.html_url {
        elem.push_attribute(("htmlUrl", html_url.as_str()));
    }
    writer
        .write_event(Event::Empty(elem))
        .expect("write feed outline");
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_OPML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>My Feeds</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Ars Technica" title="Ars Technica" type="rss" xmlUrl="https://feeds.arstechnica.com/arstechnica/index" htmlUrl="https://arstechnica.com"/>
      <outline text="Hacker News" title="Hacker News" type="rss" xmlUrl="https://news.ycombinator.com/rss" htmlUrl="https://news.ycombinator.com"/>
    </outline>
    <outline text="News" title="News">
      <outline text="NHK" type="rss" xmlUrl="https://www.nhk.or.jp/rss/news/cat0.xml"/>
    </outline>
    <outline text="Standalone Feed" type="rss" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>"#;

    #[test]
    fn parses_feeds_with_folders() {
        let feeds = parse_opml(SAMPLE_OPML).unwrap();
        assert_eq!(feeds.len(), 4);

        assert_eq!(feeds[0].title, "Ars Technica");
        assert_eq!(
            feeds[0].xml_url,
            "https://feeds.arstechnica.com/arstechnica/index"
        );
        assert_eq!(
            feeds[0].html_url,
            Some("https://arstechnica.com".to_string())
        );
        assert_eq!(feeds[0].folder, Some("Tech".to_string()));

        assert_eq!(feeds[1].title, "Hacker News");
        assert_eq!(feeds[1].folder, Some("Tech".to_string()));

        assert_eq!(feeds[2].title, "NHK");
        assert_eq!(feeds[2].folder, Some("News".to_string()));
        assert_eq!(feeds[2].html_url, None);

        assert_eq!(feeds[3].title, "Standalone Feed");
        assert_eq!(feeds[3].folder, None);
    }

    #[test]
    fn handles_empty_opml() {
        let feeds = parse_opml(r#"<?xml version="1.0"?><opml><body></body></opml>"#).unwrap();
        assert!(feeds.is_empty());
    }

    #[test]
    fn handles_minimal_feed() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Standalone" type="rss" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>"#;
        let feeds = parse_opml(xml).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Standalone");
        assert_eq!(feeds[0].folder, None);
    }

    #[test]
    fn handles_malformed_opml_gracefully() {
        // quick-xml is lenient; malformed input returns empty feeds
        let result = parse_opml("not xml at all");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn uses_text_when_title_missing() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="MyFolder">
      <outline text="MyFeed" xmlUrl="https://example.com/rss"/>
    </outline>
  </body>
</opml>"#;
        let feeds = parse_opml(xml).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "MyFeed");
        assert_eq!(feeds[0].folder, Some("MyFolder".to_string()));
    }

    #[test]
    fn generate_opml_produces_valid_xml() {
        let feeds = vec![
            OpmlFeed {
                title: "Ars Technica".to_string(),
                xml_url: "https://feeds.arstechnica.com/arstechnica/index".to_string(),
                html_url: Some("https://arstechnica.com".to_string()),
                folder: Some("Tech".to_string()),
            },
            OpmlFeed {
                title: "Hacker News".to_string(),
                xml_url: "https://news.ycombinator.com/rss".to_string(),
                html_url: Some("https://news.ycombinator.com".to_string()),
                folder: Some("Tech".to_string()),
            },
            OpmlFeed {
                title: "NHK".to_string(),
                xml_url: "https://www.nhk.or.jp/rss/news/cat0.xml".to_string(),
                html_url: None,
                folder: Some("News".to_string()),
            },
            OpmlFeed {
                title: "Standalone Feed".to_string(),
                xml_url: "https://example.com/feed.xml".to_string(),
                html_url: None,
                folder: None,
            },
        ];

        let xml = generate_opml("My Feeds", &feeds);

        // Basic structure checks
        assert!(xml.contains(r#"<?xml version="1.0" encoding="UTF-8"?>"#));
        assert!(xml.contains(r#"<opml version="2.0">"#));
        assert!(xml.contains("<title>My Feeds</title>"));
        assert!(xml.contains(r#"xmlUrl="https://feeds.arstechnica.com/arstechnica/index""#));
        assert!(xml.contains(r#"xmlUrl="https://example.com/feed.xml""#));
    }

    #[test]
    fn generate_then_parse_round_trip() {
        let original = vec![
            OpmlFeed {
                title: "Feed A".to_string(),
                xml_url: "https://a.com/rss".to_string(),
                html_url: Some("https://a.com".to_string()),
                folder: Some("Folder1".to_string()),
            },
            OpmlFeed {
                title: "Feed B".to_string(),
                xml_url: "https://b.com/rss".to_string(),
                html_url: None,
                folder: Some("Folder1".to_string()),
            },
            OpmlFeed {
                title: "Feed C".to_string(),
                xml_url: "https://c.com/rss".to_string(),
                html_url: Some("https://c.com".to_string()),
                folder: None,
            },
        ];

        let xml = generate_opml("Round Trip Test", &original);
        let parsed = parse_opml(&xml).unwrap();

        assert_eq!(parsed.len(), original.len());
        for (orig, parsed) in original.iter().zip(parsed.iter()) {
            assert_eq!(orig.title, parsed.title);
            assert_eq!(orig.xml_url, parsed.xml_url);
            assert_eq!(orig.html_url, parsed.html_url);
            assert_eq!(orig.folder, parsed.folder);
        }
    }

    #[test]
    fn generate_opml_empty_feeds() {
        let xml = generate_opml("Empty", &[]);
        let parsed = parse_opml(&xml).unwrap();
        assert!(parsed.is_empty());
    }

    #[test]
    fn generate_opml_escapes_special_characters() {
        let feeds = vec![OpmlFeed {
            title: "Feed & <Friends>".to_string(),
            xml_url: "https://example.com/feed?a=1&b=2".to_string(),
            html_url: None,
            folder: Some("Folder \"quotes\"".to_string()),
        }];

        let xml = generate_opml("Test & Title", &feeds);
        // Should not panic and should round-trip
        let parsed = parse_opml(&xml).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].title, "Feed & <Friends>");
        assert_eq!(parsed[0].xml_url, "https://example.com/feed?a=1&b=2");
        assert_eq!(parsed[0].folder, Some("Folder \"quotes\"".to_string()));
    }
}
