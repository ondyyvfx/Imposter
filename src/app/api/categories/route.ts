import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Желаемый порядок категорий в интерфейсе.
const ORDER = ["Аниме", "Фильмы", "Музыка", "Места", "Страны", "Мемы"];

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.from("words").select("category");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const set = new Set<string>((data ?? []).map((r) => r.category));
    const categories = Array.from(set).sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "ru");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return NextResponse.json({ categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
