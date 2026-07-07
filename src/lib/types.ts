export type RoomStatus = "lobby" | "playing" | "revealed";

// classic — шпион знает, что он шпион, и получает далёкую подсказку.
// blind   — «скрытый шпион»: он не знает, что он шпион, ему просто выдают
//           немного другое (близкое) слово.
export type GameMode = "classic" | "blind";

export interface PlayerPublic {
  id: string; // публичный id игрока (не секрет)
  name: string;
  is_host: boolean;
}

export interface RoomPublic {
  id: string;
  code: string;
  status: RoomStatus;
  round_number: number;
  host_player_id: string | null;
}

export interface MeInfo {
  playerId: string;
  isHost: boolean;
  isMember: boolean;
}

export interface RoomState {
  room: RoomPublic;
  players: PlayerPublic[];
  me: MeInfo | null;
}

export type CardRole = "crew" | "impostor" | "spectator";

export interface CardResponse {
  role: CardRole;
  mode: GameMode;
  category: string | null;
  roundNumber: number;
  revealed: boolean;
  // Кто ходит первым в этом раунде (виден всем — это публичная информация):
  starterName?: string;
  // Слово на карточке. Для команды — загаданное слово; для «скрытого шпиона»
  // во время игры — близкое слово (он не знает, что оно другое); при раскрытии —
  // настоящее загаданное слово.
  word?: string;
  // Только для шпиона (classic) или когда раунд раскрыт:
  hint?: string;
  // Только когда ведущий раскрыл раунд:
  impostorNames?: string[];
  // Только когда раскрыт раунд режима blind — какое слово было у шпионов:
  nearWord?: string;
}
