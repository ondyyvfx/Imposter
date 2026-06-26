"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientId, getStoredName, setStoredName } from "@/lib/identity";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import { catMeta } from "@/lib/categories";
import type { CardResponse, PlayerPublic, RoomState } from "@/lib/types";

/* ───────────────────────── маленькие компоненты ───────────────────────── */

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-lime-500",
  "bg-sky-500",
];

function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ name }: { name: string }) {
  const letter = (name.trim()[0] || "?").toUpperCase();
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colorFor(
        name
      )}`}
    >
      {letter}
    </span>
  );
}

function CategoryPicker({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const options = ["all", ...categories];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const m = catMeta(opt);
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              active
                ? "border-transparent bg-white text-slate-900"
                : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        );
      })}
    </div>
  );
}

function FlipCard({
  card,
  flipped,
  onFlip,
}: {
  card: CardResponse;
  flipped: boolean;
  onFlip: () => void;
}) {
  const isImpostor = card.role === "impostor";
  const meta = card.category ? catMeta(card.category) : null;
  return (
    <div
      className={`flip-card mx-auto h-80 w-full max-w-[20rem] sm:h-96 ${
        flipped ? "is-flipped" : ""
      }`}
      onClick={onFlip}
      role="button"
      aria-label="Перевернуть карточку"
    >
      <div className="flip-inner cursor-pointer select-none">
        {/* лицевая сторона */}
        <div className="flip-face flip-shine border border-white/15 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 text-center shadow-2xl shadow-black/40">
          <div className="text-6xl">🎭</div>
          <div className="mt-5 text-xl font-semibold">Нажми, чтобы открыть</div>
          <div className="mt-1.5 text-sm text-white/70">
            Свою роль увидишь только ты
          </div>
        </div>

        {/* оборотная сторона */}
        <div
          className={`flip-face flip-back border px-6 text-center shadow-2xl shadow-black/40 ${
            isImpostor
              ? "border-red-300/30 bg-gradient-to-br from-rose-700 via-red-700 to-orange-700"
              : "border-emerald-300/30 bg-gradient-to-br from-emerald-700 via-teal-700 to-green-700"
          }`}
        >
          {isImpostor ? (
            <>
              <div className="text-5xl">🕵️</div>
              <div className="mt-3 text-2xl font-extrabold tracking-wide">
                ТЫ ШПИОН
              </div>
              <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-white/70">
                Подсказка
              </div>
              <div className="mt-1.5 text-lg font-medium leading-snug">
                {card.hint}
              </div>
              {meta && (
                <div className="mt-5 rounded-full bg-black/25 px-3 py-1 text-xs">
                  {meta.emoji} {meta.label}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">
                Загаданное слово
              </div>
              <div className="mt-3 break-words text-3xl font-extrabold leading-tight">
                {card.word}
              </div>
              {meta && (
                <div className="mt-6 rounded-full bg-black/25 px-3 py-1 text-xs">
                  {meta.emoji} {meta.label}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── основной экран ───────────────────────────── */

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();

  const [state, setState] = useState<RoomState | null>(null);
  const [card, setCard] = useState<CardResponse | null>(null);
  const [flipped, setFlipped] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);

  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const prevRound = useRef(-1);
  const prevStatus = useRef("");

  const me = state?.me ?? null;
  const isMember = !!me?.isMember;
  const isHost = !!me?.isHost;

  const fetchState = useCallback(async () => {
    try {
      const cid = getClientId();
      const res = await fetch(
        `/api/rooms/${code}/state?clientId=${encodeURIComponent(cid)}`,
        { cache: "no-store" }
      );
      if (res.status === 404) {
        setError("Комната не найдена. Проверьте код.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки");
      setState(data as RoomState);
      setError(null);
    } catch {
      // временный сбой сети — оставляем прежнее состояние, повторим на следующем тике
    } finally {
      setLoading(false);
    }
  }, [code]);

  const fetchCard = useCallback(async () => {
    try {
      const cid = getClientId();
      const res = await fetch(
        `/api/rooms/${code}/card?clientId=${encodeURIComponent(cid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as CardResponse;
      setCard(data);
    } catch {
      /* проигнорируем разовый сбой */
    }
  }, [code]);

  // первичная загрузка
  useEffect(() => {
    setJoinName(getStoredName());
    fetchState();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.categories)) setCategories(d.categories);
      })
      .catch(() => {});
  }, [fetchState]);

  // поллинг как надёжный фолбэк (работает даже без realtime)
  useEffect(() => {
    const id = setInterval(fetchState, 2500);
    return () => clearInterval(id);
  }, [fetchState]);

  // realtime для мгновенных обновлений (если заданы NEXT_PUBLIC ключи)
  useEffect(() => {
    const supa = getBrowserClient();
    const roomId = state?.room.id;
    if (!supa || !roomId) return;

    const channel = supa
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => fetchState()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => fetchState()
      )
      .subscribe();

    return () => {
      supa.removeChannel(channel);
    };
  }, [state?.room.id, fetchState]);

  // подгружаем персональную карточку при смене раунда/статуса
  useEffect(() => {
    if (!state) return;
    const { status, round_number } = state.room;

    if (status === "lobby") {
      setCard(null);
      setFlipped(false);
      prevRound.current = round_number;
      prevStatus.current = status;
      return;
    }

    const roundChanged = round_number !== prevRound.current;
    const statusChanged = status !== prevStatus.current;

    if (roundChanged) setFlipped(false);
    if (roundChanged || statusChanged) fetchCard();

    prevRound.current = round_number;
    prevStatus.current = status;
  }, [state, fetchCard]);

  /* ─────────────── действия ─────────────── */

  async function handleStart() {
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId(), category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await fetchState();
      await fetchCard();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal() {
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getClientId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await fetchState();
      await fetchCard();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom() {
    const trimmed = joinName.trim();
    if (!trimmed) {
      setActionError("Введите имя");
      return;
    }
    setStoredName(trimmed);
    setJoining(true);
    setActionError(null);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, code, clientId: getClientId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка");
      await fetchState();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setJoining(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard может быть недоступен */
    }
  }

  async function shareLink() {
    const url = `${window.location.origin}/room/${code}`;
    const nav = navigator as Navigator & {
      share?: (data: {
        title?: string;
        text?: string;
        url?: string;
      }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: "Шпион", text: `Заходи в комнату ${code}`, url });
      } catch {
        /* пользователь отменил шеринг */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* ignore */
      }
    }
  }

  function leave() {
    router.push("/");
  }

  /* ─────────────── экраны ─────────────── */

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl">🤷</div>
        <h1 className="mt-4 text-xl font-semibold">{error}</h1>
        <button
          onClick={leave}
          className="mt-6 rounded-xl bg-white px-5 py-2.5 font-semibold text-slate-900"
        >
          На главную
        </button>
      </main>
    );
  }

  if (loading && !state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  if (!state) return null;

  // Категорию берём ТОЛЬКО из карточки (она role-aware). У шпиона её нет —
  // значит и в шапке чип категории ему не покажется.
  const cat = card?.category ? catMeta(card.category) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      {/* верхняя панель */}
      <div className="flex items-center justify-between">
        <button
          onClick={leave}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Выйти
        </button>
        <button
          onClick={copyCode}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-bold tracking-[0.25em] transition hover:bg-white/10"
        >
          {copied ? "Скопировано ✓" : code}
        </button>
      </div>

      {/* НЕ участник: форма входа */}
      {!isMember && (
        <div className="mt-10 animate-pop-in rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <h2 className="text-center text-lg font-semibold">Зайти в комнату</h2>
          <div className="mt-1 text-center text-3xl font-black tracking-[0.3em]">
            {code}
          </div>
          {state.room.status !== "lobby" && (
            <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-200">
              Игра уже идёт — вы сыграете со следующего раунда.
            </p>
          )}
          <label className="mb-1.5 mt-4 block text-xs text-slate-400">
            Ваше имя
          </label>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Например, Али"
            maxLength={24}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
          />
          {actionError && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {actionError}
            </p>
          )}
          <button
            onClick={handleJoinRoom}
            disabled={joining}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {joining ? "Подождите…" : "Войти"}
          </button>
        </div>
      )}

      {/* ЛОББИ */}
      {isMember && state.room.status === "lobby" && (
        <>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-xl backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Код комнаты
            </div>
            <div className="mt-1 text-4xl font-black tracking-[0.3em]">{code}</div>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={copyCode}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
              >
                {copied ? "Скопировано ✓" : "Копировать код"}
              </button>
              <button
                onClick={shareLink}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
              >
                Поделиться
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Игроки</h2>
              <span className="text-sm text-slate-500">
                {state.players.length}
              </span>
            </div>
            <ul className="space-y-2">
              {state.players.map((p: PlayerPublic) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <Avatar name={p.name} />
                  <span className="font-medium">
                    {p.name}
                    {p.id === me?.playerId && (
                      <span className="text-slate-500"> (вы)</span>
                    )}
                  </span>
                  {p.is_host && (
                    <span className="ml-auto rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs text-amber-300">
                      ведущий
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <div className="mt-6 space-y-3">
              <p className="text-xs text-slate-400">Категория слов</p>
              <CategoryPicker
                categories={categories}
                value={category}
                onChange={setCategory}
                disabled={busy}
              />
              {actionError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {actionError}
                </p>
              )}
              <button
                onClick={handleStart}
                disabled={busy || state.players.length < 2}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold text-white shadow-lg shadow-indigo-900/40 transition active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "Запуск…" : "Начать игру"}
              </button>
              {state.players.length < 2 && (
                <p className="text-center text-xs text-slate-500">
                  Нужно минимум 2 игрока, чтобы начать
                </p>
              )}
            </div>
          ) : (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              <p className="text-sm text-slate-400">
                Ждём, когда ведущий начнёт игру…
              </p>
            </div>
          )}
        </>
      )}

      {/* ИГРА */}
      {isMember && state.room.status !== "lobby" && (
        <>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300">
            <span className="rounded-full bg-white/5 px-3 py-1">
              Раунд {state.room.round_number}
            </span>
            {cat && (
              <span className="rounded-full bg-white/5 px-3 py-1">
                {cat.emoji} {cat.label}
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-1 flex-col items-center justify-center">
            {!card ? (
              <div className="h-80 w-full max-w-[20rem] animate-pulse rounded-3xl border border-white/10 bg-white/5 sm:h-96" />
            ) : card.role === "spectator" ? (
              <div className="mx-auto flex h-80 w-full max-w-[20rem] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 text-center sm:h-96">
                <div className="text-5xl">👀</div>
                <div className="mt-4 text-lg font-semibold">Вы наблюдатель</div>
                <p className="mt-2 text-sm text-slate-400">
                  Вы зашли в середине раунда. Сыграете уже со следующего —
                  ведущий скоро его запустит.
                </p>
              </div>
            ) : (
              <FlipCard
                card={card}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
              />
            )}

            {card && !flipped && card.role !== "spectator" && (
              <p className="mt-4 text-center text-sm text-slate-400">
                Нажми на карточку, чтобы увидеть свою роль
              </p>
            )}
          </div>

          {card?.revealed && (
            <div className="mt-6 animate-pop-in rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Результат раунда
              </div>
              <div className="mt-1 text-lg">
                Шпион — <span className="font-bold">{card.impostorName}</span>
              </div>
              <div className="text-sm text-slate-300">
                Слово было:{" "}
                <span className="font-semibold text-white">{card.word}</span>
              </div>
            </div>
          )}

          {isHost ? (
            <div className="mt-6 space-y-3">
              {actionError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {actionError}
                </p>
              )}
              {state.room.status === "playing" && (
                <button
                  onClick={handleReveal}
                  disabled={busy}
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 font-medium transition hover:bg-white/10 disabled:opacity-60"
                >
                  Раскрыть шпиона
                </button>
              )}
              <div>
                <p className="mb-2 text-xs text-slate-400">
                  Категория следующего раунда
                </p>
                <CategoryPicker
                  categories={categories}
                  value={category}
                  onChange={setCategory}
                  disabled={busy}
                />
              </div>
              <button
                onClick={handleStart}
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 font-semibold text-white shadow-lg shadow-indigo-900/40 transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "Подождите…" : "Новый раунд"}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-slate-400">
              {state.room.status === "revealed"
                ? "Раунд раскрыт. Ждём, когда ведущий начнёт новый."
                : "Идёт раунд. Когда закончите обсуждение — ведущий раскроет шпиона."}
            </p>
          )}
        </>
      )}
    </main>
  );
}
