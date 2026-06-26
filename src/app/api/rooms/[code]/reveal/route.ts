import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";
import { resolvePlayerId } from "@/lib/resolvePlayer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Раскрыть текущий раунд (только ведущий): кто был шпионом и какое слово.
 * После этого /card отдаёт полный результат всем игрокам.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();
    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.clientId ?? "").trim();

    const supabase = getServiceClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host_player_id, status, round_number")
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
        { error: "Только ведущий может раскрыть раунд" },
        { status: 403 }
      );
    }
    if (room.status === "lobby" || room.round_number === 0) {
      return NextResponse.json({ error: "Раунд ещё не начался" }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update({ status: "revealed" })
      .eq("id", room.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
