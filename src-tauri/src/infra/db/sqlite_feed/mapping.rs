use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};

pub(super) fn row_to_feed(row: &rusqlite::Row) -> rusqlite::Result<Feed> {
    let folder_id: Option<String> = row.get(2)?;
    Ok(Feed {
        id: FeedId(row.get(0)?),
        account_id: AccountId(row.get(1)?),
        folder_id: folder_id.map(FolderId),
        remote_id: row.get(3)?,
        title: row.get(4)?,
        url: row.get(5)?,
        site_url: row.get(6)?,
        icon: row.get(7)?,
        icon_url: row.get(8)?,
        unread_count: normalize_unread_count(row.get::<_, i64>(9)?),
        reader_mode: row.get(10)?,
        web_preview_mode: row.get(11)?,
    })
}

pub(super) fn normalize_unread_count(count: i64) -> i32 {
    count.clamp(0, i64::from(i32::MAX)) as i32
}
