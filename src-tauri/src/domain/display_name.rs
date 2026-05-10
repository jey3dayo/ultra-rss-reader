#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DisplayNameRisk {
    BidiControl,
    ZeroWidth,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisplayNamePolicy {
    pub display: String,
    pub risks: Vec<DisplayNameRisk>,
}

pub fn normalize_display_name_for_display(name: &str) -> DisplayNamePolicy {
    let display = name.trim().to_string();
    let risks = display
        .chars()
        .filter_map(|ch| {
            if is_bidi_control(ch) {
                Some(DisplayNameRisk::BidiControl)
            } else if is_zero_width_control(ch) {
                Some(DisplayNameRisk::ZeroWidth)
            } else {
                None
            }
        })
        .fold(Vec::new(), |mut risks, risk| {
            if !risks.contains(&risk) {
                risks.push(risk);
            }
            risks
        });

    DisplayNamePolicy { display, risks }
}

fn is_bidi_control(ch: char) -> bool {
    matches!(
        ch,
        '\u{061c}'
            | '\u{200e}'
            | '\u{200f}'
            | '\u{202a}'..='\u{202e}'
            | '\u{2066}'..='\u{2069}'
    )
}

fn is_zero_width_control(ch: char) -> bool {
    matches!(
        ch,
        '\u{200b}' | '\u{200c}' | '\u{200d}' | '\u{2060}' | '\u{feff}'
    )
}

#[cfg(test)]
mod tests {
    use super::{normalize_display_name_for_display, DisplayNameRisk};

    #[test]
    fn display_name_policy_trims_without_nfkc_normalization() {
        let policy = normalize_display_name_for_display("  Ｆｅｅｄ  ");

        assert_eq!(policy.display, "Ｆｅｅｄ");
        assert!(policy.risks.is_empty());
    }

    #[test]
    fn display_name_policy_reports_bidi_controls() {
        let policy = normalize_display_name_for_display("News\u{202e}txt.exe");

        assert_eq!(policy.display, "News\u{202e}txt.exe");
        assert_eq!(policy.risks, vec![DisplayNameRisk::BidiControl]);
    }

    #[test]
    fn display_name_policy_reports_zero_width_controls() {
        let policy = normalize_display_name_for_display("News\u{200d}Feed");

        assert_eq!(policy.display, "News\u{200d}Feed");
        assert_eq!(policy.risks, vec![DisplayNameRisk::ZeroWidth]);
    }

    #[test]
    fn display_name_policy_deduplicates_risks() {
        let policy = normalize_display_name_for_display("\u{202e}A\u{202d}\u{200b}B\u{200d}");

        assert_eq!(
            policy.risks,
            vec![DisplayNameRisk::BidiControl, DisplayNameRisk::ZeroWidth]
        );
    }
}
