"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientId, getStoredName, setStoredName } from "@/lib/identity";

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center animate-fade-in">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-3xl shadow-lg shadow-indigo-900/40">
          🕵️
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Шпион</h1>
        <p className="mt-2 text-sm text-slate-400">
          Создай комнату, позови друзей по коду и вычислите, кто из вас импостер.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl animate-pop-in">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-black/30 p-1">
          <button
            onClick={() => setTab("create")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "create"
                ? "bg-white text-slate-900 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Создать
          </button>
          <button
            onClick={() => setTab("join")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "join"
                ? "bg-white text-slate-900 shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Войти по коду
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Ваше имя
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Али"
          maxLength={24}
          className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-base outline-none transition placeholder:text-slate-500 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
        />

        {tab === "join" && (
          <>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Код комнаты
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={6}
              autoCapitalize="characters"
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xl font-bold tracking-[0.4em] outline-none transition placeholder:tracking-normal placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/30"
            />
          </>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={tab === "create" ? handleCreate : handleJoin}
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading
            ? "Подождите…"
            : tab === "create"
              ? "Создать комнату"
              : "Зайти в комнату"}
        </button>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        Один игрок становится <span className="text-slate-300">шпионом</span> и не
        знает слово — только далёкую подсказку. Остальные видят слово. Задавайте
        вопросы и вычислите импостера.
      </p>
    </main>
  );
}
