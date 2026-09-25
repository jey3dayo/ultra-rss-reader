use chrono::{DateTime, Utc};

/// Minimum sample size before an expected interval is trusted at all.
const MIN_SAMPLE_ARTICLES: usize = 5;
/// A feed is stale when its age is more than this many expected intervals.
const STALE_INTERVAL_MULTIPLIER: f64 = 4.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct StaleAssessment {
    pub(crate) expected_interval_hours: f64,
    pub(crate) age_hours: f64,
    pub(crate) ratio: f64,
    pub(crate) is_stale: bool,
}

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(|a, b| a.partial_cmp(b).expect("gap hours should never be NaN"));
    let mid = values.len() / 2;
    if values.len().is_multiple_of(2) {
        (values[mid - 1] + values[mid]) / 2.0
    } else {
        values[mid]
    }
}

/// Assesses staleness from the latest `published_at` values for one feed,
/// newest first:
///
/// - `expected_interval` = median gap between consecutive entries among the
///   latest 20 (fewer than 5 samples: skipped).
/// - Stale when `age_of_latest > max(min_hours, 4 × expected_interval)`, so
///   low-frequency feeds on schedule aren't flagged while `min_hours` still
///   catches a high-frequency feed gone silent.
pub(crate) fn assess_staleness(
    now: DateTime<Utc>,
    published_at_desc: &[DateTime<Utc>],
    min_hours: f64,
) -> Option<StaleAssessment> {
    if published_at_desc.len() < MIN_SAMPLE_ARTICLES {
        return None;
    }

    let mut gaps: Vec<f64> = published_at_desc
        .windows(2)
        .map(|pair| (pair[0] - pair[1]).num_seconds() as f64 / 3600.0)
        .filter(|gap| *gap > 0.0)
        .collect();
    if gaps.is_empty() {
        return None;
    }

    let expected_interval_hours = median(&mut gaps);
    let newest = published_at_desc[0];
    let age_hours = (now - newest).num_seconds() as f64 / 3600.0;
    let threshold = min_hours.max(STALE_INTERVAL_MULTIPLIER * expected_interval_hours);
    let ratio = if expected_interval_hours > 0.0 {
        age_hours / expected_interval_hours
    } else {
        f64::INFINITY
    };

    Some(StaleAssessment {
        expected_interval_hours,
        age_hours,
        ratio,
        is_stale: age_hours > threshold,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn published_at_desc(
        now: DateTime<Utc>,
        gaps_hours_newest_first: &[f64],
    ) -> Vec<DateTime<Utc>> {
        let mut timestamps = vec![now];
        let mut cursor = now;
        for gap in gaps_hours_newest_first {
            cursor -= chrono::Duration::milliseconds((gap * 3_600_000.0) as i64);
            timestamps.push(cursor);
        }
        timestamps
    }

    #[test]
    fn weekly_manga_on_schedule_is_not_flagged() {
        let now = "2026-09-25T00:00:00Z".parse::<DateTime<Utc>>().unwrap();
        // Weekly cadence (168h), latest chapter 2 days (48h) ago: well within
        // one expected interval, must not be flagged even though 48h alone
        // sounds long for a "stale" check with a naive fixed threshold.
        let newest = now - chrono::Duration::hours(48);
        let history = published_at_desc(newest, &[168.0, 168.0, 168.0, 168.0, 168.0]);

        let assessment = assess_staleness(now, &history, 6.0).expect("5 samples should assess");

        assert!(
            (assessment.expected_interval_hours - 168.0).abs() < 0.001,
            "expected_interval_hours should be ~168h, got {}",
            assessment.expected_interval_hours
        );
        assert!(
            !assessment.is_stale,
            "on-schedule weekly feed must not be stale"
        );
    }

    #[test]
    fn thirty_minute_cadence_feed_silent_for_three_days_is_flagged() {
        let now = "2026-09-25T00:00:00Z".parse::<DateTime<Utc>>().unwrap();
        // 30-minute cadence, but nothing published for the last 3 days
        // (72h): 4 * 0.5h = 2h alone would flag almost any brief pause, so
        // the 6h `min_hours` floor is what actually matters here, and a
        // genuine 72h silence must still exceed it.
        let newest = now - chrono::Duration::hours(72);
        let history = published_at_desc(newest, &[0.5, 0.5, 0.5, 0.5, 0.5]);

        let assessment = assess_staleness(now, &history, 6.0).expect("5 samples should assess");

        assert!(
            (assessment.expected_interval_hours - 0.5).abs() < 0.001,
            "expected_interval_hours should be ~0.5h, got {}",
            assessment.expected_interval_hours
        );
        assert!(
            assessment.is_stale,
            "a high-frequency feed silent for 3 days must be flagged"
        );
    }

    #[test]
    fn fewer_than_five_articles_is_skipped() {
        let now = Utc::now();
        let history = published_at_desc(now, &[1.0, 1.0, 1.0]);
        assert_eq!(assess_staleness(now, &history, 6.0), None);
    }

    #[test]
    fn all_identical_timestamps_produce_no_positive_gap_and_are_skipped() {
        let now = Utc::now();
        let history = vec![now; 6];
        assert_eq!(assess_staleness(now, &history, 6.0), None);
    }
}
