import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";
import type { CardResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
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
      return NextResponse.json({ error: "Нет clientId" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status, round_number")
      .eq("code", code)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }
    if (room.status === "lobby" || room.round_number === 0) {
      return NextResponse.json({ error: "Раунд ещё не начался" }, { status: 409 });
    }

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("word_id, impostor_player_id, created_at")
      .eq("room_id", room.id)
      .eq("round_number", room.round_number)
      .maybeSingle();

    if (roundError) {
      return NextResponse.json({ error: roundError.message }, { status: 500 });
    }
    if (!round) {
      return NextResponse.json({ error: "Раунд не найден" }, { status: 404 });
    }

    const { data: word, error: wordError } = await supabase
      .from("words")
      .select("word, hint, category")
      .eq("id", round.word_id)
      .maybeSingle();

    if (wordError) {
      return NextResponse.json({ error: wordError.message }, { status: 500 });
    }
    if (!word) {
      return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
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
      };
      return NextResponse.json(payload);
    }

    if (!myPlayerId) {
      return NextResponse.json(
        { error: "Вы не в этой комнате" },
        { status: 403 }
      );
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
      };
      return NextResponse.json(payload);
    }

    if (isImpostor) {
      const payload: CardResponse = {
        role: "impostor",
        category: null, // шпиону не показываем даже категорию — только подсказку
        roundNumber: room.round_number,
        revealed: false,
        hint: word.hint, // только подсказка, без слова
      };
      return NextResponse.json(payload);
    }

    const payload: CardResponse = {
      role: "crew",
      category: word.category,
      roundNumber: room.round_number,
      revealed: false,
      word: word.word,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
