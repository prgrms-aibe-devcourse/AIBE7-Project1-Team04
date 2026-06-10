import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasSupabaseConfig } from './config.js';

let client = null;

// Supabase 클라이언트를 만든다
export function initSupabase() {
  if (!hasSupabaseConfig()) {
    client = null;
    return client;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// Supabase 클라이언트를 반환한다
export function getSupabase() {
  return client;
}

// Supabase 연결을 검증한다
export function requireSupabase() {
  if (!client) {
    throw new Error('Supabase가 초기화되지 않았습니다.');
  }

  return client;
}
