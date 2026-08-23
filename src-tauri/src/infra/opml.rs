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
    let mut body_depth = 0_usize;
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
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"body" && body_depth == 0 => {
                body_depth = 1;
            }
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"outline" => {
                if body_depth == 0 {
                    continue;
                }
                if outline_stack.len() >= MAX_OUTLINE_DEPTH {
                    return Err(OPML_MALFORMED_XML_ERROR_MESSAGE.to_string());
                }
                body_depth += 1;
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
                if body_depth == 0 {
                    continue;
                }
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
            Ok(Event::End(ref e)) if e.name().as_ref() == b"outline" && body_depth > 0 => {
                outline_stack
                    .pop()
                    .ok_or_else(|| OPML_MALFORMED_XML_ERROR_MESSAGE.to_string())?;
                body_depth -= 1;
            }
            Ok(Event::Start(_)) if body_depth > 0 => {
                body_depth += 1;
            }
            Ok(Event::End(_)) if body_depth > 0 => {
                body_depth -= 1;
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
            .normalized_value(quick_xml::XmlVersion::Implicit1_0)
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
mod tests;
