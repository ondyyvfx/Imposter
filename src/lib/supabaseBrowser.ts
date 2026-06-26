import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let triedInit = false;

/**
 * Браузерный клиент Supabase (anon-ключ).
 * Используется только для realtime-подписки на изменения комнаты/игроков.
 * Если ключей нет или они кривые — вернёт null, и приложение продолжит
 * работать на обычном поллинге (никогда не роняет страницу).
 */
export function getBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  if (triedInit) return null;
  triedInit = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  try {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
  } catch {
    return null;
  }
}
