import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Браузерный клиент Supabase (anon-ключ).
 * Используется только для realtime-подписки на изменения комнаты/игроков,
 * чтобы лобби и старт игры обновлялись мгновенно. Если ключей нет — вернёт null,
 * и приложение продолжит работать на обычном поллинге.
 */
export function getBrowserClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
