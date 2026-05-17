// Supabase Edge Function: Zenn記事取得
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// CORSの許可
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

// 型定義
interface ZennUser {
  id: number;
  username: string;
  name: string;
  avatar_small_url: string;
}

interface ZennPublication {
  id: number;
  name: string;
  display_name: string;
  avatar_small_url: string;
  beta_stats: boolean;
  avatar_registered: boolean;
}

interface ZennArticle {
  id: number;
  post_type: "Article";
  title: string;
  slug: string;
  comments_count: number;
  liked_count: number;
  body_letters_count: number;
  article_type: "tech" | "idea";
  emoji: string;
  is_suspending_private: boolean;
  published_at: string;
  body_updated_at: string;
  source_repo_updated_at: string | null;
  pinned: boolean;
  path: string;
  user: ZennUser;
  publication: ZennPublication | null;
}

interface ZennArticlesResponse {
  articles: ZennArticle[];
  next_page: number | null;
}

// 処理
Deno.serve(async (req) => {
  const { username } = await req.json()
 
  const res = await fetch(`https://zenn.dev/api/articles?username=${username}&order=latest`)
  const data = await res.json()
 
  return new Response(
    JSON.stringify(data),
    { 
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    },
  )
})