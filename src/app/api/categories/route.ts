import { getServiceClient } from "@/lib/supabaseServer";
import { jsonNoStore } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

// Желаемый порядок категорий в интерфейсе.
const ORDER = ["Аниме", "Фильмы", "Музыка", "Места", "Страны", "Мемы"];

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.from("words").select("category");

    if (error) {
      return jsonNoStore({ error: error.message }, 500);
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

    return jsonNoStore({ categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return jsonNoStore({ error: message }, 500);
  }
}
