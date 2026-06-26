-- ============================================================================
--  ШПИОН / IMPOSTER GAME — дамп базы данных для Supabase
-- ----------------------------------------------------------------------------
--  Как применить:
--    Supabase Dashboard → SQL Editor → New query → вставить ВЕСЬ этот файл →
--    нажать Run. Скрипт можно запускать повторно (он сам пересоздаёт таблицы).
--
--  Что внутри:
--    • таблицы: rooms, players, player_auth, words, rounds
--    • Row Level Security (слово и шпион не утекают в браузер)
--    • включённый Realtime для rooms и players
--    • ~130 слов по категориям с короткими «далёкими» подсказками для шпиона
-- ============================================================================

create extension if not exists "pgcrypto";

-- Чистый старт (удаляем старые таблицы, если запускаем повторно).
drop table if exists public.rounds cascade;
drop table if exists public.player_auth cascade;
drop table if exists public.players cascade;
drop table if exists public.words cascade;
drop table if exists public.rooms cascade;

-- ─────────────────────────────── ТАБЛИЦЫ ───────────────────────────────────

create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  status          text not null default 'lobby',        -- lobby | playing | revealed
  host_player_id  uuid,                                 -- публичный id ведущего (не секрет)
  round_number    integer not null default 0,
  used_word_ids   uuid[] not null default '{}',         -- слова, уже загаданные в этой комнате
  created_at      timestamptz not null default now()
);

-- Публичные данные игрока. Здесь НЕТ секретов — таблицу можно читать всем.
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  name        text not null,
  is_host     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Секрет устройства (clientId из localStorage). Живёт только здесь, в браузер
-- никогда не отдаётся → нельзя подсмотреть чужую роль или прикинуться ведущим.
create table public.player_auth (
  player_id   uuid primary key references public.players(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  secret      text not null,
  created_at  timestamptz not null default now(),
  unique (room_id, secret)
);

create table public.words (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  word        text not null,
  hint        text not null,                            -- далёкая подсказка для шпиона
  created_at  timestamptz not null default now()
);

create table public.rounds (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references public.rooms(id) on delete cascade,
  round_number         integer not null,
  word_id              uuid not null references public.words(id),
  impostor_player_id   uuid not null references public.players(id),
  starter_player_id    uuid references public.players(id),   -- кто ходит первым
  created_at           timestamptz not null default now(),
  unique (room_id, round_number)
);

create index players_room_id_idx on public.players (room_id);
create index player_auth_lookup_idx on public.player_auth (room_id, secret);
create index rounds_room_id_idx on public.rounds (room_id);
create index words_category_idx on public.words (category);

-- ─────────────────────────── ROW LEVEL SECURITY ────────────────────────────
-- rooms и players можно читать всем (нужно для realtime-лобби), но НЕ менять
-- из браузера. Таблицы player_auth / words / rounds недоступны анониму —
-- с ними работает только сервер под service_role (он обходит RLS).

alter table public.rooms       enable row level security;
alter table public.players     enable row level security;
alter table public.player_auth enable row level security;
alter table public.words       enable row level security;
alter table public.rounds      enable row level security;

create policy "rooms_select_public"
  on public.rooms for select
  using (true);

create policy "players_select_public"
  on public.players for select
  using (true);

-- Для player_auth, words и rounds политик нет → анонимный доступ запрещён.
-- Секрет устройства, загаданное слово и личность шпиона отдаются строго
-- персонально через серверные API-роуты.

-- ──────────────────────────────── REALTIME ─────────────────────────────────
-- Мгновенные обновления лобби/старта игры. replica identity full — чтобы
-- корректно работали фильтры по строкам.

alter table public.rooms   replica identity full;
alter table public.players replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    execute 'alter publication supabase_realtime add table public.players';
  end if;
end $$;

-- ───────────────────────────────── СЛОВА ───────────────────────────────────
-- Подсказки специально КОРОТКИЕ (одно слово) и ДАЛЁКИЕ — это абстрактная тема,
-- а не очевидная черта, чтобы шпион не угадал слово сразу.

insert into public.words (category, word, hint) values
-- ── Аниме ──────────────────────────────────────────────────────────────────
('Аниме', 'Наруто', 'признание'),
('Аниме', 'Атака титанов', 'клетка'),
('Аниме', 'Ван-Пис', 'мечта'),
('Аниме', 'Тетрадь смерти', 'правосудие'),
('Аниме', 'Стальной алхимик', 'расплата'),
('Аниме', 'Токийский гуль', 'двойственность'),
('Аниме', 'Магическая битва', 'страх'),
('Аниме', 'Человек-бензопила', 'желания'),
('Аниме', 'Клинок, рассекающий демонов', 'узы'),
('Аниме', 'Моя геройская академия', 'наследие'),
('Аниме', 'Евангелион', 'одиночество'),
('Аниме', 'Берсерк', 'обречённость'),
('Аниме', 'Ковбой Бибоп', 'ностальгия'),
('Аниме', 'Сейлор Мун', 'перевоплощение'),
('Аниме', 'Драгонболл', 'превосходство'),
('Аниме', 'ДжоДжо', 'эксцентрика'),
('Аниме', 'Re:Zero', 'повтор'),
('Аниме', 'Врата Штейна', 'прошлое'),
('Аниме', 'Код Гиасс', 'власть'),
('Аниме', 'Ванпанчмен', 'пресыщение'),
('Аниме', 'Хвост феи', 'товарищество'),
-- ── Фильмы ──────────────────────────────────────────────────────────────────
('Фильмы', 'Титаник', 'тщеславие'),
('Фильмы', 'Аватар', 'гармония'),
('Фильмы', 'Матрица', 'иллюзия'),
('Фильмы', 'Интерстеллар', 'разлука'),
('Фильмы', 'Начало', 'подсознание'),
('Фильмы', 'Джокер', 'безумие'),
('Фильмы', 'Криминальное чтиво', 'случайность'),
('Фильмы', 'Властелин колец', 'искушение'),
('Фильмы', 'Гарри Поттер', 'избранность'),
('Фильмы', 'Звёздные войны', 'противостояние'),
('Фильмы', 'Мстители', 'единство'),
('Фильмы', 'Форрест Гамп', 'наивность'),
('Фильмы', 'Побег из Шоушенка', 'надежда'),
('Фильмы', 'Крёстный отец', 'клан'),
('Фильмы', 'Гладиатор', 'честь'),
('Фильмы', 'Дюна', 'пророчество'),
('Фильмы', 'Оппенгеймер', 'ответственность'),
('Фильмы', 'Терминатор', 'неизбежность'),
('Фильмы', 'Один дома', 'находчивость'),
('Фильмы', 'Зелёная миля', 'несправедливость'),
('Фильмы', 'Бэтмен', 'тень'),
-- ── Музыка ──────────────────────────────────────────────────────────────────
('Музыка', 'The Weeknd', 'порок'),
('Музыка', 'Билли Айлиш', 'меланхолия'),
('Музыка', 'Эминем', 'дерзость'),
('Музыка', 'Майкл Джексон', 'величие'),
('Музыка', 'Queen', 'легенда'),
('Музыка', 'The Beatles', 'революция'),
('Музыка', 'Тейлор Свифт', 'исповедь'),
('Музыка', 'Ариана Гранде', 'грация'),
('Музыка', 'BTS', 'феномен'),
('Музыка', 'Coldplay', 'мечтательность'),
('Музыка', 'Imagine Dragons', 'энергия'),
('Музыка', 'Linkin Park', 'боль'),
('Музыка', 'Metallica', 'ярость'),
('Музыка', 'Канье Уэст', 'скандал'),
('Музыка', 'Дрейк', 'чувства'),
('Музыка', 'Моргенштерн', 'эпатаж'),
('Музыка', 'Баста', 'путь'),
('Музыка', 'Скриптонит', 'андеграунд'),
('Музыка', 'Macan', 'волна'),
('Музыка', 'Инстасамка', 'вызов'),
('Музыка', 'Егор Крид', 'романтика'),
-- ── Места ───────────────────────────────────────────────────────────────────
('Места', 'Эйфелева башня', 'ажур'),
('Места', 'Статуя Свободы', 'встреча'),
('Места', 'Колизей', 'зрелище'),
('Места', 'Биг-Бен', 'время'),
('Места', 'Пизанская башня', 'равновесие'),
('Места', 'Великая Китайская стена', 'преграда'),
('Места', 'Тадж-Махал', 'скорбь'),
('Места', 'Пирамиды Гизы', 'вечность'),
('Места', 'Стоунхендж', 'тайна'),
('Места', 'Ниагарский водопад', 'мощь'),
('Места', 'Гранд-Каньон', 'бездна'),
('Места', 'Красная площадь', 'держава'),
('Места', 'Лувр', 'шедевр'),
('Места', 'Бурдж-Халифа', 'амбиции'),
('Места', 'Сиднейская опера', 'гавань'),
('Места', 'Голливуд', 'слава'),
('Места', 'Диснейленд', 'детство'),
('Места', 'Таймс-сквер', 'суета'),
('Места', 'Мачу-Пикчу', 'забвение'),
('Места', 'Санторини', 'безмятежность'),
('Места', 'Ватикан', 'вера'),
-- ── Страны ──────────────────────────────────────────────────────────────────
('Страны', 'Япония', 'дисциплина'),
('Страны', 'США', 'доминация'),
('Страны', 'Франция', 'изящество'),
('Страны', 'Италия', 'страсть'),
('Страны', 'Германия', 'порядок'),
('Страны', 'Бразилия', 'праздник'),
('Страны', 'Россия', 'простор'),
('Страны', 'Китай', 'древность'),
('Страны', 'Индия', 'колорит'),
('Страны', 'Канада', 'вежливость'),
('Страны', 'Австралия', 'дикость'),
('Страны', 'Испания', 'темперамент'),
('Страны', 'Мексика', 'острота'),
('Страны', 'Египет', 'загадка'),
('Страны', 'Турция', 'перекрёсток'),
('Страны', 'Южная Корея', 'тренд'),
('Страны', 'Великобритания', 'чопорность'),
('Страны', 'Аргентина', 'танец'),
('Страны', 'Нидерланды', 'толерантность'),
('Страны', 'Швейцария', 'нейтралитет'),
('Страны', 'Таиланд', 'экзотика'),
-- ── Мемы ────────────────────────────────────────────────────────────────────
('Мемы', 'Доге', 'восторг'),
('Мемы', 'Шрек', 'внешность'),
('Мемы', 'Лягушонок Пепе', 'грусть'),
('Мемы', 'Гигачад', 'идеал'),
('Мемы', 'Тролльфейс', 'издёвка'),
('Мемы', 'Амонг Ас', 'подозрение'),
('Мемы', 'Гарольд, скрывающий боль', 'терпение'),
('Мемы', 'Рикролл', 'обман'),
('Мемы', 'Стоункс', 'выгода'),
('Мемы', 'Это нормально', 'отрицание'),
('Мемы', 'Скибиди туалет', 'абсурд'),
('Мемы', 'Огайо', 'странность'),
('Мемы', 'Сигма', 'независимость'),
('Мемы', 'NPC', 'шаблонность'),
('Мемы', 'Мистер Бист', 'щедрость'),
('Мемы', 'Кот Максвелл', 'ритм'),
('Мемы', 'Карл', 'укор'),
('Мемы', 'Грустный Киану', 'уныние'),
('Мемы', 'Дрейк одобряет', 'предпочтение'),
('Мемы', 'Вояк', 'переживания'),
('Мемы', 'Издевательский Спанчбоб', 'сарказм');

-- Готово! Дальше: задеплой Next.js на Vercel и пропиши переменные окружения
-- из Project Settings → API (URL, anon key, service_role key).
