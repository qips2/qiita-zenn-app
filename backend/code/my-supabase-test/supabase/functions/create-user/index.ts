// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js"

Deno.serve(async (req) => {
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
  const { text } = await req.json()
  const { error } = await supabase.from('test').insert({ "text" : text });

  const insertData = {
    message: `追加しました。`,
  }

  return new Response(
    JSON.stringify(insertData),
    { headers: { "Content-Type": "application/json" } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create_user' \
    --header 'Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODUxOTI1OTN9.BRbWI_ooNgoLq7tckKBv27Su66g-Agg6KFqgT5twwnwqSgSUDl0SRHyCLTYwwGsDvvxWQ9RFdtdnMF_dRpmUPA' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
