import { Result } from "@praha/byethrow";
import { SHARE_COMMAND_TEXT_MAX_CHARS } from "@/api/schemas/commands";
import { type ArticleDto, openExternalUrl } from "@/api/tauri-commands";
import { normalizeArticleExternalBrowserUrl } from "@/lib/articles/article-actions";

const MAILTO_FALLBACK_SUBJECT = "Untitled article";
const MAILTO_SUBJECT_MAX_LENGTH = 160;
const MAILTO_BODY_MAX_LENGTH = SHARE_COMMAND_TEXT_MAX_CHARS;
const mailtoGraphemeSegmenter =
  typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function truncateGraphemes(value: string, maxGraphemes: number) {
  if (mailtoGraphemeSegmenter !== null) {
    let result = "";
    let count = 0;
    for (const { segment } of mailtoGraphemeSegmenter.segment(value)) {
      if (count >= maxGraphemes) {
        break;
      }
      result += segment;
      count += 1;
    }
    return result;
  }

  let result = "";
  let count = 0;
  for (const character of value) {
    if (count >= maxGraphemes) {
      break;
    }
    result += character;
    count += 1;
  }
  return result;
}

function resolveMailtoValue(value: string | null, fallback: string, maxLength: number) {
  const normalized = value?.trim() || fallback;
  return truncateGraphemes(normalized, maxLength);
}

function buildArticleMailto(article: ArticleDto) {
  const rawUrl = article.url;
  if (!rawUrl?.trim()) {
    return Result.fail(null);
  }

  const normalizedUrlResult = normalizeArticleExternalBrowserUrl(rawUrl);
  if (Result.isFailure(normalizedUrlResult)) {
    return normalizedUrlResult;
  }

  const normalizedUrl = Result.unwrap(normalizedUrlResult);
  const subject = resolveMailtoValue(article.title, MAILTO_FALLBACK_SUBJECT, MAILTO_SUBJECT_MAX_LENGTH);
  const body = resolveMailtoValue(normalizedUrl, normalizedUrl, MAILTO_BODY_MAX_LENGTH);
  return Result.succeed(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

export async function openArticleEmailShare(article: ArticleDto): Promise<void> {
  const mailtoResult = buildArticleMailto(article);
  if (Result.isFailure(mailtoResult)) {
    const error = Result.unwrapError(mailtoResult);
    if (error) {
      throw error;
    }
    return;
  }

  const result = await openExternalUrl(Result.unwrap(mailtoResult));
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }
}
