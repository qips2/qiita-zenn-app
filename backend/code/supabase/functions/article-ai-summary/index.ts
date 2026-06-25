// Supabase Edge Function: 記事要約AI API（OpenAI互換 LLM API）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_LLM_MODEL = "gemma3:4b";
const LLM_MODEL = Deno.env.get("LLM_MODEL") ?? DEFAULT_LLM_MODEL;
const MAX_ARTICLES = 20;
const MAX_BODY_LENGTH = 12000;

const SYSTEM_PROMPT = `あなたは技術記事の要約アシスタントです。
以下の記事を、句点（。）で区切った3文の日本語要約にまとめてください。

ルール:
- 要約は必ず3文とする（各文は句点で終わる）
- 改行は入れない（3文を連続した1つの文章として返す）
- 要約本文のみ返す（説明文・見出し・マークダウンは不要）`;

export interface ArticleInput {
  id?: string;
  title: string;
  body: string;
}

interface SummarizeRequest {
  articles: ArticleInput[];
}

interface ArticleSummary {
  id: string | null;
  title: string;
  summary: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

function cleanArticleTitle(title: string): string {
  let text = title;
  text = removeControlChars(text);
  text = decodeHtmlEntities(text);
  text = stripHtml(text);
  text = stripMarkdownTitle(text);
  text = removeEmoji(text);
  text = normalizeStraySymbols(text);
  return normalizeWhitespace(text);
}

function cleanArticleBody(body: string): string {
  let text = body;
  text = removeControlChars(text);
  text = decodeHtmlEntities(text);
  text = stripHtml(text);
  text = stripMarkdownBody(text);
  text = removeEmoji(text);
  text = normalizeStraySymbols(text);
  return normalizeWhitespace(text);
}

function cleanseArticle(article: ArticleInput): ArticleInput {
  return {
    ...article,
    title: cleanArticleTitle(article.title),
    body: cleanArticleBody(article.body),
  };
}

function truncateBody(body: string): string {
  if (body.length <= MAX_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_BODY_LENGTH)}…（以降省略）`;
}

function buildUserMessage(article: ArticleInput): string {
  const cleaned = cleanseArticle(article);
  return `タイトル: ${cleaned.title}
本文:
${truncateBody(cleaned.body)}`;
}

function chatCompletionsUrl(apiUrl: string): string {
  const baseUrl = apiUrl.replace(/\/$/, "");
  return `${baseUrl}/v1/chat/completions`;
}

async function callChatCompletions(
  userContent: string,
  apiUrl: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(chatCompletionsUrl(apiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("LLM API returned empty content");
  }

  return text.trim().replace(/\n+/g, "");
}

async function summarizeArticle(
  article: ArticleInput,
  apiUrl: string,
  apiKey: string,
): Promise<ArticleSummary> {
  const userMessage = buildUserMessage(article);
  const summary = await callChatCompletions(userMessage, apiUrl, apiKey);
  return {
    id: article.id ?? null,
    title: article.title,
    summary,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiUrl = Deno.env.get("LLM_API_URL");
  const apiKey = Deno.env.get("LLM_API_KEY");
  if (!apiUrl || !apiKey) {
    return jsonResponse(
      {
        error:
          "LLM_API_URL and LLM_API_KEY must be configured on the Edge Function.",
      },
      500,
    );
  }

  let body: SummarizeRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const articles = body?.articles;
  if (!Array.isArray(articles) || articles.length === 0) {
    return jsonResponse({ error: "articles must be a non-empty array." }, 400);
  }

  if (articles.length > MAX_ARTICLES) {
    return jsonResponse(
      { error: `articles must contain at most ${MAX_ARTICLES} items.` },
      400,
    );
  }

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (!article?.title?.trim() || !article?.body?.trim()) {
      return jsonResponse(
        { error: `articles[${i}] requires non-empty title and body.` },
        400,
      );
    }

    const cleaned = cleanseArticle(article);
    if (!cleaned.title || !cleaned.body) {
      return jsonResponse(
        {
          error:
            `articles[${i}] has no usable text after cleansing title and body.`,
        },
        400,
      );
    }
  }

  try {
    const summaries = await Promise.all(
      articles.map((article) => summarizeArticle(article, apiUrl, apiKey)),
    );

    return jsonResponse({ summaries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("article-ai-summary error:", message);
    return jsonResponse({ error: message }, 502);
  }
});
