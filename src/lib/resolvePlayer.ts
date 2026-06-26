import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * По секрету устройства (clientId из localStorage) находит ПУБЛИЧНЫЙ id игрока
 * в данной комнате. Секреты лежат в таблице player_auth, недоступной из браузера,
 * поэтому подсмотреть чужую роль через API нельзя.
 *
 * Возвращает publicId игрока или null, если этот секрет не состоит в комнате.
 */
export async function resolvePlayerId(
  supabase: SupabaseClient,
  roomId: string,
  secret: string
): Promise<string | null> {
  if (!secret) return null;
  const { data } = await supabase
    .from("player_auth")
    .select("player_id")
    .eq("room_id", roomId)
    .eq("secret", secret)
    .maybeSingle();
  return data?.player_id ?? null;
}
