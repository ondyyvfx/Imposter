import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim().slice(0, 24);
    const clientId = String(body?.clientId ?? "").trim();
    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase();

    if (!name) {
      return NextResponse.json({ error: "Введите имя" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "Нет clientId" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "Введите код комнаты" }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("code", code)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json(
        { error: "Комната не найдена. Проверьте код." },
        { status: 404 }
      );
    }

    // Уже в комнате с этого устройства? Это переподключение — обновим имя.
    const { data: existing } = await supabase
      .from("player_auth")
      .select("player_id")
      .eq("room_id", room.id)
      .eq("secret", clientId)
      .maybeSingle();

    if (existing?.player_id) {
      await supabase
        .from("players")
        .update({ name })
        .eq("id", existing.player_id);
      return NextResponse.json({
        code,
        status: room.status,
        playerId: existing.player_id,
      });
    }

    // Новый игрок.
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: room.id, name, is_host: false })
      .select("id")
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: playerError?.message ?? "Ошибка входа" },
        { status: 500 }
      );
    }

    const { error: authError } = await supabase.from("player_auth").insert({
      player_id: player.id,
      room_id: room.id,
      secret: clientId,
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({
      code,
      status: room.status,
      playerId: player.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
