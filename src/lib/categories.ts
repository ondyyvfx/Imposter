export interface CategoryMeta {
  label: string;
  emoji: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  Аниме: { label: "Аниме", emoji: "🍥" },
  Фильмы: { label: "Фильмы", emoji: "🎬" },
  Музыка: { label: "Музыка", emoji: "🎵" },
  Места: { label: "Места", emoji: "📍" },
  Страны: { label: "Страны", emoji: "🌍" },
  Мемы: { label: "Мемы", emoji: "😂" },
};

export function catMeta(category?: string | null): CategoryMeta {
  if (!category || category === "all") {
    return { label: "Все категории", emoji: "🎲" };
  }
  return CATEGORY_META[category] ?? { label: category, emoji: "🎲" };
}
