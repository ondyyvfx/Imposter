import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Без похожих символов (0/O, 1/I), чтобы код было удобно диктовать друзьям.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim().slice(0, 24);
    const clientId = String(body?.clientId ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Введите имя" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "Нет clientId" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Уникальный код комнаты.
    let room: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeCode();
      const { data, error } = await supabase
        .from("rooms")
        .insert({
          code,
          status: "lobby",
          round_number: 0,
          used_word_ids: [],
        })
        .select("id, code")
        .single();

      if (!error && data) {
        room = data;
        break;
      }
      if (error && error.code !== "23505") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (!room) {
      return NextResponse.json(
        { error: "Не удалось создать комнату, попробуйте ещё раз" },
        { status: 500 }
      );
    }

    // Создатель комнаты — игрок и ведущий.
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: room.id, name, is_host: true })
      .select("id")
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: playerError?.message ?? "Ошибка создания игрока" },
        { status: 500 }
      );
    }

    // Секрет устройства → отдельная закрытая таблица.
    const { error: authError } = await supabase.from("player_auth").insert({
      player_id: player.id,
      room_id: room.id,
      secret: clientId,
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Назначаем ведущего по публичному id.
    const { error: updError } = await supabase
      .from("rooms")
      .update({ host_player_id: player.id })
      .eq("id", room.id);
    if (updError) {
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    return NextResponse.json({ code: room.code, playerId: player.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
