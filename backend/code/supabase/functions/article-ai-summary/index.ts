// Supabase Edge Function: 記事要約AI API（OpenAI互換 LLM API）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_LLM_MODEL = "qwen2.5:7b";
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

function truncateBody(body: string): string {
  if (body.length <= MAX_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_BODY_LENGTH)}…（以降省略）`;
}

function buildUserMessage(article: ArticleInput): string {
  return `タイトル: ${article.title}
本文:
${truncateBody(article.body)}`;
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
