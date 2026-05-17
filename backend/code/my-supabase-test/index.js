import 'dotenv/config';
import { supabase } from './supabaseClient.js';

async function main() {
  // テーブルからすべて取得（例: public.todos）
  const { data, error } = await supabase.from('books').select('*');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', data);
  }
}

main();