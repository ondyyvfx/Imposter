"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientId, getStoredName, setStoredName } from "@/lib/identity";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import { catMeta } from "@/lib/categories";
import type {
  CardResponse,
  GameMode,
  PlayerPublic,
  RoomState,
} from "@/lib/types";

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
                ? "border-transparent bg-primary text-primary-fg"
                : "border-border/10 bg-surface-2 text-muted hover:text-fg"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        );
      })}
    </div>
  );
}

const MODE_INFO: Record<GameMode, { label: string; desc: string }> = {
  classic: {
    label: "🎭 Классика",
    desc: "Шпион знает свою роль и видит только далёкую подсказку.",
  },
  blind: {
    label: "🥸 Скрытый шпион",
    desc: "Шпион не знает, что он шпион — ему просто дают похожее слово.",
  },
};

function ModePicker({
  value,
  onChange,
  disabled,
}: {
  value: GameMode;
  onChange: (v: GameMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/10 bg-bg p-1">
      {(Object.keys(MODE_INFO) as GameMode[]).map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => onChange(k)}
          className={`rounded-lg py-2 text-sm font-medium transition disabled:opacity-50 ${
            value === k
              ? "bg-surface-2 text-fg shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          {MODE_INFO[k].label}
        </button>
      ))}
    </div>
  );
}

function pluralSpies(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "шпион";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шпиона";
  return "шпионов";
}

function ImpostorStepper({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg text-xl text-fg transition hover:bg-surface disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center gap-1 rounded-xl border border-border/10 bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={disabled || value <= 1}
          className={btn}
          aria-label="Меньше шпионов"
        >
          −
        </button>
        <span className="w-8 text-center text-lg font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={disabled || value >= max}
          className={btn}
          aria-label="Больше шпионов"
        >
          +
        </button>
      </div>
      <span className="text-xs text-muted">
        {value} {pluralSpies(value)} · макс. {max}
      </span>
    </div>
  );
}

function RoundSettings({
  categories,
  category,
  onCategory,
  mode,
  onMode,
  impostorCount,
  maxImpostors,
  onImpostorCount,
  disabled,
}: {
  categories: string[];
  category: string;
  onCategory: (v: string) => void;
  mode: GameMode;
  onMode: (v: GameMode) => void;
  impostorCount: number;
  maxImpostors: number;
  onImpostorCount: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/10 bg-surface p-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Категория</p>
        <CategoryPicker
          categories={categories}
          value={category}
          onChange={onCategory}
          disabled={disabled}
        />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Режим</p>
        <ModePicker value={mode} onChange={onMode} disabled={disabled} />
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {MODE_INFO[mode].desc}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Число шпионов</p>
        <ImpostorStepper
          value={impostorCount}
          max={maxImpostors}
          onChange={onImpostorCount}
          disabled={disabled}
        />
      </div>
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
  const blindReveal = card.revealed && isImpostor && card.mode === "blind";

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
        <div className="flip-face border border-border/10 bg-surface-2 px-6 text-center">
          <div className="text-6xl">🎭</div>
          <div className="mt-6 text-xl font-semibold text-fg">
            Нажми, чтобы открыть
          </div>
          <div className="mt-2 text-sm text-muted">
            Свою роль увидишь только ты
          </div>
        </div>

        {/* оборотная сторона */}
        <div
          className={`flip-back flip-face border px-6 text-center ${
            isImpostor
              ? "border-danger/25 bg-danger/10"
              : "border-success/25 bg-success/10"
          }`}
        >
          {blindReveal ? (
            <>
              <div className="text-5xl">🥸</div>
              <div className="mt-3 text-2xl font-bold tracking-wide text-danger">
                ТЫ БЫЛ ШПИОНОМ
              </div>
              <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-muted">
                Тебе дали слово
              </div>
              <div className="mt-1 text-lg font-semibold text-fg">
                {card.nearWord ?? "—"}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted">
                А настоящее было
              </div>
              <div className="mt-1 text-lg font-semibold text-success">
                {card.word}
              </div>
            </>
          ) : isImpostor ? (
            <>
              <div className="text-5xl">🕵️</div>
              <div className="mt-3 text-2xl font-extrabold tracking-wide text-danger">
                ТЫ ШПИОН
              </div>
              <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-muted">
                Подсказка
              </div>
              <div className="mt-1.5 text-lg font-medium leading-snug text-fg">
                {card.hint}
              </div>
              {card.revealed && card.word && (
                <div className="mt-4 text-sm text-muted">
                  Слово было:{" "}
                  <span className="font-semibold text-fg">{card.word}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                Загаданное слово
              </div>
              <div className="mt-3 break-words text-3xl font-extrabold leading-tight text-fg">
                {card.word}
              </div>
              {meta && (
                <div className="mt-6 rounded-full border border-border/10 bg-bg/40 px-3 py-1 text-xs text-muted">
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
  const [mode, setMode] = useState<GameMode>("classic");
  const [impostorCount, setImpostorCount] = useState(1);

  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const prevRound = useRef(-1);
  const prevStatus = useRef("");

  const me = state?.me ?? null;
  const isMember = !!me?.isMember;
  const isHost = !!me?.isHost;
  const playerCount = state?.players.length ?? 0;
  const maxImpostors = Math.max(1, playerCount - 1);

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

  // держим число шпионов в допустимых пределах при изменении состава
  useEffect(() => {
    setImpostorCount((c) => Math.min(Math.max(1, c), maxImpostors));
  }, [maxImpostors]);

  // поллинг как надёжный фолбэк (работает даже без realtime)
  useEffect(() => {
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  // мгновенное обновление при возврате на вкладку / окно
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") fetchState();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [fetchState]);

  // realtime для мгновенных обновлений (если заданы NEXT_PUBLIC ключи)
  useEffect(() => {
    const supa = getBrowserClient();
    const roomId = state?.room.id;
    if (!supa || !roomId) return;

    let channel: ReturnType<SupabaseClient["channel"]> | null = null;
    try {
      channel = supa
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
        .subscribe((status) => {
          // как только подписка готова — догоняем актуальное состояние
          if (status === "SUBSCRIBED") fetchState();
        });
    } catch {
      return;
    }

    return () => {
      try {
        if (channel) supa.removeChannel(channel);
      } catch {
        /* ignore */
      }
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
        body: JSON.stringify({
          clientId: getClientId(),
          category,
          mode,
          impostorCount,
        }),
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
          className="mt-6 rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-fg"
        >
          На главную
        </button>
      </main>
    );
  }

  if (loading && !state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border/20 border-t-fg/80" />
      </main>
    );
  }

  if (!state) return null;

  // Категорию берём ТОЛЬКО из карточки (она role-aware). У classic-шпиона её нет —
  // значит и в шапке чип категории ему не покажется.
  const cat = card?.category ? catMeta(card.category) : null;
  const impostorNames = card?.impostorNames ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      {/* верхняя панель */}
      <div className="flex items-center justify-between">
        <button
          onClick={leave}
          className="text-sm text-muted transition hover:text-fg"
        >
          ← Выйти
        </button>
        <button
          onClick={copyCode}
          className="rounded-full border border-border/10 bg-surface px-4 py-1.5 text-sm font-bold tracking-[0.25em] transition hover:bg-surface-2"
        >
          {copied ? "Скопировано ✓" : code}
        </button>
      </div>

      {/* НЕ участник: форма входа */}
      {!isMember && (
        <div className="mt-10 animate-pop-in rounded-2xl border border-border/10 bg-surface p-6">
          <h2 className="text-center text-lg font-semibold">Зайти в комнату</h2>
          <div className="mt-1 text-center text-3xl font-black tracking-[0.3em]">
            {code}
          </div>
          {state.room.status !== "lobby" && (
            <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-300">
              Игра уже идёт — вы сыграете со следующего раунда.
            </p>
          )}
          <label className="mb-1.5 mt-4 block text-xs text-muted">
            Ваше имя
          </label>
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Например, Али"
            maxLength={24}
            className="w-full rounded-xl border border-border/10 bg-surface-2 px-4 py-3 text-fg outline-none transition placeholder:text-muted/70 focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
          {actionError && (
            <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
              {actionError}
            </p>
          )}
          <button
            onClick={handleJoinRoom}
            disabled={joining}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
          >
            {joining ? "Подождите…" : "Войти"}
          </button>
        </div>
      )}

      {/* ЛОББИ */}
      {isMember && state.room.status === "lobby" && (
        <>
          <div className="mt-6 rounded-2xl border border-border/10 bg-surface p-6 text-center">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
              Код комнаты
            </div>
            <div className="mt-1 text-4xl font-black tracking-[0.3em]">{code}</div>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={copyCode}
                className="rounded-xl border border-border/10 bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-surface"
              >
                {copied ? "Скопировано ✓" : "Копировать код"}
              </button>
              <button
                onClick={shareLink}
                className="rounded-xl border border-border/10 bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-surface"
              >
                Поделиться
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Игроки</h2>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>{state.players.length}</span>
                <button
                  onClick={() => fetchState()}
                  className="rounded-full border border-border/10 bg-surface-2 px-2.5 py-0.5 text-xs text-muted transition hover:text-fg"
                  title="Обновить список"
                >
                  ↻ Обновить
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {state.players.map((p: PlayerPublic) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/10 bg-surface px-4 py-3"
                >
                  <Avatar name={p.name} />
                  <span className="font-medium">
                    {p.name}
                    {p.id === me?.playerId && (
                      <span className="text-muted"> (вы)</span>
                    )}
                  </span>
                  {p.is_host && (
                    <span className="ml-auto rounded-full border border-border/10 bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                      ведущий
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isHost ? (
            <div className="mt-6 space-y-4">
              <RoundSettings
                categories={categories}
                category={category}
                onCategory={setCategory}
                mode={mode}
                onMode={setMode}
                impostorCount={impostorCount}
                maxImpostors={maxImpostors}
                onImpostorCount={setImpostorCount}
                disabled={busy}
              />
              {actionError && (
                <p className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {actionError}
                </p>
              )}
              <button
                onClick={handleStart}
                disabled={busy || state.players.length < 2}
                className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Запуск…" : "Начать игру"}
              </button>
              {state.players.length < 2 && (
                <p className="text-center text-xs text-muted">
                  Нужно минимум 2 игрока, чтобы начать
                </p>
              )}
            </div>
          ) : (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border/20 border-t-fg/80" />
              <p className="text-sm text-muted">
                Ждём, когда ведущий начнёт игру…
              </p>
            </div>
          )}
        </>
      )}

      {/* ИГРА */}
      {isMember && state.room.status !== "lobby" && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <span className="rounded-full border border-border/10 bg-surface px-3 py-1">
              Раунд {state.room.round_number}
            </span>
            {card && (
              <span className="rounded-full border border-border/10 bg-surface px-3 py-1">
                {MODE_INFO[card.mode].label}
              </span>
            )}
            {cat && (
              <span className="rounded-full border border-border/10 bg-surface px-3 py-1">
                {cat.emoji} {cat.label}
              </span>
            )}
          </div>

          {card?.starterName && (
            <div className="mt-4 animate-pop-in rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-accent">
                Первым ходит
              </div>
              <div className="mt-0.5 text-lg font-bold text-fg">
                🎤 {card.starterName}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-1 flex-col items-center justify-center">
            {!card ? (
              <div className="h-80 w-full max-w-[20rem] animate-pulse rounded-3xl border border-border/10 bg-surface sm:h-96" />
            ) : card.role === "spectator" ? (
              <div className="mx-auto flex h-80 w-full max-w-[20rem] flex-col items-center justify-center rounded-3xl border border-border/10 bg-surface px-6 text-center sm:h-96">
                <div className="text-5xl">👀</div>
                <div className="mt-4 text-lg font-semibold">Вы наблюдатель</div>
                <p className="mt-2 text-sm text-muted">
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
              <p className="mt-4 text-center text-sm text-muted">
                Нажми на карточку, чтобы увидеть свою роль
              </p>
            )}
          </div>

          {card?.revealed && (
            <div className="mt-6 animate-pop-in rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-center">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">
                Результат раунда
              </div>
              <div className="mt-1 text-lg">
                {impostorNames.length > 1 ? "Шпионы" : "Шпион"} —{" "}
                <span className="font-bold">
                  {impostorNames.length ? impostorNames.join(", ") : "—"}
                </span>
              </div>
              <div className="text-sm text-muted">
                Слово было:{" "}
                <span className="font-semibold text-fg">{card.word}</span>
              </div>
              {card.mode === "blind" && card.nearWord && (
                <div className="text-sm text-muted">
                  У шпион{impostorNames.length > 1 ? "ов" : "а"} было:{" "}
                  <span className="font-semibold text-fg">{card.nearWord}</span>
                </div>
              )}
            </div>
          )}

          {isHost ? (
            <div className="mt-6 space-y-4">
              {actionError && (
                <p className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {actionError}
                </p>
              )}
              {state.room.status === "playing" && (
                <button
                  onClick={handleReveal}
                  disabled={busy}
                  className="w-full rounded-xl border border-border/10 bg-surface-2 py-3 font-medium transition hover:bg-surface disabled:opacity-60"
                >
                  Раскрыть шпиона
                </button>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  Настройки следующего раунда
                </p>
                <RoundSettings
                  categories={categories}
                  category={category}
                  onCategory={setCategory}
                  mode={mode}
                  onMode={setMode}
                  impostorCount={impostorCount}
                  maxImpostors={maxImpostors}
                  onImpostorCount={setImpostorCount}
                  disabled={busy}
                />
              </div>
              <button
                onClick={handleStart}
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3.5 font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Подождите…" : "Новый раунд"}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-muted">
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
