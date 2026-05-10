use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Cursor;

use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::{Reader, Writer};

const OPML_ROOT_ERROR_MESSAGE: &str = "OPML document must contain an <opml> root element";
const OPML_MALFORMED_XML_ERROR_MESSAGE: &str = "OPML document is malformed XML";
const INCLUDE_PRIVACY_SUMMARY_COMMENT: bool = false;
const MAX_OUTLINE_DEPTH: usize = 64;

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
    let mut outline_stack: Vec<Option<String>> = Vec::new();
    let mut saw_opml_root = false;
    let mut saw_root_element = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"opml" => {
                saw_opml_root = true;
                saw_root_element = true;
            }
            Ok(Event::Empty(ref e)) if e.name().as_ref() == b"opml" => {
                saw_opml_root = true;
                saw_root_element = true;
            }
            Ok(Event::Start(_)) | Ok(Event::Empty(_)) if !saw_root_element => {
                return Err(OPML_ROOT_ERROR_MESSAGE.to_string());
            }
            Ok(Event::Decl(_)) if saw_root_element => {
                return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string());
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"outline" => {
                if outline_stack.len() >= MAX_OUTLINE_DEPTH {
                    return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string());
                }
                let attrs = parse_outline_attrs(e)?;
                if let Some(xml_url) = attrs.get("xmlUrl").or(attrs.get("xmlurl")) {
                    feeds.push(OpmlFeed {
                        title: outline_title_or_url(&attrs, xml_url),
                        xml_url: xml_url.clone(),
                        html_url: attrs.get("htmlUrl").or(attrs.get("htmlurl")).cloned(),
                        folder: current_folder(&outline_stack),
                    });
                    outline_stack.push(None);
                } else {
                    // Folder outline (has children via Start event)
                    let name = attrs
                        .get("title")
                        .or(attrs.get("text"))
                        .cloned()
                        .unwrap_or_default();
                    outline_stack.push(Some(name));
                }
            }
            Ok(Event::Empty(ref e)) if e.name().as_ref() == b"outline" => {
                let attrs = parse_outline_attrs(e)?;
                if let Some(xml_url) = attrs.get("xmlUrl").or(attrs.get("xmlurl")) {
                    feeds.push(OpmlFeed {
                        title: outline_title_or_url(&attrs, xml_url),
                        xml_url: xml_url.clone(),
                        html_url: attrs.get("htmlUrl").or(attrs.get("htmlurl")).cloned(),
                        folder: current_folder(&outline_stack),
                    });
                }
                // Empty element without xmlUrl is just ignored (no children)
            }
            Ok(Event::DocType(_)) => return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string()),
            Ok(Event::End(ref e)) if e.name().as_ref() == b"outline" => {
                outline_stack
                    .pop()
                    .ok_or_else(|| OPML_MALFORMED_XML_ERROR_MESSAGE.to_string())?;
            }
            Ok(Event::Eof) => break,
            Err(_) => return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string()),
            _ => {}
        }
    }

    if !outline_stack.is_empty() {
        return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string());
    }

    if !saw_opml_root {
        return Err(OPML_ROOT_ERROR_MESSAGE.to_string());
    }

    Ok(feeds)
}

fn current_folder(outline_stack: &[Option<String>]) -> Option<String> {
    outline_stack.iter().rev().find_map(Clone::clone)
}

fn parse_outline_attrs(
    e: &quick_xml::events::BytesStart<'_>,
) -> Result<HashMap<String, String>, String> {
    let mut map = HashMap::new();
    for attr in e.attributes() {
        let attr =
            attr.map_err(|error| format!("OPML parse error: invalid outline attribute: {error}"))?;
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let value = attr
            .unescape_value()
            .map_err(|error| format!("OPML parse error: invalid outline attribute value: {error}"))?
            .to_string();
        if !value.chars().all(is_xml_10_char) {
            return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string());
        }
        map.insert(key, value);
    }
    Ok(map)
}

fn outline_title_or_url(attrs: &HashMap<String, String>, xml_url: &str) -> String {
    attrs
        .get("title")
        .or(attrs.get("text"))
        .cloned()
        .unwrap_or_else(|| xml_url.to_string())
}

/// Generate OPML 2.0 XML from a list of feeds.
/// Feeds with a folder are grouped under a folder outline; feeds without a folder are top-level.
pub fn generate_opml(title: &str, feeds: &[OpmlFeed]) -> Result<String, String> {
    let mut buf = Cursor::new(Vec::new());
    let mut writer = Writer::new_with_indent(&mut buf, b' ', 2);

    // XML declaration
    writer
        .write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))
        .map_err(|error| format!("OPML generate error: write xml decl failed: {error}"))?;

    // <opml version="2.0">
    let mut opml_start = BytesStart::new("opml");
    opml_start.push_attribute(("version", "2.0"));
    writer
        .write_event(Event::Start(opml_start))
        .map_err(|error| format!("OPML generate error: write opml start failed: {error}"))?;

    // <head><title>...</title></head>
    writer
        .write_event(Event::Start(BytesStart::new("head")))
        .map_err(|error| format!("OPML generate error: write head start failed: {error}"))?;
    writer
        .write_event(Event::Start(BytesStart::new("title")))
        .map_err(|error| format!("OPML generate error: write title start failed: {error}"))?;
    let safe_title = sanitize_xml_value(title);
    writer
        .write_event(Event::Text(BytesText::new(&safe_title)))
        .map_err(|error| format!("OPML generate error: write title text failed: {error}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("title")))
        .map_err(|error| format!("OPML generate error: write title end failed: {error}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("head")))
        .map_err(|error| format!("OPML generate error: write head end failed: {error}"))?;

    // <body>
    writer
        .write_event(Event::Start(BytesStart::new("body")))
        .map_err(|error| format!("OPML generate error: write body start failed: {error}"))?;
    if INCLUDE_PRIVACY_SUMMARY_COMMENT {
        writer
            .write_event(Event::Comment(BytesText::new(
                "This OPML file contains feed and folder names.",
            )))
            .map_err(|error| {
                format!("OPML generate error: write privacy comment failed: {error}")
            })?;
    }

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
        let safe_folder_name = sanitize_xml_value(folder_name);
        let mut folder_elem = BytesStart::new("outline");
        folder_elem.push_attribute(("text", safe_folder_name.as_ref()));
        folder_elem.push_attribute(("title", safe_folder_name.as_ref()));
        writer
            .write_event(Event::Start(folder_elem))
            .map_err(|error| format!("OPML generate error: write folder start failed: {error}"))?;

        if let Some(folder_items) = folder_feeds.get(folder_name) {
            for feed in folder_items {
                write_feed_outline(&mut writer, feed)?;
            }
        }

        writer
            .write_event(Event::End(BytesEnd::new("outline")))
            .map_err(|error| format!("OPML generate error: write folder end failed: {error}"))?;
    }

    // Write top-level feeds
    for feed in &top_level {
        write_feed_outline(&mut writer, feed)?;
    }

    // </body></opml>
    writer
        .write_event(Event::End(BytesEnd::new("body")))
        .map_err(|error| format!("OPML generate error: write body end failed: {error}"))?;
    writer
        .write_event(Event::End(BytesEnd::new("opml")))
        .map_err(|error| format!("OPML generate error: write opml end failed: {error}"))?;

    String::from_utf8(buf.into_inner())
        .map_err(|error| format!("OPML generate error: invalid utf-8 output: {error}"))
}

fn write_feed_outline<W: std::io::Write>(
    writer: &mut Writer<W>,
    feed: &OpmlFeed,
) -> Result<(), String> {
    let safe_title = sanitize_xml_value(&feed.title);
    let safe_xml_url = sanitize_xml_value(&feed.xml_url);
    let safe_html_url = feed.html_url.as_deref().map(sanitize_xml_value);

    let mut elem = BytesStart::new("outline");
    elem.push_attribute(("text", safe_title.as_ref()));
    elem.push_attribute(("title", safe_title.as_ref()));
    elem.push_attribute(("type", "rss"));
    elem.push_attribute(("xmlUrl", safe_xml_url.as_ref()));
    if let Some(html_url) = safe_html_url.as_ref() {
        elem.push_attribute(("htmlUrl", html_url.as_ref()));
    }
    writer
        .write_event(Event::Empty(elem))
        .map_err(|error| format!("OPML generate error: write feed outline failed: {error}"))?;
    Ok(())
}

fn sanitize_xml_value(value: &str) -> Cow<'_, str> {
    if value.chars().all(is_xml_10_char) {
        return Cow::Borrowed(value);
    }

    Cow::Owned(
        value
            .chars()
            .map(|ch| {
                if is_xml_10_char(ch) {
                    ch
                } else {
                    char::REPLACEMENT_CHARACTER
                }
            })
            .collect(),
    )
}

fn is_xml_10_char(ch: char) -> bool {
    matches!(
        ch as u32,
        0x9 | 0xA | 0xD | 0x20..=0xD7FF | 0xE000..=0xFFFD | 0x10000..=0x10FFFF
    )
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
    fn rejects_text_without_opml_root() {
        let result = parse_opml("not xml at all");
        assert_eq!(
            result.unwrap_err(),
            "OPML document must contain an <opml> root element"
        );
    }

    #[test]
    fn rejects_document_with_non_opml_root() {
        let result = parse_opml(r#"<?xml version="1.0"?><rss><opml /></rss>"#);
        assert_eq!(
            result.unwrap_err(),
            "OPML document must contain an <opml> root element"
        );
    }

    #[test]
    fn rejects_malformed_xml() {
        let result = parse_opml(r#"<?xml version="1.0"?><opml><body><outline text="Feed">"#);
        assert_eq!(result.unwrap_err(), OPML_MALFORMED_XML_ERROR_MESSAGE);
    }

    #[test]
    fn rejects_mismatched_xml_as_malformed_xml() {
        let result = parse_opml("<opml><body></opml>");
        assert_eq!(result.unwrap_err(), OPML_MALFORMED_XML_ERROR_MESSAGE);
    }

    #[test]
    fn rejects_root_before_xml_declaration_noise_as_malformed_xml() {
        let result = parse_opml(r#"<opml></opml><?xml version="1.0"?>"#);

        assert_eq!(result.unwrap_err(), OPML_MALFORMED_XML_ERROR_MESSAGE);
    }

    #[test]
    fn rejects_doctype_before_entity_expansion_boundaries() {
        let xml = r#"<?xml version="1.0"?>
<!DOCTYPE opml [
  <!ENTITY private "http://127.0.0.1/feed.xml">
]>
<opml version="2.0">
  <body>
    <outline text="Local" xmlUrl="&private;"/>
  </body>
</opml>"#;

        let result = parse_opml(xml);

        assert_eq!(result.unwrap_err(), OPML_MALFORMED_XML_ERROR_MESSAGE);
    }

    #[test]
    fn keeps_parser_option_boundary_for_comments_processing_instructions_and_cdata() {
        let xml = r#"<?xml version="1.0"?>
<?reader hint="ignored"?>
<!--reader metadata should not affect import-->
<opml version="2.0">
  <head>
    <title><![CDATA[Ignored <Title>]]></title>
  </head>
  <body>
    <![CDATA[ignored body text]]>
    <outline text="Fixture Feed" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(
            feeds,
            vec![OpmlFeed {
                title: "Fixture Feed".to_string(),
                xml_url: "https://example.com/feed.xml".to_string(),
                html_url: None,
                folder: None,
            }],
        );
    }

    #[test]
    fn decodes_predefined_xml_entities_without_custom_entity_expansion() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline
      text="Research &amp; &lt;Daily&gt; &quot;Feed&quot;"
      title="Research &amp; &lt;Daily&gt; &quot;Feed&quot;"
      xmlUrl="https://example.com/feed.xml?tag=research&amp;sort=latest"
      htmlUrl="https://example.com/articles?title=&quot;daily&quot;&amp;topic=&lt;rss&gt;"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Research & <Daily> \"Feed\"");
        assert_eq!(
            feeds[0].xml_url,
            "https://example.com/feed.xml?tag=research&sort=latest"
        );
        assert_eq!(
            feeds[0].html_url,
            Some("https://example.com/articles?title=\"daily\"&topic=<rss>".to_string())
        );
    }

    #[test]
    fn rejects_unknown_xml_entity_in_outline_attribute() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Entity" xmlUrl="https://example.com/&unknown;.xml"/>
  </body>
</opml>"#;

        let error = parse_opml(xml).unwrap_err();

        assert!(
            error.starts_with("OPML parse error: invalid outline attribute value:"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn ignores_lossy_or_unsupported_outline_attribute_keys_without_guessing() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Unsupported key" x�mlUrl="https://example.com/lossy.xml"/>
    <outline text="Valid key" xmlUrl="https://example.com/valid.xml"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Valid key");
        assert_eq!(feeds[0].xml_url, "https://example.com/valid.xml");
    }

    #[test]
    fn rejects_overly_deep_outline_nesting_as_malformed_xml() {
        let mut xml = String::from(r#"<?xml version="1.0"?><opml><body>"#);
        for index in 0..=MAX_OUTLINE_DEPTH {
            xml.push_str(&format!(r#"<outline text="Folder {index}">"#));
        }
        xml.push_str(r#"<outline text="Deep Feed" xmlUrl="https://example.com/deep.xml"/>"#);
        for _ in 0..=MAX_OUTLINE_DEPTH {
            xml.push_str("</outline>");
        }
        xml.push_str("</body></opml>");

        let result = parse_opml(&xml);

        assert_eq!(result.unwrap_err(), OPML_MALFORMED_XML_ERROR_MESSAGE);
    }

    #[test]
    fn accepts_outline_nesting_at_stack_limit() {
        let mut xml = String::from(r#"<?xml version="1.0"?><opml><body>"#);
        for index in 0..MAX_OUTLINE_DEPTH {
            xml.push_str(&format!(r#"<outline text="Folder {index}">"#));
        }
        xml.push_str(r#"<outline text="Deep Feed" xmlUrl="https://example.com/deep.xml"/>"#);
        for _ in 0..MAX_OUTLINE_DEPTH {
            xml.push_str("</outline>");
        }
        xml.push_str("</body></opml>");

        let feeds = parse_opml(&xml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Deep Feed");
        assert_eq!(
            feeds[0].folder,
            Some(format!("Folder {}", MAX_OUTLINE_DEPTH - 1))
        );
    }

    #[test]
    fn rejects_malformed_outline_attribute() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Broken" xmlUrl=https://example.com/rss/>
    <outline text="Valid" xmlUrl="https://example.com/valid.xml"/>
  </body>
</opml>"#;

        let error = parse_opml(xml).unwrap_err();

        assert!(
            error.starts_with("OPML parse error: invalid outline attribute:"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn skips_outline_without_xml_url() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Folder">
      <outline text="Missing URL"/>
      <outline text="With URL" xmlUrl="https://example.com/rss"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "With URL");
        assert_eq!(feeds[0].folder, Some("Folder".to_string()));
    }

    #[test]
    fn maps_nested_folder_to_deepest_folder_name() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Top">
      <outline text="Nested">
        <outline text="Deep Feed" xmlUrl="https://example.com/deep.xml"/>
      </outline>
      <outline text="Top Feed" xmlUrl="https://example.com/top.xml"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].title, "Deep Feed");
        assert_eq!(feeds[0].folder, Some("Nested".to_string()));
        assert_eq!(feeds[1].title, "Top Feed");
        assert_eq!(feeds[1].folder, Some("Top".to_string()));
    }

    #[test]
    fn flattens_nested_folder_policy_to_nearest_folder_and_skips_empty_folders() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Root">
      <outline text="Empty Folder"/>
      <outline text="Child">
        <outline text="Grandchild">
          <outline text="Deep Feed" xmlUrl="https://example.com/deep.xml"/>
        </outline>
        <outline text="Feed With Children" xmlUrl="https://example.com/with-children.xml">
          <outline text="Ignored Child" xmlUrl="https://example.com/ignored-child.xml"/>
        </outline>
      </outline>
    </outline>
    <outline text="Top Feed" xmlUrl="https://example.com/top.xml"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(
            feeds
                .iter()
                .map(|feed| {
                    (
                        feed.title.as_str(),
                        feed.xml_url.as_str(),
                        feed.folder.as_deref(),
                    )
                })
                .collect::<Vec<_>>(),
            vec![
                (
                    "Deep Feed",
                    "https://example.com/deep.xml",
                    Some("Grandchild"),
                ),
                (
                    "Feed With Children",
                    "https://example.com/with-children.xml",
                    Some("Child"),
                ),
                (
                    "Ignored Child",
                    "https://example.com/ignored-child.xml",
                    Some("Child"),
                ),
                ("Top Feed", "https://example.com/top.xml", None),
            ],
        );
    }

    #[test]
    fn parses_reader_opml_fixture_corpus() {
        let cases = [
            (
                include_str!("../../../tests/fixtures/opml/freshrss.opml"),
                vec![
                    OpmlFeed {
                        title: "Example News".to_string(),
                        xml_url: "https://news.example.com/rss".to_string(),
                        html_url: Some("https://news.example.com/".to_string()),
                        folder: Some("News".to_string()),
                    },
                    OpmlFeed {
                        title: "No Folder Feed".to_string(),
                        xml_url: "https://feeds.example.com/no-folder.atom".to_string(),
                        html_url: None,
                        folder: None,
                    },
                ],
            ),
            (
                include_str!("../../../tests/fixtures/opml/feedly.opml"),
                vec![
                    OpmlFeed {
                        title: "Rust Blog".to_string(),
                        xml_url: "https://blog.rust-lang.org/feed.xml".to_string(),
                        html_url: Some("https://blog.rust-lang.org/".to_string()),
                        folder: Some("Engineering".to_string()),
                    },
                    OpmlFeed {
                        title: "Web Platform".to_string(),
                        xml_url: "https://web.dev/feed.xml".to_string(),
                        html_url: None,
                        folder: Some("Engineering".to_string()),
                    },
                    OpmlFeed {
                        title: "Top Level".to_string(),
                        xml_url: "https://example.com/top.xml".to_string(),
                        html_url: Some("https://example.com/".to_string()),
                        folder: None,
                    },
                ],
            ),
            (
                include_str!("../../../tests/fixtures/opml/inoreader-legacy.opml"),
                vec![
                    OpmlFeed {
                        title: "Legacy Title Fallback".to_string(),
                        xml_url: "https://legacy.example.com/rss.xml".to_string(),
                        html_url: Some("https://legacy.example.com/".to_string()),
                        folder: Some("Legacy".to_string()),
                    },
                    OpmlFeed {
                        title: "Title Only".to_string(),
                        xml_url: "https://legacy.example.com/title-only.xml".to_string(),
                        html_url: None,
                        folder: Some("Legacy".to_string()),
                    },
                ],
            ),
            (
                include_str!("../../../tests/fixtures/opml/netnewswire.opml"),
                vec![
                    OpmlFeed {
                        title: "Swift.org".to_string(),
                        xml_url: "https://www.swift.org/atom.xml".to_string(),
                        html_url: Some("https://www.swift.org/".to_string()),
                        folder: Some("Apple".to_string()),
                    },
                    OpmlFeed {
                        title: "Deep Feed".to_string(),
                        xml_url: "https://deep.example.com/feed.xml".to_string(),
                        html_url: None,
                        folder: Some("Nested".to_string()),
                    },
                ],
            ),
        ];

        for (fixture, expected) in cases {
            assert_eq!(parse_opml(fixture).unwrap(), expected);
        }
    }

    #[test]
    fn rejects_reader_opml_fixture_with_invalid_xml_char() {
        let error = parse_opml(include_str!(
            "../../../tests/fixtures/opml/invalid-control-char.opml"
        ))
        .unwrap_err();

        assert!(
            error == OPML_MALFORMED_XML_ERROR_MESSAGE
                || error.starts_with("OPML parse error: invalid outline attribute value:"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn keeps_folder_for_sibling_after_non_empty_feed_outline() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Folder">
      <outline text="Feed With Close" xmlUrl="https://example.com/with-close.xml">
      </outline>
      <outline text="Sibling Feed" xmlUrl="https://example.com/sibling.xml"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].folder, Some("Folder".to_string()));
        assert_eq!(feeds[1].folder, Some("Folder".to_string()));
    }

    #[test]
    fn keeps_sibling_folder_assignment_after_nested_folder_closes() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="First">
      <outline text="Nested">
        <outline text="Nested Feed" xmlUrl="https://example.com/nested.xml"/>
      </outline>
    </outline>
    <outline text="Second">
      <outline text="Second Feed" xmlUrl="https://example.com/second.xml"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].folder, Some("Nested".to_string()));
        assert_eq!(feeds[1].folder, Some("Second".to_string()));
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
    fn keeps_duplicate_outline_urls_in_input_order() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="First Folder">
      <outline text="First" xmlUrl="https://example.com/rss"/>
    </outline>
    <outline text="Second Folder">
      <outline text="Second" xmlUrl="https://example.com/rss"/>
    </outline>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].title, "First");
        assert_eq!(feeds[0].xml_url, "https://example.com/rss");
        assert_eq!(feeds[0].folder, Some("First Folder".to_string()));
        assert_eq!(feeds[1].title, "Second");
        assert_eq!(feeds[1].xml_url, "https://example.com/rss");
        assert_eq!(feeds[1].folder, Some("Second Folder".to_string()));
    }

    #[test]
    fn falls_back_to_xml_url_when_outline_text_and_title_are_missing() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline xmlUrl="https://example.com/rss"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "https://example.com/rss");
    }

    #[test]
    fn rejects_duplicate_outline_attributes_as_malformed_input() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="First" text="Second" xmlUrl="https://example.com/rss"/>
  </body>
</opml>"#;

        let error = parse_opml(xml).unwrap_err();

        assert!(
            error.starts_with("OPML parse error: invalid outline attribute:"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn keeps_attribute_case_policy_to_supported_opml_variants() {
        let xml = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Supported camel" xmlUrl="https://example.com/camel.xml" htmlUrl="https://example.com/camel"/>
    <outline text="Supported lowercase" xmlurl="https://example.com/lower.xml" htmlurl="https://example.com/lower"/>
    <outline text="Unsupported uppercase" XMLURL="https://example.com/upper.xml"/>
  </body>
</opml>"#;

        let feeds = parse_opml(xml).unwrap();

        assert_eq!(feeds.len(), 2);
        assert_eq!(feeds[0].title, "Supported camel");
        assert_eq!(feeds[0].xml_url, "https://example.com/camel.xml");
        assert_eq!(
            feeds[0].html_url,
            Some("https://example.com/camel".to_string())
        );
        assert_eq!(feeds[1].title, "Supported lowercase");
        assert_eq!(feeds[1].xml_url, "https://example.com/lower.xml");
        assert_eq!(
            feeds[1].html_url,
            Some("https://example.com/lower".to_string())
        );
    }

    #[test]
    fn keeps_element_namespace_and_case_policy_strict() {
        let namespaced_root =
            r#"<?xml version="1.0"?><opml:opml xmlns:opml="urn:test"><body /></opml:opml>"#;
        let uppercase_root = r#"<?xml version="1.0"?><OPML><body /></OPML>"#;
        let namespaced_outline = r#"<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <opml:outline xmlns:opml="urn:test" text="Namespaced" xmlUrl="https://example.com/ns.xml"/>
    <OUTLINE text="Uppercase" xmlUrl="https://example.com/upper.xml"/>
    <outline text="Regular" xmlUrl="https://example.com/regular.xml"/>
  </body>
</opml>"#;

        assert_eq!(
            parse_opml(namespaced_root).unwrap_err(),
            OPML_ROOT_ERROR_MESSAGE
        );
        assert_eq!(
            parse_opml(uppercase_root).unwrap_err(),
            OPML_ROOT_ERROR_MESSAGE
        );

        let feeds = parse_opml(namespaced_outline).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Regular");
        assert_eq!(feeds[0].xml_url, "https://example.com/regular.xml");
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

        let xml = generate_opml("My Feeds", &feeds).unwrap();

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

        let xml = generate_opml("Round Trip Test", &original).unwrap();
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
        let xml = generate_opml("Empty", &[]).unwrap();
        let parsed = parse_opml(&xml).unwrap();
        assert!(parsed.is_empty());
    }

    #[test]
    fn generate_opml_escapes_head_title_once() {
        let xml = generate_opml("Team & Research <Daily>", &[]).unwrap();

        assert!(xml.contains("<title>Team &amp; Research &lt;Daily&gt;</title>"));
        assert!(!xml.contains("&amp;amp;"));
        assert!(!xml.contains("&amp;lt;"));
    }

    #[test]
    fn generate_opml_escapes_special_characters() {
        let feeds = vec![OpmlFeed {
            title: "Feed & <Friends> \"Daily\"".to_string(),
            xml_url: "https://example.com/feed?a=1&b=2&quote=\"daily\"".to_string(),
            html_url: Some("https://example.com/path?from=<opml>&q=\"daily\"".to_string()),
            folder: Some("Folder \"quotes\"".to_string()),
        }];

        let xml = generate_opml("Test & Title", &feeds).unwrap();
        assert!(xml.contains("<title>Test &amp; Title</title>"));
        assert!(!xml.contains("&amp;amp;"));
        assert!(xml.contains("quote=&quot;daily&quot;"));
        assert!(xml.contains("from=&lt;opml&gt;"));

        // Should not panic and should round-trip
        let parsed = parse_opml(&xml).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].title, "Feed & <Friends> \"Daily\"");
        assert_eq!(
            parsed[0].xml_url,
            "https://example.com/feed?a=1&b=2&quote=\"daily\""
        );
        assert_eq!(
            parsed[0].html_url,
            Some("https://example.com/path?from=<opml>&q=\"daily\"".to_string())
        );
        assert_eq!(parsed[0].folder, Some("Folder \"quotes\"".to_string()));
    }

    #[test]
    fn generate_opml_replaces_invalid_xml_control_characters_in_all_text_boundaries() {
        let replacement = char::REPLACEMENT_CHARACTER;
        let long_account_title = format!("Title\u{0}Name & 日本語 🚀 {}", "x".repeat(512));
        let feeds = vec![OpmlFeed {
            title: "Feed\u{0}Name & 日本語 🚀".to_string(),
            xml_url: "https://example.com/feed.xml".to_string(),
            html_url: Some("https://example.com/\u{8}".to_string()),
            folder: Some("Folder\u{C}Name & 日本語 🚀".to_string()),
        }];

        let xml = generate_opml(&long_account_title, &feeds).unwrap();
        assert!(!xml.contains('\u{0}'));
        assert!(!xml.contains('\u{8}'));
        assert!(!xml.contains('\u{C}'));
        assert!(xml.contains(&format!("Title{replacement}Name &amp; 日本語 🚀")));

        let parsed = parse_opml(&xml).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(
            parsed[0].title,
            format!("Feed{replacement}Name & 日本語 🚀")
        );
        assert_eq!(parsed[0].xml_url, "https://example.com/feed.xml");
        assert_eq!(
            parsed[0].html_url,
            Some(format!("https://example.com/{replacement}"))
        );
        assert_eq!(
            parsed[0].folder,
            Some(format!("Folder{replacement}Name & 日本語 🚀"))
        );
    }

    #[test]
    fn generate_opml_preserves_empty_feed_title_as_writer_boundary_input() {
        let feeds = vec![OpmlFeed {
            title: String::new(),
            xml_url: "https://example.com/feed.xml".to_string(),
            html_url: None,
            folder: None,
        }];

        let xml = generate_opml("", &feeds).unwrap();
        let parsed = parse_opml(&xml).unwrap();

        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].title, String::new());
    }

    #[test]
    fn generate_opml_handles_large_exports_without_panicking() {
        let feeds = (0..2_000)
            .map(|index| OpmlFeed {
                title: format!("Feed {index:04} & team"),
                xml_url: format!("https://example.com/feed-{index:04}.xml?a=1&b=2"),
                html_url: Some(format!("https://example.com/feed-{index:04}")),
                folder: Some(format!("Folder {}", index % 20)),
            })
            .collect::<Vec<_>>();

        let xml = generate_opml("Large & Export", &feeds).unwrap();
        let parsed = parse_opml(&xml).unwrap();

        assert_eq!(parsed.len(), feeds.len());
        assert_eq!(parsed[0].title, "Feed 0000 & team");
        assert_eq!(
            parsed[1_999].xml_url,
            "https://example.com/feed-1999.xml?a=1&b=2"
        );
    }

    #[test]
    fn generate_opml_omits_privacy_summary_comment_for_round_trip_compatibility() {
        let feeds = vec![OpmlFeed {
            title: "Private Topic".to_string(),
            xml_url: "https://example.com/private.xml".to_string(),
            html_url: None,
            folder: Some("Sensitive Folder".to_string()),
        }];

        let xml = generate_opml("Personal Account", &feeds).unwrap();
        let parsed = parse_opml(&xml).unwrap();

        assert!(
            !xml.contains("<!--"),
            "OPML export intentionally omits privacy summary comments"
        );
        assert_eq!(parsed, feeds);
    }
}
