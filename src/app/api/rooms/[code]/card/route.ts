import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";
import { jsonNoStore } from "@/lib/apiResponse";
import type { CardResponse, GameMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

/**
 * Персональная карточка игрока на текущий раунд.
 * Сервер сам решает, что показать:
 *  - classic-шпиону: только подсказку (НИКОГДА не слово);
 *  - blind-шпиону («скрытый»): обычную карточку с БЛИЗКИМ словом. Роль наружу
 *    не отдаётся (role = "crew") — по сети не подсмотреть, что он шпион;
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
      .select("word_id, impostor_player_ids, mode, starter_player_id, created_at")
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
      .select("word, hint, near_word, category")
      .eq("id", round.word_id)
      .maybeSingle();

    if (wordError) {
      return jsonNoStore({ error: wordError.message }, 500);
    }
    if (!word) {
      return jsonNoStore({ error: "Слово не найдено" }, 404);
    }

    const mode: GameMode = round.mode === "blind" ? "blind" : "classic";
    const impostorIds: string[] = round.impostor_player_ids ?? [];

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
    const isImpostor = !!myPlayerId && impostorIds.includes(myPlayerId);
    const revealed = room.status === "revealed";

    // Раунд раскрыт — показываем всем полный результат.
    if (revealed) {
      let impostorNames: string[] = [];
      if (impostorIds.length > 0) {
        const { data: imps } = await supabase
          .from("players")
          .select("name")
          .in("id", impostorIds);
        impostorNames = (imps ?? []).map((p) => p.name);
      }

      const payload: CardResponse = {
        role: isImpostor ? "impostor" : "crew",
        mode,
        category: word.category,
        roundNumber: room.round_number,
        revealed: true,
        word: word.word,
        hint: word.hint,
        impostorNames,
        ...(mode === "blind" ? { nearWord: word.near_word } : {}),
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
        mode,
        category: word.category,
        roundNumber: room.round_number,
        revealed: false,
        starterName,
      };
      return jsonNoStore(payload);
    }

    // «Скрытый шпион»: не знает, что он шпион. Отдаём ОБЫЧНУЮ карточку команды,
    // только со словом-соседом. Роль наружу не уходит — не подсмотреть по сети.
    if (isImpostor && mode === "blind") {
      const payload: CardResponse = {
        role: "crew",
        mode,
        category: word.category,
        roundNumber: room.round_number,
        revealed: false,
        word: word.near_word,
        starterName,
      };
      return jsonNoStore(payload);
    }

    // Классический шпион: знает роль, видит только подсказку (без слова и категории).
    if (isImpostor) {
      const payload: CardResponse = {
        role: "impostor",
        mode,
        category: null,
        roundNumber: room.round_number,
        revealed: false,
        hint: word.hint,
        starterName,
      };
      return jsonNoStore(payload);
    }

    const payload: CardResponse = {
      role: "crew",
      mode,
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
