import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";
import { jsonNoStore } from "@/lib/apiResponse";
import type { MeInfo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * Публичное состояние комнаты: статус, номер раунда, список игроков (без секретов).
 * Если передан clientId (секрет устройства) — сервер дополнительно вернёт блок
 * me с публичным id игрока и признаком ведущего. Чужие секреты наружу не уходят.
 */
export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const { searchParams } = new URL(req.url);
    const clientId = String(searchParams.get("clientId") ?? "").trim();

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, status, round_number, host_player_id")
      .eq("code", code)
      .maybeSingle();

    if (roomError) {
      return jsonNoStore({ error: roomError.message }, 500);
    }
    if (!room) {
      return jsonNoStore({ error: "Комната не найдена" }, 404);
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, name, is_host")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true });

    if (playersError) {
      return jsonNoStore({ error: playersError.message }, 500);
    }

    let me: MeInfo | null = null;
    if (clientId) {
      const playerId = await resolvePlayerId(supabase, room.id, clientId);
      if (playerId) {
        me = {
          playerId,
          isHost: room.host_player_id === playerId,
          isMember: true,
        };
      }
    }

    return jsonNoStore({
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        round_number: room.round_number,
        host_player_id: room.host_player_id,
      },
      players: players ?? [],
      me,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return jsonNoStore({ error: message }, 500);
  }
}
