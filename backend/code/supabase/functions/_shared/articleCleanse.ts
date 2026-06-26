export interface ArticleText {
  id?: string;
  title: string;
  body: string;
}

/** 制御文字・ゼロ幅文字・BOM を除去 */
function removeControlChars(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, "");
}

/** 代表的な HTML エンティティをデコード */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

/** HTML タグ・コメントを除去 */
function stripHtml(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

/** 絵文字を除去 */
function removeEmoji(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, "");
}

/** マークダウン記法をプレーンテキストへ変換（本文向け） */
function stripMarkdownBody(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<https?:\/\/[^>]+>/gi, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, " ")
    .replace(/^[\t ]*[-*+]\s+/gm, "")
    .replace(/^[\t ]*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\|/g, " ")
    .replace(/https?:\/\/\S+/gi, " ");
}

/** マークダウン記法をプレーンテキストへ変換（タイトル向け） */
function stripMarkdownTitle(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1");
}

/** 連続する記号・装飾文字を空白へ正規化 */
function normalizeStraySymbols(text: string): string {
  return text
    .replace(/[※★☆◆◇■□▲△▼▽●○◎□■]+/g, " ")
    .replace(/[~^]+/g, " ")
    .replace(/[•·・]{2,}/g, " ")
    .replace(/[^\p{L}\p{N}\s。、！？「」『』（）()【】ー〜….,:;+\-#%@/\\_]+/gu, " ");
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

export function cleanArticleTitle(title: string): string {
  let text = title;
  text = removeControlChars(text);
  text = decodeHtmlEntities(text);
  text = stripHtml(text);
  text = stripMarkdownTitle(text);
  text = removeEmoji(text);
  text = normalizeStraySymbols(text);
  return normalizeWhitespace(text);
}

export function cleanArticleBody(body: string): string {
  let text = body;
  text = removeControlChars(text);
  text = decodeHtmlEntities(text);
  text = stripHtml(text);
  text = stripMarkdownBody(text);
  text = removeEmoji(text);
  text = normalizeStraySymbols(text);
  return normalizeWhitespace(text);
}

export function cleanseArticle(article: ArticleText): ArticleText {
  return {
    ...article,
    title: cleanArticleTitle(article.title),
    body: cleanArticleBody(article.body),
  };
}
