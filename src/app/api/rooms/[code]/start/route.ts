import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PLAYERS = 2;

/**
 * Старт нового раунда (только ведущий).
 * - случайно выбирает шпиона среди игроков комнаты;
 * - случайно выбирает слово, которое ещё НЕ загадывалось в этой комнате;
 * - если слова в выбранной категории закончились — сбрасывает историю
 *   именно для этой категории и начинает заново.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.clientId ?? "").trim();
    const rawCategory = String(body?.category ?? "all").trim();
    const category = rawCategory === "" ? "all" : rawCategory;

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host_player_id, round_number, used_word_ids")
      .eq("code", code)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
    }

    const myPlayerId = await resolvePlayerId(supabase, room.id, clientId);
    if (!myPlayerId || myPlayerId !== room.host_player_id) {
      return NextResponse.json(
        { error: "Только ведущий может начинать игру" },
        { status: 403 }
      );
    }

    // Игроки комнаты (берём публичные id).
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", room.id);

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }
    if (!players || players.length < MIN_PLAYERS) {
      return NextResponse.json(
        { error: `Нужно минимум ${MIN_PLAYERS} игрока, чтобы начать` },
        { status: 400 }
      );
    }

    // Случайный шпион.
    const impostor = players[Math.floor(Math.random() * players.length)];

    // Слова выбранной области.
    let wordsQuery = supabase.from("words").select("id");
    if (category !== "all") {
      wordsQuery = wordsQuery.eq("category", category);
    }
    const { data: scopeWords, error: wordsError } = await wordsQuery;

    if (wordsError) {
      return NextResponse.json({ error: wordsError.message }, { status: 500 });
    }
    if (!scopeWords || scopeWords.length === 0) {
      return NextResponse.json(
        { error: "В выбранной категории нет слов" },
        { status: 400 }
      );
    }

    const usedSet = new Set<string>(room.used_word_ids ?? []);
    const scopeIds = new Set<string>(scopeWords.map((w: { id: string }) => w.id));

    let candidates = scopeWords.filter(
      (w: { id: string }) => !usedSet.has(w.id)
    );
    let newUsed: string[];

    if (candidates.length === 0) {
      // Все слова области использованы → сбрасываем историю только для неё.
      candidates = scopeWords;
      newUsed = [...usedSet].filter((id) => !scopeIds.has(id));
    } else {
      newUsed = [...usedSet];
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const nextRound = room.round_number + 1;

    const { error: roundError } = await supabase.from("rounds").insert({
      room_id: room.id,
      round_number: nextRound,
      word_id: chosen.id,
      impostor_player_id: impostor.id,
    });

    if (roundError) {
      return NextResponse.json({ error: roundError.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        round_number: nextRound,
        used_word_ids: [...newUsed, chosen.id],
        // категорию НЕ храним в rooms (эта таблица читается анонимно) — иначе
        // шпион мог бы подсмотреть её напрямую. Категория отдаётся только в /card.
      })
      .eq("id", room.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, roundNumber: nextRound });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
