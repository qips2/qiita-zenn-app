// Supabase Edge Function: 記事IDから要約を取得（DB取得 → クレンジング → article-ai-summary 呼び出し）
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { cleanseArticle } from "../_shared/articleCleanse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ARTICLES = 20;
const ARTICLES_TABLE = "qiita_articles";

interface SummaryRequest {
  id?: string;
  ids?: string[];
}

interface QiitaArticleRow {
  id: string;
  title: string | null;
  body: string | null;
  rendered_body: string | null;
}

interface ArticleSummary {
  id: string | null;
  title: string;
  summary: string;
}

interface SummarizeApiResponse {
  summaries?: ArticleSummary[];
  error?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseArticleIds(body: SummaryRequest): string[] | null {
  const ids = new Set<string>();

  if (typeof body.id === "string" && body.id.trim()) {
    ids.add(body.id.trim());
  }

  if (Array.isArray(body.ids)) {
    for (const value of body.ids) {
      if (typeof value === "string" && value.trim()) {
        ids.add(value.trim());
      }
    }
  }

  if (ids.size === 0) return null;
  return [...ids];
}

function pickArticleBody(row: QiitaArticleRow): string {
  return row.body?.trim() || row.rendered_body?.trim() || "";
}

async function fetchArticlesByIds(
  ids: string[],
): Promise<{ articles: QiitaArticleRow[]; missingIds: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from(ARTICLES_TABLE)
    .select("id, title, body, rendered_body")
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to fetch articles: ${error.message}`);
  }

  const articles = (data ?? []) as QiitaArticleRow[];
  const foundIds = new Set(articles.map((article) => article.id));
  const missingIds = ids.filter((id) => !foundIds.has(id));

  return { articles, missingIds };
}

async function callArticleAiSummary(
  articles: Array<{ id: string; title: string; body: string }>,
): Promise<ArticleSummary[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/article-ai-summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ articles }),
  });

  const payload = (await res.json()) as SummarizeApiResponse;
  if (!res.ok) {
    throw new Error(payload.error ?? `article-ai-summary failed (${res.status})`);
  }

  if (!payload.summaries?.length) {
    throw new Error("article-ai-summary returned no summaries.");
  }

  return payload.summaries;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  let body: SummaryRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const ids = parseArticleIds(body);
  if (!ids) {
    return jsonResponse(
      { error: "Provide a non-empty id or ids array." },
      400,
    );
  }

  if (ids.length > MAX_ARTICLES) {
    return jsonResponse(
      { error: `At most ${MAX_ARTICLES} article ids are allowed.` },
      400,
    );
  }

  try {
    const { articles, missingIds } = await fetchArticlesByIds(ids);
    if (missingIds.length > 0) {
      return jsonResponse(
        { error: `Articles not found: ${missingIds.join(", ")}` },
        404,
      );
    }

    const articleById = new Map(articles.map((row) => [row.id, row]));
    const orderedRows = ids
      .map((id) => articleById.get(id))
      .filter((row): row is QiitaArticleRow => row !== undefined);

    const preparedArticles: Array<{ id: string; title: string; body: string }> = [];
    const originalTitles = new Map<string, string>();
    const invalidIds: string[] = [];

    for (const row of orderedRows) {
      const rawTitle = row.title?.trim() ?? "";
      const rawBody = pickArticleBody(row);
      if (!rawTitle || !rawBody) {
        invalidIds.push(row.id);
        continue;
      }

      originalTitles.set(row.id, rawTitle);

      const cleaned = cleanseArticle({
        id: row.id,
        title: rawTitle,
        body: rawBody,
      });

      if (!cleaned.title || !cleaned.body) {
        invalidIds.push(row.id);
        continue;
      }

      preparedArticles.push({
        id: row.id,
        title: cleaned.title,
        body: cleaned.body,
      });
    }

    if (invalidIds.length > 0) {
      return jsonResponse(
        {
          error:
            `Articles have no usable text after cleansing: ${invalidIds.join(", ")}`,
        },
        400,
      );
    }

    const summaries = await callArticleAiSummary(preparedArticles);
    const responseSummaries = summaries.map((summary) => ({
      ...summary,
      title: summary.id
        ? (originalTitles.get(summary.id) ?? summary.title)
        : summary.title,
    }));

    return jsonResponse({ summaries: responseSummaries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("article-summary error:", message);
    return jsonResponse({ error: message }, 502);
  }
});
