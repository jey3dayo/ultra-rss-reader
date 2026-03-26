use std::collections::HashMap;

use quick_xml::events::Event;
use quick_xml::Reader;

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
}
