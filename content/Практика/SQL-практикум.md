---
publish: true
created: 2026-11-21T10:34:21.547Z
modified: 2026-11-21T10:51:58.082Z
tags:
  - бд/практика
  - бд/sql
cssclasses:
  - db-course
---

# 🧩 SQL-практикум

[[index]] · [[Практика/Учебный набор]] · [[Справочники/SQL и psql — шпаргалка]]

18 заданий от выбора столбцов до двух ролей одной таблицы. В Obsidian напиши решение у себя и сравни с эталоном в блоке. На Quartz появятся поле ввода, выполнение и автоматическое сравнение результата. [[Справочники/Интерактив и Quartz|Как включить]].

Каждая попытка стартует с исходного набора. Имена выходных столбцов могут отличаться от эталона; сравниваются значения по позициям выбранных столбцов, включая повторы. При ORDER BY в эталоне важен порядок строк. Для правильного ответа нужно понимать запрос, а не подставлять готовые строки.

```sql
-- setup
CREATE TABLE tariff_plans (plan_id INT, plan_name STRING, monthly_fee NUMBER, minutes_included INT, sms_included INT, data_gb_included INT, price_per_minute NUMBER, price_per_sms NUMBER, price_per_gb NUMBER, is_active BOOLEAN);
INSERT INTO tariff_plans VALUES (1,'Basic',300,100,50,5,2,2.5,200,true),(2,'Standard',500,300,100,15,1.5,2,150,true),(3,'Premium',800,1000,500,50,1,1.5,100,true),(4,'Unlimited',1200,999999,999999,100,0,0,50,true),(5,'Student',350,200,100,10,1.8,2,180,true),(6,'Senior',250,150,100,3,2,2,250,false);
CREATE TABLE service_types (service_type_id INT, service_name STRING, description STRING);
INSERT INTO service_types VALUES (1,'Outgoing Call','Исходящий звонок'),(2,'Incoming Call','Входящий звонок'),(3,'SMS','Сообщение'),(4,'MMS','Мультимедийное сообщение'),(5,'Data','Интернет');
CREATE TABLE subscribers (subscriber_id INT, phone_number STRING, first_name STRING, last_name STRING, email STRING, plan_id, registration_date STRING, status STRING, balance NUMBER);
INSERT INTO subscribers VALUES (1,'+79100000001','Анна','Волкова','anna@example.test',1,'2025-09-01','ACTIVE',250),(2,'+79100000002','Борис','Орлов',NULL,2,'2025-09-03','ACTIVE',-20),(3,'+79100000003','Вера','Иванова','vera@example.test',3,'2025-10-01','SUSPENDED',0),(4,'+79100000004','Глеб','Соколов','gleb@example.test',1,'2025-10-10','ACTIVE',500),(5,'+79100000005','Дина','Белова',NULL,5,'2025-11-01','ACTIVE',100),(6,'+79100000006','Егор','Петров','egor@example.test',NULL,'2025-11-02','TERMINATED',-50),(7,'+79100000007','Жанна','Миронова','zhanna@example.test',4,'2025-11-03','ACTIVE',1000),(8,'+79100000008','Зоя','Зайцева',NULL,2,'2025-11-04','SUSPENDED',100);
CREATE TABLE call_records (record_id INT, subscriber_id INT, service_type_id INT, call_date STRING, destination_number STRING, duration_seconds INT, quantity INT, cost NUMBER);
INSERT INTO call_records VALUES (1,1,1,'2025-11-01 10:00:00','+79000000001',60,1,2),(2,1,1,'2025-11-02 10:00:00','+79000000002',120,1,4),(3,2,1,'2025-11-01 11:00:00','+79000000003',30,1,1.5),(4,2,3,'2025-11-03 11:00:00','900',0,1,2),(5,3,1,'2025-11-02 12:00:00','+79000000004',300,1,5),(6,4,1,'2025-11-03 13:00:00','+79000000005',180,1,6),(7,4,1,'2025-11-04 13:00:00','+79000000006',60,1,2),(8,7,1,'2025-11-05 14:00:00','+79000000007',600,1,0);
CREATE TABLE data_usage (usage_id INT, subscriber_id INT, usage_date STRING, data_mb INT, cost NUMBER);
INSERT INTO data_usage VALUES (1,1,'2025-11-01',1024,150),(2,1,'2025-11-02',512,75),(3,2,'2025-11-01',2048,300),(4,4,'2025-11-02',0,0),(5,7,'2025-11-03',4096,200);
CREATE TABLE invoices (invoice_id INT, subscriber_id INT, billing_period STRING, issue_date STRING, due_date STRING, monthly_fee NUMBER, usage_charges NUMBER, total_amount NUMBER, status STRING);
INSERT INTO invoices VALUES (1,1,'2025-11','2025-11-01','2025-11-10',300,6,306,'PAID'),(2,2,'2025-11','2025-11-01','2025-11-10',500,3.5,503.5,'OVERDUE'),(3,3,'2025-11','2025-11-01','2025-11-10',800,5,805,'PENDING'),(4,4,'2025-11','2025-11-01','2025-11-10',300,8,308,'PAID'),(5,7,'2025-11','2025-11-01','2025-11-10',1200,0,1200,'PENDING');
CREATE TABLE payments (payment_id INT, subscriber_id INT, invoice_id, payment_date STRING, amount NUMBER, payment_method STRING, transaction_id STRING);
INSERT INTO payments VALUES (1,1,1,'2025-11-02 09:00:00',200,'CARD','tx-1'),(2,1,1,'2025-11-03 09:00:00',106,'CARD','tx-2'),(3,4,4,'2025-11-04 09:00:00',308,'CARD','tx-3'),(4,5,NULL,'2025-11-05 09:00:00',100,'CASH','tx-4');
CREATE TABLE plan_changes (change_id INT, subscriber_id INT, old_plan_id INT, new_plan_id INT, change_date STRING, reason STRING);
INSERT INTO plan_changes VALUES (1,1,2,1,'2025-10-01','Экономия'),(2,2,1,2,'2025-10-10','Больше минут'),(3,7,3,4,'2025-11-01','Безлимит');
```

## 01. Первые поля

```text
#task
Выведи plan_id, plan_name и monthly_fee всех тарифов по plan_id.
= SELECT plan_id, plan_name, monthly_fee FROM tariff_plans ORDER BY plan_id;
```

> [!tip]- Подсказка
> Перечисли нужные столбцы, а сортировку укажи явно.

- [ ] Решил самостоятельно и объяснил результат.

## 02. Долги активных абонентов

```text
#task
Найди subscriber_id и balance активных абонентов с отрицательным балансом, по subscriber_id.
= SELECT subscriber_id, balance FROM subscribers WHERE status = 'ACTIVE' AND balance < 0 ORDER BY subscriber_id;
```

> [!tip]- Подсказка
> Нужно одновременное выполнение двух условий.

- [ ] Решил самостоятельно и объяснил результат.

## 03. Отсутствующий email

```text
#task
Выведи subscriber_id и first_name абонентов без email, по subscriber_id.
= SELECT subscriber_id, first_name FROM subscribers WHERE email IS NULL ORDER BY subscriber_id;
```

> [!tip]- Подсказка
> NULL проверяется отдельным оператором.

- [ ] Решил самостоятельно и объяснил результат.

## 04. Тарифы по цене

```text
#task
Выведи plan_name и monthly_fee тарифов с ценой не больше 500, сначала по monthly_fee, затем plan_id.
= SELECT plan_name, monthly_fee FROM tariff_plans WHERE monthly_fee <= 500 ORDER BY monthly_fee, plan_id;
```

> [!tip]- Подсказка
> Включи граничное значение 500.

- [ ] Решил самостоятельно и объяснил результат.

## 05. Уникальные состояния

```text
#task
Выведи уникальные status абонентов по алфавиту.
= SELECT DISTINCT status FROM subscribers ORDER BY status;
```

> [!tip]- Подсказка
> Речь об уникальных значениях, не о строках абонентов.

- [ ] Решил самостоятельно и объяснил результат.

## 06. Число и известный email

```text
#task
В одной строке верни subscriber_count (число абонентов) и email_count (число непустых email).
= SELECT COUNT(*) AS subscriber_count, COUNT(email) AS email_count FROM subscribers;
```

> [!tip]- Подсказка
> COUNT(\*) и COUNT(column) считают разное.

- [ ] Решил самостоятельно и объяснил результат.

## 07. Текущий тариф

```text
#task
Выведи subscriber_id, first_name и plan_name всех абонентов, включая абонента без тарифа; сортируй по subscriber_id.
= SELECT s.subscriber_id, s.first_name, t.plan_name FROM subscribers AS s LEFT JOIN tariff_plans AS t ON t.plan_id = s.plan_id ORDER BY s.subscriber_id;
```

> [!tip]- Подсказка
> Сохрани левую сторону, даже если справа не найдена строка.

- [ ] Решил самостоятельно и объяснил результат.

## 08. Число абонентов тарифа

```text
#task
Для непустых plan_id выведи plan_id и subscriber_count, сортируй по plan_id.
= SELECT plan_id, COUNT(*) AS subscriber_count FROM subscribers WHERE plan_id IS NOT NULL GROUP BY plan_id ORDER BY plan_id;
```

> [!tip]- Подсказка
> Сначала убери NULL, затем сгруппируй.

- [ ] Решил самостоятельно и объяснил результат.

## 09. Тарифы с несколькими абонентами

```text
#task
Выведи plan_id и subscriber_count только для тарифов с числом абонентов больше 1; не учитывай NULL plan_id, сортируй по plan_id.
= SELECT plan_id, COUNT(*) AS subscriber_count FROM subscribers WHERE plan_id IS NOT NULL GROUP BY plan_id HAVING COUNT(*) > 1 ORDER BY plan_id;
```

> [!tip]- Подсказка
> Условие на агрегат относится к HAVING.

- [ ] Решил самостоятельно и объяснил результат.

## 10. Ни одного события

```text
#task
Выведи subscriber_id абонентов без call_records, по subscriber_id.
= SELECT s.subscriber_id FROM subscribers AS s LEFT JOIN call_records AS c ON c.subscriber_id = s.subscriber_id WHERE c.record_id IS NULL ORDER BY s.subscriber_id;
```

> [!tip]- Подсказка
> После LEFT JOIN ищи NULL в PK правой стороны.

- [ ] Решил самостоятельно и объяснил результат.

## 11. Количество событий для всех

```text
#task
Выведи subscriber_id и event_count для каждого абонента, включая ноль, сортируй по subscriber_id.
= SELECT s.subscriber_id, COUNT(c.record_id) AS event_count FROM subscribers AS s LEFT JOIN call_records AS c ON c.subscriber_id = s.subscriber_id GROUP BY s.subscriber_id ORDER BY s.subscriber_id;
```

> [!tip]- Подсказка
> COUNT(\*) даст неожиданный результат для отсутствующей пары.

- [ ] Решил самостоятельно и объяснил результат.

## 12. Только исходящие события

```text
#task
Выведи subscriber_id и outgoing_count всех абонентов, считая только service_type_id = 1; сортируй по subscriber_id.
= SELECT s.subscriber_id, COUNT(c.record_id) AS outgoing_count FROM subscribers AS s LEFT JOIN call_records AS c ON c.subscriber_id = s.subscriber_id AND c.service_type_id = 1 GROUP BY s.subscriber_id ORDER BY s.subscriber_id;
```

> [!tip]- Подсказка
> Поставь условие типа события в ON, чтобы не потерять абонента.

- [ ] Решил самостоятельно и объяснил результат.

## 13. История платежей

```text
#task
Для абонентов с платежами выведи subscriber_id и paid_total (сумма amount), по subscriber_id.
= SELECT subscriber_id, SUM(amount) AS paid_total FROM payments GROUP BY subscriber_id ORDER BY subscriber_id;
```

> [!tip]- Подсказка
> Здесь допустимо не показывать абонентов без платежей.

- [ ] Решил самостоятельно и объяснил результат.

## 14. Счета и частичные платежи

```text
#task
Для каждого счёта выведи invoice_id и paid_total с нулём при отсутствии платежей, сортируй по invoice_id.
= SELECT i.invoice_id, COALESCE(SUM(p.amount), 0) AS paid_total FROM invoices AS i LEFT JOIN payments AS p ON p.invoice_id = i.invoice_id GROUP BY i.invoice_id ORDER BY i.invoice_id;
```

> [!tip]- Подсказка
> Сохрани все счета и замени NULL суммы нулём.

- [ ] Решил самостоятельно и объяснил результат.

## 15. Пополнение без счёта

```text
#task
Выведи payment_id, subscriber_id и amount платежей без invoice_id по payment_id.
= SELECT payment_id, subscriber_id, amount FROM payments WHERE invoice_id IS NULL ORDER BY payment_id;
```

> [!tip]- Подсказка
> Не каждый платёж связан с конкретным счётом.

- [ ] Решил самостоятельно и объяснил результат.

## 16. Интернет по абонентам

```text
#task
Выведи subscriber_id и total_mb (SUM data_mb) из data_usage, сортируй по subscriber_id.
= SELECT subscriber_id, SUM(data_mb) AS total_mb FROM data_usage GROUP BY subscriber_id ORDER BY subscriber_id;
```

> [!tip]- Подсказка
> Единицы результата — MB, не GB.

- [ ] Решил самостоятельно и объяснил результат.

## 17. Старая и новая роли тарифа

```text
#task
Выведи change_id, old_name и new_name через две ссылки на tariff_plans, сортируй по change_id.
= SELECT c.change_id, old_t.plan_name AS old_name, new_t.plan_name AS new_name FROM plan_changes AS c LEFT JOIN tariff_plans AS old_t ON old_t.plan_id = c.old_plan_id LEFT JOIN tariff_plans AS new_t ON new_t.plan_id = c.new_plan_id ORDER BY c.change_id;
```

> [!tip]- Подсказка
> Одну таблицу присоедини два раза с разными алиасами.

- [ ] Решил самостоятельно и объяснил результат.

## 18. Сортировка с ничьей

```text
#task
Выведи subscriber_id и balance всех абонентов, по balance DESC и subscriber_id ASC.
= SELECT subscriber_id, balance FROM subscribers ORDER BY balance DESC, subscriber_id ASC;
```

> [!tip]- Подсказка
> У Дины и Зои одинаковый баланс, нужен второй критерий.

- [ ] Решил самостоятельно и объяснил результат.

## После браузерной практики

Перенеси 3–4 решения в PostgreSQL и запусти на полной базе. Не ожидай тех же ID и сумм: исходных строк значительно больше, а plan\_changes в исходнике не заполнена. Сначала изучи актуальные данные. Затем сравни планы одного узкого и одного широкого запроса в [[Лекции/13. Производительность и индексы]].
