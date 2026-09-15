-- Схема личной библиотеки, v3
-- PostgreSQL 14+
--
-- Изменения относительно v2:
--   * locations: справочник полок внутри коллекции, copies.location_id FK
--   * copies.is_hidden: скрыть экземпляр от всех, кроме владельца
--   * user_tags + связи на works и copies: пользовательские теги
--   * lists + list_items: шарибельные подборки (произведение или издание)
--   * copy_photos: фото экземпляров; cover_path у editions остаётся
--     канонической обложкой
--
-- Слои:
--   Общий каталог:  persons, publishers, works, editions (+ связи, идентификаторы)
--   Личное:         users, contacts, collections, locations, copies, loans,
--                   book_marks, reviews, friendships, user_tags, lists

-- ============================================================
-- Служебное: updated_at триггером
-- ============================================================

CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Пользователи и их окружение
-- ============================================================

CREATE TABLE users (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username     text NOT NULL UNIQUE,
    display_name text,
    email        text UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name           text NOT NULL,
    linked_user_id bigint REFERENCES users (id) ON DELETE SET NULL,
    notes          text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);

CREATE TABLE friendships (
    requester_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    addressee_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

-- ============================================================
-- Общий каталог
-- ============================================================

CREATE TABLE persons (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name   text NOT NULL,
    sort_name   text,
    birth_year  smallint,
    death_year  smallint,
    notes       text,
    created_by  bigint REFERENCES users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persons_sort_name_idx ON persons (lower(sort_name));

CREATE TABLE publishers (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       text NOT NULL,
    city       text,
    created_by bigint REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE works (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title             text NOT NULL,
    original_language char(3),
    first_published   smallint,
    form              text,
    notes             text,
    created_by        bigint REFERENCES users (id) ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX works_title_idx ON works (lower(title));

CREATE TABLE work_contributors (
    work_id   bigint NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    person_id bigint NOT NULL REFERENCES persons (id) ON DELETE RESTRICT,
    role      text   NOT NULL DEFAULT 'author',
    position  smallint NOT NULL DEFAULT 1,
    PRIMARY KEY (work_id, person_id, role)
);

CREATE TABLE editions (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title          text NOT NULL,
    subtitle       text,
    publisher_id   bigint REFERENCES publishers (id) ON DELETE SET NULL,
    published_year smallint,
    language       char(3),
    format         text,
    pages          integer,
    print_run      integer,
    series         text,
    volume         text,
    cover_path     text,        -- каноническая обложка, общая для всех
    notes          text,
    created_by     bigint REFERENCES users (id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE editions ADD COLUMN dedupe_key text
    GENERATED ALWAYS AS (
        lower(regexp_replace(title, '[^[:alnum:]]', '', 'g'))
        || '|' || coalesce(published_year::text, '')
    ) STORED;

CREATE INDEX editions_dedupe_key_idx ON editions (dedupe_key);

CREATE TABLE identifier_types (
    code        text PRIMARY KEY,
    name        text NOT NULL,
    description text
);

INSERT INTO identifier_types (code, name) VALUES
    ('isbn13',   'ISBN-13'),
    ('isbn10',   'ISBN-10'),
    ('bbk',      'ББК'),
    ('udk',      'УДК'),
    ('order_no', 'Номер заказа'),
    ('issn',     'ISSN'),
    ('asin',     'ASIN');

CREATE TABLE edition_identifiers (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    edition_id bigint NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
    type       text   NOT NULL REFERENCES identifier_types (code),
    value      text   NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (edition_id, type, value)
);

CREATE INDEX edition_identifiers_lookup_idx ON edition_identifiers (type, value);

CREATE TABLE edition_works (
    edition_id       bigint NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
    work_id          bigint NOT NULL REFERENCES works (id) ON DELETE RESTRICT,
    position         smallint NOT NULL DEFAULT 1,
    title_in_edition text,
    part             text,
    page_from        integer,
    PRIMARY KEY (edition_id, work_id)
);

CREATE INDEX edition_works_work_idx ON edition_works (work_id);

CREATE TABLE edition_contributors (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    edition_id bigint NOT NULL REFERENCES editions (id) ON DELETE CASCADE,
    person_id  bigint NOT NULL REFERENCES persons (id) ON DELETE RESTRICT,
    role       text   NOT NULL,
    work_id    bigint REFERENCES works (id) ON DELETE CASCADE
);

CREATE INDEX edition_contributors_edition_idx ON edition_contributors (edition_id);

-- ============================================================
-- Коллекции, локации, экземпляры
-- ============================================================

CREATE TABLE collections (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text NOT NULL,
    visibility text NOT NULL DEFAULT 'private'
               CHECK (visibility IN ('public', 'friends', 'private')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);

-- Справочник полок/мест внутри коллекции. Выпадающий список в UI
CREATE TABLE locations (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_id bigint NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    name          text NOT NULL,          -- 'стеллаж в спальне, полка 2'
    position      smallint NOT NULL DEFAULT 1,  -- порядок в списке
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (collection_id, name)
);

CREATE TABLE copies (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    edition_id    bigint NOT NULL REFERENCES editions (id) ON DELETE RESTRICT,
    collection_id bigint NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    location_id   bigint REFERENCES locations (id) ON DELETE SET NULL,
    condition     text,
    acquired_at   date,
    acquired_from text,
    is_hidden     boolean NOT NULL DEFAULT false,
                  -- скрытый экземпляр видит только владелец,
                  -- фильтруется ДО проверки visibility коллекции
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copies_edition_idx    ON copies (edition_id);
CREATE INDEX copies_collection_idx ON copies (collection_id);

-- Приложение должно следить, что location принадлежит той же коллекции,
-- что и экземпляр. Если хочется гарантии на уровне БД:
--   составной FK (collection_id, location_id) ->
--   UNIQUE (collection_id, id) на locations

-- Фото экземпляра: корешок, автограф, дарственная.
-- В storage_key лежит ключ объекта в хранилище (uuid),
-- сгенерированный приложением. БД — источник истины
CREATE TABLE copy_photos (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    copy_id     bigint NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
    storage_key text NOT NULL,
    caption     text,
    position    smallint NOT NULL DEFAULT 1,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copy_photos_copy_idx ON copy_photos (copy_id);

-- ============================================================
-- Аренды (таблица = лог передач)
-- ============================================================

CREATE TABLE loans (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    copy_id             bigint NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
    borrower_user_id    bigint REFERENCES users (id) ON DELETE SET NULL,
    borrower_contact_id bigint REFERENCES contacts (id) ON DELETE SET NULL,
    lent_at             date NOT NULL DEFAULT current_date,
    due_at              date,            -- NULL = бессрочно
    returned_at         date,            -- NULL = ещё на руках
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(borrower_user_id, borrower_contact_id) = 1),
    CHECK (returned_at IS NULL OR returned_at >= lent_at)
);

CREATE UNIQUE INDEX loans_one_active_idx ON loans (copy_id)
    WHERE returned_at IS NULL;

CREATE INDEX loans_copy_idx ON loans (copy_id);

-- ============================================================
-- Пользовательские теги
-- Один пул тегов на пользователя, две связи:
--   * на произведения — жанры, 'любимое'
--   * на экземпляры  — 'отдать в библиотеку', 'утилизировать'
-- ============================================================

CREATE TABLE user_tags (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text NOT NULL,
    kind       text CHECK (kind IN ('genre', 'custom')),
               -- только для группировки в UI, на логику не влияет
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name)
);

CREATE TABLE work_user_tags (
    tag_id     bigint NOT NULL REFERENCES user_tags (id) ON DELETE CASCADE,
    work_id    bigint NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, work_id)
);

CREATE INDEX work_user_tags_work_idx ON work_user_tags (work_id);

CREATE TABLE copy_user_tags (
    tag_id     bigint NOT NULL REFERENCES user_tags (id) ON DELETE CASCADE,
    copy_id    bigint NOT NULL REFERENCES copies (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tag_id, copy_id)
);

CREATE INDEX copy_user_tags_copy_idx ON copy_user_tags (copy_id);

-- ============================================================
-- Подборки: шарибельные списки из каталога.
-- Элемент — произведение ИЛИ издание (для серий/бокс-сетов),
-- никогда не экземпляр: подборку видят другие люди
-- ============================================================

CREATE TABLE lists (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    slug        text,        -- заполнен у системных подборок ('want-to-buy'),
                             -- чтобы приложение находило их кодом
    visibility  text NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('public', 'friends', 'private')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, name),
    UNIQUE (owner_id, slug)
);

CREATE TABLE list_items (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    list_id    bigint NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    work_id    bigint REFERENCES works (id) ON DELETE CASCADE,
    edition_id bigint REFERENCES editions (id) ON DELETE CASCADE,
    position   integer NOT NULL DEFAULT 1,
    note       text,        -- комментарий к пункту: 'после Соляриса'
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(work_id, edition_id) = 1)
);

CREATE UNIQUE INDEX list_items_work_uniq_idx
    ON list_items (list_id, work_id) WHERE work_id IS NOT NULL;
CREATE UNIQUE INDEX list_items_edition_uniq_idx
    ON list_items (list_id, edition_id) WHERE edition_id IS NOT NULL;

-- Фикстура при регистрации пользователя :new_user:
--   INSERT INTO lists (owner_id, name, slug)
--   VALUES (:new_user, 'Хочу купить', 'want-to-buy');

-- ============================================================
-- Читательский дневник
-- ============================================================

CREATE TABLE book_marks (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_id     bigint NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    edition_id  bigint REFERENCES editions (id) ON DELETE SET NULL,
    status      text NOT NULL
                CHECK (status IN ('want_to_read', 'reading', 'read', 'abandoned')),
    visibility  text NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('public', 'friends', 'private')),
    started_at  date,
    finished_at date,
    rating      smallint CHECK (rating BETWEEN 1 AND 10),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX book_marks_user_idx ON book_marks (user_id, work_id);
CREATE INDEX book_marks_work_idx ON book_marks (work_id);

CREATE TABLE reviews (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_id    bigint NOT NULL REFERENCES works (id) ON DELETE CASCADE,
    edition_id bigint REFERENCES editions (id) ON DELETE SET NULL,
    body       text NOT NULL,
    visibility text NOT NULL DEFAULT 'private'
               CHECK (visibility IN ('public', 'friends', 'private')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reviews_work_idx ON reviews (work_id);
CREATE INDEX reviews_user_idx ON reviews (user_id);

-- ============================================================
-- Триггеры updated_at на все таблицы, где колонка есть
-- ============================================================

DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_touch BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t, t);
    END LOOP;
END $$;

-- ============================================================
-- Проверочные запросы
-- ============================================================

-- Мои теги со счётчиками (для облака тегов / автодополнения):
--   SELECT t.name, t.kind,
--          count(DISTINCT wt.work_id) AS works,
--          count(DISTINCT ct.copy_id) AS copies
--   FROM user_tags t
--   LEFT JOIN work_user_tags wt ON wt.tag_id = t.id
--   LEFT JOIN copy_user_tags ct ON ct.tag_id = t.id
--   WHERE t.owner_id = :me
--   GROUP BY t.id;

-- Прото-лента друзей (публичные и друзейные отзывы):
--   SELECT r.*, u.username
--   FROM reviews r
--   JOIN users u ON u.id = r.user_id
--   WHERE r.visibility = 'public'
--      OR (r.visibility = 'friends' AND r.user_id IN (
--            SELECT CASE WHEN requester_id = :me THEN addressee_id
--                        ELSE requester_id END
--            FROM friendships
--            WHERE :me IN (requester_id, addressee_id)
--              AND status = 'accepted'))
--   ORDER BY r.created_at DESC
--   LIMIT 50;