"use client";

export interface ThemeMeta {
  id: string;
  label: string;
  emoji: string;
  /** цвета для превью-свотча в переключателе */
  bg: string;
  accent: string;
}

// Порядок = порядок в переключателе. id совпадает с [data-theme="…"] в globals.css.
export const THEMES: ThemeMeta[] = [
  { id: "midnight", label: "Полночь", emoji: "🌑", bg: "#09090b", accent: "#818cf8" },
  { id: "graphite", label: "Графит", emoji: "🪨", bg: "#111113", accent: "#9ca3af" },
  { id: "ocean", label: "Океан", emoji: "🌊", bg: "#080f17", accent: "#2dd4bf" },
  { id: "grape", label: "Виноград", emoji: "🍇", bg: "#100c17", accent: "#a882ff" },
  { id: "sunset", label: "Закат", emoji: "🔥", bg: "#160f0c", accent: "#fb923c" },
  { id: "light", label: "Дневная", emoji: "☀️", bg: "#f9f9fa", accent: "#6366f1" },
];

export const THEME_KEY = "imposter_theme";
export const DEFAULT_THEME = "midnight";

const ids = new Set(THEMES.map((t) => t.id));

export function getStoredTheme(): string {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t && ids.has(t) ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
}

export function setStoredTheme(id: string): void {
  applyTheme(id);
  try {
    window.localStorage.setItem(THEME_KEY, id);
  } catch {
    /* localStorage недоступен — тема применится на эту сессию */
  }
}
