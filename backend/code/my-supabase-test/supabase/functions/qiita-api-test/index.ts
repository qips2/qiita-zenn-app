// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from "npm:@supabase/supabase-js"

console.log("Hello from Functions!")
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const qiitaToken = Deno.env.get("QIITA_ACCESS_KEY")

// CORSの許可
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

Deno.serve(async (req) => {
  // corsの
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // reqestデータ定義
  const page=1;
  const perPage=20;
  // GET作成
  const resQiita = await fetch(`https://qiita.com/api/v2/items?page=${page}&per_page=${perPage}`,{
    headers: {
      ...corsHeaders,
      "Authorization": `Bearer ${qiitaToken}`,
      "Content-Type": "application/json",
    },
  });

// DBに挿入する型
type QiitaArticleInsert = {
  id: string;
  title: string;
  body: string | null;
  rendered_body: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  private: boolean;
  coediting: boolean;
  comments_count: number;
  likes_count: number;
  reactions_count: number;
  stocks_count: number;
  page_views_count: number | null;
  user_id: string;
  user_name: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
};

// タグデータ型
type QiitaTag = {
  name: string;
  versions: string[];
};

// ユーザーデータ型
type QiitaUser = {
  id: string;
  name: string;
  profile_image_url: string;
};

// 記事データ型
type QiitaArticle = {
  id: string;
  title: string;
  body: string;
  rendered_body: string;
  url: string;
  created_at: string;
  updated_at: string;
  tags: QiitaTag[];
  private: boolean;
  coediting: boolean;
  comments_count: number;
  likes_count: number;
  reactions_count: number;
  stocks_count: number;
  page_views_count: number | null;
  user: QiitaUser;
};

// qiita記事データをsupabaseDB形式へ変形と代入
const toInsertData = (article: QiitaArticle): QiitaArticleInsert => ({
  id:                article.id,
  title:             article.title,
  body:              article.body,
  rendered_body:     article.rendered_body,
  url:               article.url,
  created_at:        article.created_at,
  updated_at:        article.updated_at,
  private:           article.private,
  coediting:         article.coediting,
  comments_count:    article.comments_count,
  likes_count:       article.likes_count,
  reactions_count:   article.reactions_count,
  stocks_count:      article.stocks_count,
  page_views_count:  article.page_views_count ?? null,
  user_id:           article.user.id,
  user_name:         article.user.id,
  user_display_name: article.user.name,
  user_avatar_url:   article.user.profile_image_url
});

// Supabaseへの挿入
const qiitaArticles: QiitaArticle[] = await resQiita.json();
const data: QiitaArticleInsert[] = qiitaArticles.map(toInsertData);

const { data: articles, error } = await supabase
  .from('qiita_articles')
  .upsert(data, {
    onConflict: 'id',        // idが重複したら
    ignoreDuplicates: false,  // 上書き更新（デフォルト） 
  });

  // upsert で ignoreDuplicates: false は スキップする（更新しない）し同じidのものがあってもエラーにならない
  return new Response(
    JSON.stringify(qiitaArticles),
    { 
        headers: { 
        "Content-Type": "application/json",
        ...corsHeaders,
      } 
    },
  )
})