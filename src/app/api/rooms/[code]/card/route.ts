import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";
import { jsonNoStore } from "@/lib/apiResponse";
import type { CardResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * Персональная карточка игрока на текущий раунд.
 * Сервер сам решает, что показать:
 *  - шпиону: только подсказку (НИКОГДА не слово);
 *  - команде: загаданное слово;
 *  - зашедшему в середине раунда: статус "наблюдатель" (сыграет со следующего раунда).
 * Когда ведущий раскрывает раунд (status = revealed) — всем приходит полный результат.
 */
export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const { searchParams } = new URL(req.url);
    const clientId = String(searchParams.get("clientId") ?? "").trim();

    if (!clientId) {
      return jsonNoStore({ error: "Нет clientId" }, 400);
    }

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status, round_number")
      .eq("code", code)
      .maybeSingle();

    if (roomError) {
      return jsonNoStore({ error: roomError.message }, 500);
    }
    if (!room) {
      return jsonNoStore({ error: "Комната не найдена" }, 404);
    }
    if (room.status === "lobby" || room.round_number === 0) {
      return jsonNoStore({ error: "Раунд ещё не начался" }, 409);
    }

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("word_id, impostor_player_id, starter_player_id, created_at")
      .eq("room_id", room.id)
      .eq("round_number", room.round_number)
      .maybeSingle();

    if (roundError) {
      return jsonNoStore({ error: roundError.message }, 500);
    }
    if (!round) {
      return jsonNoStore({ error: "Раунд не найден" }, 404);
    }

    const { data: word, error: wordError } = await supabase
      .from("words")
      .select("word, hint, category")
      .eq("id", round.word_id)
      .maybeSingle();

    if (wordError) {
      return jsonNoStore({ error: wordError.message }, 500);
    }
    if (!word) {
      return jsonNoStore({ error: "Слово не найдено" }, 404);
    }

    // Имя того, кто ходит первым (публично — одинаково для всех).
    let starterName: string | undefined;
    if (round.starter_player_id) {
      const { data: starter } = await supabase
        .from("players")
        .select("name")
        .eq("id", round.starter_player_id)
        .maybeSingle();
      starterName = starter?.name ?? undefined;
    }

    const myPlayerId = await resolvePlayerId(supabase, room.id, clientId);
    const isImpostor =
      !!myPlayerId && round.impostor_player_id === myPlayerId;
    const revealed = room.status === "revealed";

    // Раунд раскрыт — показываем всем полный результат.
    if (revealed) {
      const { data: impostorPlayer } = await supabase
        .from("players")
        .select("name")
        .eq("id", round.impostor_player_id)
        .maybeSingle();

      const payload: CardResponse = {
        role: isImpostor ? "impostor" : "crew",
        category: word.category,
        roundNumber: room.round_number,
        revealed: true,
        word: word.word,
        hint: word.hint,
        impostorName: impostorPlayer?.name ?? "—",
        starterName,
      };
      return jsonNoStore(payload);
    }

    if (!myPlayerId) {
      return jsonNoStore({ error: "Вы не в этой комнате" }, 403);
    }

    // Зашёл в середине раунда (после его старта) и не шпион → наблюдатель.
    const { data: me } = await supabase
      .from("players")
      .select("created_at")
      .eq("id", myPlayerId)
      .maybeSingle();

    const joinedAfterRound =
      me?.created_at && new Date(me.created_at) > new Date(round.created_at);

    if (joinedAfterRound && !isImpostor) {
      const payload: CardResponse = {
        role: "spectator",
        category: word.category,
        roundNumber: room.round_number,
        revealed: false,
        starterName,
      };
      return jsonNoStore(payload);
    }

    if (isImpostor) {
      const payload: CardResponse = {
        role: "impostor",
        category: null, // шпиону не показываем даже категорию — только подсказку
        roundNumber: room.round_number,
        revealed: false,
        hint: word.hint, // только подсказка, без слова
        starterName,
      };
      return jsonNoStore(payload);
    }

    const payload: CardResponse = {
      role: "crew",
      category: word.category,
      roundNumber: room.round_number,
      revealed: false,
      word: word.word,
      starterName,
    };
    return jsonNoStore(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return jsonNoStore({ error: message }, 500);
  }
}
