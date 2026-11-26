---
publish: true
created: 2026-11-21T10:34:21.546Z
modified: 2026-11-26T02:31:01.502Z
tags:
  - бд/справочник
  - бд/sql
cssclasses:
  - db-course
---

# ⌨ SQL и psql — шпаргалка

[[index]] · [[Лекции/01. Основы SQL]] · [[Практика/00. Тренировки по темам]]

## SELECT как конструктор

```sql
SELECT s.plan_id, COUNT(*) AS subscriber_count, SUM(s.balance) AS total_balance
FROM subscribers AS s
WHERE s.status = 'ACTIVE'
GROUP BY s.plan_id
HAVING COUNT(*) >= 2
ORDER BY subscriber_count DESC, s.plan_id;
```

Пишем SELECT → FROM/JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT. Логически источник и WHERE рассматриваются до формирования выбранных полей. Алиас SELECT обычно недоступен в WHERE того же уровня.

## Операции с данными

| Задача | Форма PostgreSQL |
|---|---|
| Выбрать поля | `SELECT subscriber_id, balance FROM subscribers;` |
| Уникальные комбинации | `SELECT DISTINCT plan_id FROM subscribers;` |
| Проверить NULL | `WHERE email IS NULL` / `IS NOT NULL` |
| Подставить вместо NULL | `COALESCE(email, 'не указан')` |
| Проверить диапазон | `WHERE balance BETWEEN 0 AND 100` — границы включены |
| Проверить набор | `WHERE status IN ('ACTIVE', 'SUSPENDED')` |
| Шаблон | `WHERE plan_name LIKE 'S%'` |
| Регистронезависимый шаблон PG | `WHERE plan_name ILIKE 's%'` |
| Прибавить к значению | `UPDATE subscribers SET balance = balance + 100 WHERE subscriber_id = 1;` |
| Добавить строку | `INSERT INTO service_types(service_name) VALUES ('Training');` |
| Удалить строки | `DELETE FROM payments WHERE payment_id = 123;` |
| Вернуть изменённое | `UPDATE ... RETURNING subscriber_id, balance;` |

`UPDATE` и `DELETE` без WHERE затрагивают все подходящие строки таблицы. DELETE не удаляет сам объект таблицы. `TRUNCATE` и `DROP` имеют другие свойства и последствия; для одиночного учебного удаления они обычно не нужны.

## Соединения и отсутствие

```sql
-- Сохраняем всех абонентов, даже без тарифа.
SELECT s.subscriber_id, t.plan_name
FROM subscribers AS s
LEFT JOIN tariff_plans AS t ON t.plan_id = s.plan_id;

-- Находим отсутствие платежей.
SELECT s.subscriber_id
FROM subscribers AS s
WHERE NOT EXISTS (
    SELECT 1 FROM payments AS p WHERE p.subscriber_id = s.subscriber_id
);
```

После LEFT JOIN считай `COUNT(p.payment_id)`, если нужно число платежей. Не соединяй напрямую две независимые таблицы событий для суммирования: сначала агрегируй каждую.

## Группировка

| Функция | Смысл |
|---|---|
| COUNT(\*) | Число строк |
| COUNT(column) | Число непустых значений |
| SUM(column) | Сумма непустых значений |
| AVG(column) | Среднее непустых значений |
| MIN / MAX | Минимум / максимум |

У SUM пустого набора будет NULL; при необходимости используй COALESCE. WHERE фильтрует строки, HAVING — группы. Если нужна одна строка на абонента, выбранные неагрегированные поля должны согласовываться с группировкой.

## Даты PostgreSQL

```sql
WHERE call_date >= TIMESTAMP '2025-11-01 00:00:00'
  AND call_date <  TIMESTAMP '2025-12-01 00:00:00'
```

Полуоткрытый диапазон безопаснее попытки угадать последнее время дня. `CURRENT_DATE`, `CURRENT_TIMESTAMP`, `INTERVAL '7 days'`, `date_trunc('month', call_date)` — PostgreSQL-средства; их переносимость в AlaSQL не предполагается.

## Структура и ограничения

```sql
CREATE TABLE training_example (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subscriber_id integer NOT NULL REFERENCES subscribers(subscriber_id),
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    external_id text UNIQUE
);
ALTER TABLE training_example ADD COLUMN comment text;
```

PK — уникальность и обязательность; FK — допустимая ссылка; CHECK — условие; DEFAULT — значение при пропуске. У CHECK и UNIQUE есть важные правила для NULL: см. [[Лекции/03. DDL, типы данных и ограничения]].

## Транзакции

```sql
BEGIN;
SAVEPOINT before_step;
-- SQL-действия
ROLLBACK TO SAVEPOINT before_step;
-- Другие SQL-действия
ROLLBACK; -- Или COMMIT после осмысленных проверок.
```

`BEGIN ... END` внутри PL/pgSQL — блок кода, не новая транзакция. Пропуски SERIAL после отката нормальны.

## Диагностика и обслуживание

| Команда | Что делает |
|---|---|
| EXPLAIN SELECT ... | Показывает план |
| EXPLAIN (ANALYZE, BUFFERS) SELECT ... | Исполняет и измеряет |
| ANALYZE call\_records | Обновляет статистику |
| VACUUM call\_records | Обслуживает мёртвые версии и видимость |
| SELECT \* FROM pg\_indexes | Показывает определения индексов |
| SELECT \* FROM pg\_stat\_replication | Диагностика потоковых реплик |

Чтение плана: [[Лекции/13. Производительность и индексы]]. Не путай ANALYZE в EXPLAIN и отдельную команду ANALYZE.

## Команды клиента psql

Их исполняет psql, а не SQL-сервер; в обычный SQL-редактор другого клиента они могут не подойти. В отличие от SQL, завершающая `;` для метакоманд не нужна.

| Команда | Назначение |
|---|---|
| `\conninfo` | Текущее подключение |
| `\l` | Список баз |
| `\c billing_database` | Переподключение к базе |
| `\dn` | Схемы |
| `\dt` | Таблицы |
| `\d subscribers` | Описание таблицы |
| `\d+ call_records` | Подробное описание |
| `\di` | Индексы |
| `\dv` | Представления |
| `\df` | Функции |
| `\h SELECT` | Справка синтаксиса SQL |
| `\?` | Справка psql |
| `\timing` | Время выполнения |
| `\x auto` | Автоматический расширенный вывод |
| `\i path.sql` | Выполнить SQL-файл |
| `\o result.txt` | Направить вывод в файл; без аргумента — вернуть |
| `\q` | Выход |

## Команды вне psql

```bash
psql -h localhost -U billing_user -d billing_database
pg_dump -h localhost -U billing_user -d billing_database -Fc -f billing.dump
pg_restore -h localhost -U billing_user -d billing_restore_training billing.dump
```

Это команды оболочки ОС. Сценарий восстановления новой тестовой БД подробно разобран в [[Лекции/14. Резервирование и восстановление]].
