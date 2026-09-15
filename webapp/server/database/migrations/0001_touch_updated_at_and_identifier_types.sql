-- Ручная миграция: drizzle-kit не умеет генерировать функции, триггеры
-- и наполнение справочников — он видит только DDL таблиц.

-- ============================================================
-- updated_at обновляет БД, а не приложение
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Вешаем триггер на каждую таблицу, где есть колонка updated_at.
-- ВАЖНО: заведёшь новую таблицу с updated_at — добавь новую миграцию
-- с этим же блоком, иначе её updated_at останется мёртвым.
-- Тест tests/server/schema-invariants.test.ts ловит такой пропуск.
DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables tb
          ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'updated_at'
          AND tb.table_type = 'BASE TABLE'
          AND NOT EXISTS (
              SELECT 1 FROM pg_trigger tg
              JOIN pg_class cl ON cl.oid = tg.tgrelid
              WHERE cl.relname = c.table_name AND tg.tgname = c.table_name || '_touch'
          )
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t || '_touch', t);
    END LOOP;
END $$;
--> statement-breakpoint

-- ============================================================
-- Справочник типов идентификаторов
-- ============================================================
-- Это не сид-данные, а часть схемы: на identifier_types.code смотрит FK
-- из edition_identifiers, без строк ни одно издание не заведётся.

INSERT INTO identifier_types (code, name) VALUES
    ('isbn13',   'ISBN-13'),
    ('isbn10',   'ISBN-10'),
    ('bbk',      'ББК'),
    ('udk',      'УДК'),
    ('order_no', 'Номер заказа'),
    ('issn',     'ISSN'),
    ('asin',     'ASIN')
ON CONFLICT (code) DO NOTHING;
