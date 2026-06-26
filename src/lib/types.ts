export type RoomStatus = "lobby" | "playing" | "revealed";

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
  category: string | null;
  roundNumber: number;
  revealed: boolean;
  // Только для команды (crew) или когда раунд раскрыт:
  word?: string;
  // Только для шпиона (impostor) или когда раунд раскрыт:
  hint?: string;
  // Только когда ведущий раскрыл раунд:
  impostorName?: string;
}
