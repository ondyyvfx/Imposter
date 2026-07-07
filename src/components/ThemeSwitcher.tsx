"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  getStoredTheme,
  setStoredTheme,
  THEMES,
} from "@/lib/theme";

/**
 * Компактный переключатель тем оформления.
 * Кнопка-«палитра» → выпадающая панель со свотчами тем. Выбор сохраняется в
 * localStorage и применяется мгновенно (data-theme на <html>). Тема личная —
 * у каждого игрока своя, на состояние комнаты не влияет.
 */
export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function choose(id: string) {
    setTheme(id);
    setStoredTheme(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Тема оформления"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/10 bg-surface text-base transition hover:bg-surface-2"
      >
        🎨
      </button>

      {open && (
        <>
          {/* фон-клик для закрытия */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-56 animate-pop-in rounded-2xl border border-border/10 bg-surface p-2 shadow-2xl shadow-black/30">
            <div className="px-2 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted">
              Тема
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {THEMES.map((t) => {
                const active = t.id === theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => choose(t.id)}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition ${
                      active
                        ? "bg-surface-2 text-fg"
                        : "text-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/15"
                      style={{ backgroundColor: t.bg }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.accent }}
                      />
                    </span>
                    <span className="flex-1 text-left">
                      {t.emoji} {t.label}
                    </span>
                    {active && <span className="text-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
