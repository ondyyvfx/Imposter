"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientId, getStoredName, setStoredName } from "@/lib/identity";
import ThemeSwitcher from "@/components/ThemeSwitcher";

type Tab = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(getStoredName());
  }, []);

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите имя");
      return;
    }
    setStoredName(trimmed);
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, clientId: getClientId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка создания комнаты");
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError(null);
    const trimmed = name.trim();
    const roomCode = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Введите имя");
      return;
    }
    if (!roomCode) {
      setError("Введите код комнаты");
      return;
    }
    setStoredName(trimmed);
    setLoading(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          code: roomCode,
          clientId: getClientId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось зайти");
      router.push(`/room/${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border/10 bg-surface-2 px-4 py-3 text-base text-fg outline-none transition placeholder:text-muted/70 focus:border-accent/50 focus:ring-2 focus:ring-accent/20";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="fixed right-4 top-4 z-50">
        <ThemeSwitcher />
      </div>

      <div className="mb-9 animate-fade-in">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/10 bg-surface text-2xl">
          🕵️
        </div>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">
          Шпион
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Создай комнату, позови друзей по коду и вычислите, кто из вас импостер.
        </p>
      </div>

      <div className="animate-pop-in rounded-2xl border border-border/10 bg-surface p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border/10 bg-bg p-1">
          {(["create", "join"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-surface-2 text-fg shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t === "create" ? "Создать" : "Войти по коду"}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-xs font-medium text-muted">
          Ваше имя
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Али"
          maxLength={24}
          className={`mb-4 ${inputClass}`}
        />

        {tab === "join" && (
          <>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Код комнаты
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={6}
              autoCapitalize="characters"
              className={`mb-4 ${inputClass} text-center text-xl font-bold tracking-[0.4em] placeholder:tracking-normal`}
            />
          </>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          onClick={tab === "create" ? handleCreate : handleJoin}
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-fg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
        >
          {loading
            ? "Подождите…"
            : tab === "create"
              ? "Создать комнату"
              : "Зайти в комнату"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Один из игроков — <span className="text-fg">шпион</span>. В классике он не
        знает слово, а в режиме «скрытый шпион» даже не подозревает, что он шпион.
        Задавайте вопросы и вычислите импостера.
      </p>
    </main>
  );
}
