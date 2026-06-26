import { NextResponse } from "next/server";

/**
 * JSON-ответ, который НЕЛЬЗЯ кэшировать. Критично для опросных эндпоинтов
 * (/state, /card): иначе CDN/прокси может отдавать ведущему устаревший список
 * игроков, и новые участники не появляются даже после обновления страницы.
 */
export function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}
