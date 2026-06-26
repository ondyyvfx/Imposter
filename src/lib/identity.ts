"use client";

const CLIENT_ID_KEY = "imposter_client_id";
const NAME_KEY = "imposter_name";

// Запасное хранилище в памяти на случай, если localStorage недоступен
// (приватный режим, встроенные браузеры Telegram/Instagram и т.п.).
// Благодаря ему clientId остаётся СТАБИЛЬНЫМ в рамках сессии, и игрок не
// «теряется» из комнаты при каждом обновлении состояния.
let memoryClientId: string | null = null;
let memoryName = "";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Стабильный идентификатор устройства/игрока. */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = memoryClientId ?? uuid();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    memoryClientId = id;
    return id;
  } catch {
    // localStorage недоступен → держим стабильный id в памяти на эту сессию
    if (!memoryClientId) memoryClientId = uuid();
    return memoryClientId;
  }
}

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) || memoryName;
  } catch {
    return memoryName;
  }
}

export function setStoredName(name: string): void {
  memoryName = name;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* localStorage недоступен — имя останется в памяти на сессию */
  }
}
