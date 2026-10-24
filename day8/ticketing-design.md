# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. Most days it is quiet. When a very popular concert goes on sale, tens of thousands of people arrive in the same minute and compete for a limited number of seats. The design must stay fast and correct in both situations, and it must never sell the same seat twice.

This document follows the six-part design framework: requirements, estimates, API, data model, architecture, and trade-offs.

## Goals and non-goals

- **Goals:** let people browse events, pick specific seats, hold them briefly, pay, and see their tickets. Never double-book a seat. Survive a big on-sale without crashing and without unfair advantages.
- **Non-goals (not designed here):** resale or transfer of tickets, refunds policy, seat-map drawing tools, recommendation features and multi-currency pricing.

## 1. Requirements

### Functional requirements

- A user can register and log in.
- A user can browse and search events and see an event's details.
- A user can see which seats are available for an event.
- A user can hold one or more specific seats for a short time (5 minutes) while they pay.
- A user can pay for the held seats and receive tickets.
- A user can see their tickets.
- A held seat that is not paid for is released automatically.
- The user receives a confirmation email with their tickets.

### Non-functional requirements

- **Correctness (the most important):** a seat is never sold to two people, and a customer is never charged for a seat they do not get. Money and seats must always agree.
- **Speed:** browsing pages load in under 1 second, and a seat hold answers in under 500 ms, even during a big sale.
- **Fairness:** during a big sale, people are served in the order they arrived, and one person (or a bot) cannot grab hundreds of seats. Each order is limited to 4 tickets.
- **Availability:** 99.9% uptime overall, and the system must not fall over during the 10 minutes that matter most for the business.
- **Scalability:** handle the peak of a big sale (about 600 times the normal load) without redesigning the system.
- **Durability:** a paid order and its tickets are never lost.
- **Security:** HTTPS everywhere, passwords stored only as hashes, card details handled by the payment provider and never stored by us, and users can only see their own tickets.

## 2. Estimates

For easy maths, 1 day ≈ 100,000 seconds, and busy moments are about 5× the average.

### Normal day

```text
Visitors:        50,000 people per day (2.5% of the 2,000,000 registered users)
Page views:      50,000 × 10 pages           = 500,000 per day
                 500,000 ÷ 100,000           ≈ 5 page views per second (average)
                 Peak (× 5)                  ≈ 25 page views per second

Tickets sold:    5,000 per day
                 5,000 ÷ 100,000             ≈ 0.05 tickets per second
                 (one ticket every 20 seconds; peak ≈ 0.25 per second)

Storage:         5,000 tickets/day × 365     ≈ 1.8 million tickets per year
                 at about 500 bytes per ticket and order row (my assumption)
                                             ≈ 1 GB per year
```

A normal day is tiny. One small server and one database could handle it. Reads outnumber purchases about 100 to 1 (500,000 views against 5,000 tickets), so the system is read-heavy.

### Big sale (popular concert)

```text
Buyers:          200,000 people in the first 10 minutes (600 seconds)
                 200,000 ÷ 600                ≈ 333 new buyers per second (average)
                 The first seconds are busiest (× 5) ≈ 1,700 new buyers per second

Requests:        I assume each buyer makes about 10 requests (event page, seat map
                 loaded a few times, hold attempts, payment)
                 200,000 × 10 = 2,000,000 requests in 600 seconds
                                              ≈ 3,300 requests per second (average)
                 Peak (× 5)                   ≈ 16,700 requests per second

Seats:           20,000 seats to sell
                 20,000 ÷ 600                 ≈ 33 seats sold per second at most

Competition:     200,000 buyers for 20,000 seats = 10 buyers for every seat
                 At least 180,000 people (90%) will NOT get a ticket.
```

### Comparison

- **Traffic:** about 3,300 requests per second against 5 page views per second is roughly **650 times more** load.
- **Sales:** 33 tickets per second against 0.05 per second is also about **650 times more**.
- **Visitors:** the sale brings 4 times a whole normal day's visitors (200,000 against 50,000) into 10 minutes.
- **Readers versus buyers:** the system is read-heavy on a normal day, but in the big sale it is also under heavy **write pressure** and **contention**, because thousands of people try to change the same few hundred good seats at the same moment.
- **What this tells us:** the design must not be sized for the normal day, and it must not be sized for the peak all year round either. The sale is known in advance (the `on_sale_at` time), so we can add capacity just before it starts and control how fast people enter. Also, 90% of the people will lose, so a fast and polite "sold out" or "seat taken" answer matters as much as a successful purchase.

## 3. API

Conventions: base URL `https://api.tickethub.com/v1`, JSON bodies, plural nouns, `Authorization: Bearer <token>` on every endpoint except browsing, registering and logging in. The server finds the user from the token.

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | GET | `/events` | Browse and search events (`?search=`, `?date=`, `?page=`). | `200 OK` |
| 2 | GET | `/events/17` | Details of one event. | `200 OK` |
| 3 | GET | `/events/17/seats` | The seat map: every seat and whether it is available (`?section=`). | `200 OK` |
| 4 | POST | `/orders` | Hold the chosen seats for 5 minutes by creating a pending order. | `201 Created` |
| 5 | POST | `/orders/501/payment` | Pay for a pending order and receive its tickets. | `201 Created` |
| 6 | DELETE | `/orders/501` | Cancel a pending order and release its seats. | `204 No Content` |
| 7 | GET | `/me/tickets` | List the logged-in user's tickets. | `200 OK` |
| 8 | POST | `/events/17/waiting-room` | Join the waiting room for a big sale and get a place in line. | `202 Accepted` |

Registering and logging in work as in the QuickNotes API (`POST /users` and `POST /sessions`).

### Hold seats: `POST /orders`

Header: `Idempotency-Key: 7c1f...` (a random value the browser creates for this attempt, so a double-click or a retry cannot create two orders).

```json
{
  "eventId": 17,
  "seatIds": [1204, 1205]
}
```

Success, `201 Created`:

```json
{
  "id": 501,
  "status": "pending",
  "seatIds": [1204, 1205],
  "totalCents": 25000,
  "expiresAt": "2026-10-22T19:05:00Z"
}
```

If any seat is already taken, **nothing** is held, and the answer is `409 Conflict`:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Seat 1205 was just taken. Please choose another seat.",
    "unavailableSeatIds": [1205]
  }
}
```

### Pay: `POST /orders/501/payment`

```json
{ "paymentToken": "tok_9f2c..." }
```

Success, `201 Created`:

```json
{
  "orderId": 501,
  "status": "paid",
  "tickets": [
    { "id": 8801, "seatId": 1204, "code": "TH-501-1204" },
    { "id": 8802, "seatId": 1205, "code": "TH-501-1205" }
  ]
}
```

### Errors

- `400 Bad Request` - invalid input, for example no seats chosen or more than 4 seats.
- `401 Unauthorized` - not logged in or the token has expired.
- `403 Forbidden` - the order belongs to another user, or the user has not been admitted from the waiting room.
- `404 Not Found` - the event, seat or order does not exist.
- `409 Conflict` - a seat is already taken (the double-booking guard).
- `410 Gone` - the hold expired before payment, so the seats were released.
- `402 Payment Required` - the payment was declined; the hold stays until it expires so the user can try another card.
- `429 Too Many Requests` - rate limit exceeded, or the sale is busy and the user must wait.
- `503 Service Unavailable` - the system is overloaded or down for maintenance.

## 4. Data model

Five tables: `users`, `events`, `seats`, `orders` and `tickets`. SQLite syntax is used, as in the course.

### Relationships

- **users to orders is one-to-many.** One user places many orders, and each order belongs to one user.
- **events to seats is one-to-many.** One event has thousands of seats, and each seat belongs to one event.
- **events to orders is one-to-many.** One event has many orders.
- **orders to seats is many-to-many**, and the join table is **`tickets`**. An order can contain several seats, and over time a seat can appear in several orders (a hold expires and another person buys it). The `tickets` table stores one row for each seat that was actually *paid for*.
- **seats to tickets is one-to-at-most-one.** The `UNIQUE` constraint on `tickets.seat_id` means a seat can be on only one ticket, ever.

### CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id                     INTEGER PRIMARY KEY,
  title                  TEXT NOT NULL,
  venue                  TEXT NOT NULL,
  starts_at              TEXT NOT NULL,
  on_sale_at             TEXT NOT NULL,
  max_tickets_per_order  INTEGER NOT NULL DEFAULT 4
                         CHECK (max_tickets_per_order BETWEEN 1 AND 10)
);

CREATE TABLE orders (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  event_id         INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  total_cents      INTEGER NOT NULL CHECK (total_cents >= 0),
  idempotency_key  TEXT NOT NULL,
  payment_ref      TEXT,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at       TEXT NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  UNIQUE (user_id, idempotency_key)      -- a retried request cannot create a second order
);

CREATE TABLE seats (
  id                INTEGER PRIMARY KEY,
  event_id          INTEGER NOT NULL,
  section           TEXT NOT NULL,
  row_label         TEXT NOT NULL,
  seat_number       INTEGER NOT NULL,
  price_cents       INTEGER NOT NULL CHECK (price_cents > 0),
  status            TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'held', 'sold')),
  held_by_order_id  INTEGER,
  held_until        TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (held_by_order_id) REFERENCES orders(id),
  UNIQUE (event_id, section, row_label, seat_number),   -- no duplicate seat on the map
  CHECK (status <> 'held' OR (held_by_order_id IS NOT NULL AND held_until IS NOT NULL)),
  CHECK (status = 'held' OR (held_by_order_id IS NULL AND held_until IS NULL))
);

CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL,
  seat_id    INTEGER NOT NULL UNIQUE,    -- a seat can be on at most ONE ticket
  code       TEXT NOT NULL UNIQUE,       -- the value in the ticket's QR code
  issued_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id)  REFERENCES seats(id)
);
```

Notes on the choices:

- Orders and tickets use no `ON DELETE CASCADE`, so financial records cannot disappear by accident.
- The two `CHECK` rules on `seats` mean that the hold columns are filled in only while a seat is `held`. The database refuses an inconsistent seat.
- In a real system the ticket `code` would be random and unguessable (for example signed), not built from ids.

### Indexes

```sql
CREATE INDEX idx_seats_event_status  ON seats(event_id, status);
CREATE INDEX idx_seats_held_by       ON seats(held_by_order_id);
CREATE INDEX idx_orders_status_expiry ON orders(status, expires_at);
CREATE INDEX idx_orders_user         ON orders(user_id);
```

- `idx_seats_event_status` - the seat map and the "is this event sold out?" check always look at one event's seats by status. This is the most used query in the big sale.
- `idx_seats_held_by` - paying and cancelling find all seats held by one order, and this index avoids reading every seat of the event.
- `idx_orders_status_expiry` - the expiry job asks "which pending orders are past their `expires_at`?" every few seconds.
- `idx_orders_user` - `GET /me/tickets` looks up one user's orders.
- Cost: each index slows writes slightly. These are worth it because every one serves a frequent query, and the seat and order tables are small compared to what a modern database can handle.

### Queries behind the read endpoints

```sql
-- GET /events/17/seats: the seat map (an expired hold counts as available again)
SELECT id, section, row_label, seat_number, price_cents,
       CASE WHEN status = 'available'
              OR (status = 'held' AND held_until < datetime('now'))
            THEN 'available' ELSE 'unavailable' END AS state
FROM seats
WHERE event_id = :event_id
ORDER BY section, row_label, seat_number;

-- GET /me/tickets: the logged-in user's tickets
SELECT tickets.code, events.title, events.starts_at,
       seats.section, seats.row_label, seats.seat_number
FROM tickets
JOIN orders ON orders.id = tickets.order_id
JOIN seats  ON seats.id  = tickets.seat_id
JOIN events ON events.id = orders.event_id
WHERE orders.user_id = :user_id AND orders.status = 'paid'
ORDER BY events.starts_at;
```

## 5. How the design prevents two people buying the same seat

Double-booking happens when two buyers act at the same moment. A bad design reads first and writes second:

```text
Buyer A: SELECT status FROM seats WHERE id = 1204   -> 'available'
Buyer B: SELECT status FROM seats WHERE id = 1204   -> 'available'   (same instant)
Buyer A: UPDATE seats SET status = 'held' ...       -> works
Buyer B: UPDATE seats SET status = 'held' ...       -> also works. Two buyers, one seat!
```

The gap between "check" and "act" is the bug. TicketHub closes the gap with four layers.

### Layer 1: one atomic, conditional update decides the winner

Checking and changing happen in **one statement**, so the database does them as a single step:

```sql
UPDATE seats
SET status = 'held',
    held_by_order_id = :order_id,
    held_until = datetime('now', '+5 minutes')
WHERE id = :seat_id
  AND event_id = :event_id
  AND (status = 'available'
       OR (status = 'held' AND held_until < datetime('now')));   -- an expired hold can be taken over
```

The application then looks at the number of **rows changed**. The database applies updates to the same row one after another (the *isolation* in ACID), so when two buyers race, the first sees an available seat and changes it. The second finds a seat that no longer matches the `WHERE` condition, so **0 rows change**, and the API answers `409 Conflict`. No application-level lock is needed, and there is no lock to forget to release.

### Layer 2: a transaction makes a multi-seat hold all-or-nothing

A buyer who wants 3 seats must get all 3 or none (*atomicity*):

```sql
BEGIN IMMEDIATE;

INSERT INTO orders (user_id, event_id, total_cents, idempotency_key, expires_at)
VALUES (:user_id, :event_id, 0, :idempotency_key, datetime('now', '+5 minutes'));
-- the new order id is available to the application (last_insert_rowid())

-- for each requested seat, run the conditional UPDATE from Layer 1.
-- If ANY of them changes 0 rows: run ROLLBACK and answer 409. Nothing stays held.

UPDATE orders
SET total_cents = (SELECT SUM(price_cents) FROM seats WHERE held_by_order_id = :order_id)
WHERE id = :order_id;

COMMIT;
```

If the server crashes half-way, the transaction is rolled back and the seats are untouched.

### Layer 3: finishing the payment is also a transaction, and a UNIQUE constraint is the last line of defence

When the payment provider approves the payment, the server turns held seats into tickets:

```sql
BEGIN IMMEDIATE;

-- Create a ticket only for seats that STILL belong to this order and have not expired.
INSERT INTO tickets (order_id, seat_id, code)
SELECT :order_id, id, 'TH-' || :order_id || '-' || id
FROM seats
WHERE held_by_order_id = :order_id AND status = 'held' AND held_until >= datetime('now');

-- If the number of tickets inserted is not the number of seats in the order:
-- ROLLBACK and refund the payment (the hold expired and someone else may have the seat).

UPDATE seats
SET status = 'sold', held_by_order_id = NULL, held_until = NULL
WHERE held_by_order_id = :order_id AND status = 'held';

UPDATE orders SET status = 'paid', payment_ref = :payment_ref
WHERE id = :order_id AND status = 'pending';

COMMIT;
```

Even if a bug in the application code tried to issue a second ticket for the same seat, `tickets.seat_id` is `UNIQUE`, so **the database itself refuses**. This is the *consistency* in ACID: the rules are never broken, whatever the application does.

### Layer 4: expiry, idempotency and the cache are handled safely

- **Holds expire.** A background job (run by a worker every few seconds) releases abandoned holds so that seats do not stay locked by people who left. Layer 1 also lets a buyer take over a seat whose hold has already expired, so correctness never depends on the job running on time.

  ```sql
  UPDATE seats SET status = 'available', held_by_order_id = NULL, held_until = NULL
  WHERE status = 'held' AND held_until < datetime('now');

  UPDATE orders SET status = 'expired'
  WHERE status = 'pending' AND expires_at < datetime('now');
  ```

- **Retries are safe.** `POST /orders` and the payment call carry an `Idempotency-Key`. A double-click or a network retry returns the same order instead of creating a second one, and the payment provider receives the order id as its idempotency key, so the card is charged only once.
- **The seat map in the cache may be slightly old, but it never decides anything.** The cache is only a picture. A seat that shows as available may already be taken, and the user simply gets `409 Conflict` and picks another. The decision is always made by the conditional `UPDATE` on the **primary** database (never on a read replica and never in the cache).
- **Time comes from the database** (`datetime('now')`), not from app servers or phones, so clocks that disagree cannot extend a hold.

### Payment edge cases

- **Payment succeeds, but the hold expired and another buyer took the seat:** the `INSERT` in Layer 3 inserts fewer tickets than expected, the transaction is rolled back, and the payment is refunded automatically. The customer is told clearly (`410 Gone`).
- **Payment declined:** the seats stay held until the 5 minutes end, so the user can try another card (`402`).
- **The server crashes after payment but before commit:** a worker reconciles with the payment provider, using the order id, and either completes the order or refunds it.

## 6. Architecture

### Diagram

```text
┌───────────────┐        ┌─────────┐
│ Browser /     │ ─────> │   DNS   │  (tickethub.com -> IP addresses)
│ mobile client │        └─────────┘
└──────┬────────┘
       │ HTTPS
       v
┌──────────────────────────────────────────────┐
│ CDN + waiting room (at the edge)             │
│ serves static files and cached event pages;  │
│ in a big sale it lets people in at a fixed   │
│ rate, in the order they arrived              │
└──────────────────────┬───────────────────────┘
                       │ admitted requests only
                       v
              ┌─────────────────┐
              │ Load balancer   │
              └────────┬────────┘
        ┌──────────────┼──────────────┐
        v              v              v
   ┌────────┐     ┌────────┐     ┌────────┐
   │ App 1  │     │ App 2  │     │ App N  │   (stateless; many more are added
   └────────┘     └────────┘     └────────┘    before a big sale)
        │              │              │
        └──────────────┴──────┬───────┘      every app server uses all of these:
                              │
     ┌───────────────┬────────┴─────────┬──────────────────┬──────────────────┐
     v               v                  v                  v                  v
┌──────────┐   ┌──────────────┐   ┌───────────────┐   ┌─────────┐   ┌──────────────────┐
│  Cache   │   │ Primary DB   │   │ Read replicas │   │  Queue  │   │ Payment provider │
│ (Redis)  │   │ holds,       │──>│ (browsing     │   │ (jobs)  │   │ (external)       │
│          │   │ orders,      │   │  reads)       │   └────┬────┘   └──────────────────┘
└──────────┘   │ tickets      │   └───────────────┘        │
               └──────────────┘                            v
        writes go to the primary only;                ┌─────────┐
        it copies each change to the replicas         │ Workers │ emails, expiry job,
                                                      └─────────┘ payment checks
```

Read the diagram top to bottom. Static files and event pages come from the edge. In a big sale, the edge also runs the waiting room and admits users at a fixed pace. Admitted requests go through the load balancer to many identical app servers. Browsing reads come from the cache and read replicas. Anything that changes seats (holds, payments) goes only to the primary database. Slow jobs go to the queue, and workers handle them.

### What each component does

- **Client (browser or mobile app):** shows events and the seat map and sends API requests, so users never talk to the database directly.
- **DNS:** turns `tickethub.com` into the addresses of the system, so users do not need to know where the servers are.
- **CDN:** keeps copies of static files, images and public event pages near users, so the site loads quickly and most browsing traffic never reaches our servers.
- **Waiting room:** during a big sale, admits users in arrival order at a fixed rate (about 300 per second), so the servers see a steady stream instead of a wall of 1,700 new buyers per second, and so the sale is fair.
- **Load balancer:** spreads requests across the app servers and skips any that fail a health check, so no server is overloaded and one failure does not stop the sale.
- **App servers:** run the TicketHub API code, and because they are stateless we can add many more of them before a big sale and remove them afterwards.
- **Cache (Redis):** keeps event pages and seat maps in memory for one or two seconds, so thousands of people refreshing the seat map hit memory instead of the database. It also stores a quick "available seat count" so a sold-out event can answer instantly.
- **Primary database:** the one true copy of all seats, orders and tickets, and the only place that accepts holds and payments, so seat decisions are made in one place and are never in conflict.
- **Read replicas:** copies of the primary that answer browsing reads, so reading never slows down the holds and payments on the primary.
- **Payment provider (external):** takes and processes card payments, so TicketHub never stores card numbers and does not have to build payment security itself.
- **Queue:** holds background jobs (send tickets by email, release expired holds, reconcile payments), so the buyer gets an answer at once and bursts of jobs wait in line.
- **Workers:** do those background jobs, so slow work never delays a hold or a payment.

### How the design survives the big sale

1. **Waiting room first.** 200,000 people cannot all be let in at once. Admitting about 300 per second turns a spike of about 1,700 new buyers per second into a steady flow close to the 333-per-second average. The people waiting see a static page from the CDN, which costs us almost nothing.
2. **Read traffic never reaches the database.** The seat map is cached for 1–2 seconds and served from Redis. 200,000 people refreshing it produce a few database reads per second, not thousands.
3. **Writes are small, indexed and independent.** A hold is one indexed `UPDATE` on one seat row. Different seats do not block each other, and a failed attempt (0 rows changed) is cheap.
4. **Sold-out fast path.** When the cached available-seat count reaches 0, the API answers "sold out" immediately and the waiting room closes, so the roughly 180,000 people who lose get a quick, honest answer instead of an error or a timeout. (The count is only a shortcut. The database still has the final word.)
5. **Pre-scaling.** The start time is known in advance, so extra app servers are started before `on_sale_at` and removed afterwards, and the database failover and backups are checked beforehand.
6. **Bounded payment load.** At most 20,000 seats can be held at once, so there are never more than a few thousand people paying at the same moment, and holds expire after 5 minutes.
7. **Fairness and abuse control.** Per-user and per-IP rate limits (`429`), a maximum of 4 tickets per order, and a login requirement before joining the waiting room make it harder for bots to take large numbers of seats.
8. **Graceful degradation.** If the cache fails, the apps read from the replicas (slower but working). If the queue or workers are slow, tickets arrive by email a little later but the purchase is already safe in the database. If a replica fails, reads fall back to another one or to the primary.
9. **Single points of failure removed.** The edge, load balancer, queue and cache are managed or redundant services. There are many app servers and workers. The primary has a standby replica that can be promoted (failover), with nightly backups that are tested.
10. **Monitoring.** Dashboards and alerts for requests per second, error rate, `409` rate, waiting-room length, hold-to-payment conversion, database CPU and replica lag, so engineers see problems during the sale and not afterwards.

## 7. Trade-offs

- **Fairness and safety versus speed.** The waiting room makes some people wait minutes, and a user could have clicked faster without it. I accept this because without it the servers would be overwhelmed and nobody would buy anything, and because first-come order is fairer than a race won by the fastest connection or a bot.
- **Correctness versus speed and cost.** Every hold goes to the single primary database, and a hold must wait for the answer. This is slower and harder to scale than letting replicas or the cache decide, but it is the only way to be sure that no seat is sold twice. I chose correctness, and recovered speed by caching everything that is only for display.
- **Freshness versus load.** The seat map in the cache can be 1–2 seconds old, so a user sometimes clicks a seat that was just taken and gets a `409`. This is an acceptable small annoyance in exchange for removing thousands of database reads per second.
- **Hold length: 5 minutes.** A shorter hold frees abandoned seats faster but makes slow payers lose their seats; a longer hold is kinder to slow payers but lets people (and bots) lock seats away from others. 5 minutes is a compromise.
- **Simplicity versus scalability.** One primary database, not a sharded one, keeps the design much simpler, and its load is small (about 33 seats per second at most). If TicketHub later sold many huge events at the same time, it could shard by `event_id`, because all the rows for one event stay together.
- **Cost versus capacity.** Adding servers only for the sale costs money for a short time, but keeping that capacity all year would waste it. The risk is that scaling up is late or fails, so it is tested in advance.

## 8. Alternatives considered and risks

### Alternatives considered

- **Read first, then write (`SELECT` then `UPDATE`):** rejected because two buyers can both pass the check, as shown in section 5.
- **Row locks (`SELECT ... FOR UPDATE` in PostgreSQL):** works, but holds a lock while the application thinks, and a crash or slow request can block other buyers. The single conditional `UPDATE` achieves the same safety with no lock to manage.
- **A lock in Redis:** adds a second system that must agree with the database, and if the lock and the database disagree, seats can be double-sold. The database is already the source of truth, so the decision stays there.
- **A lottery instead of first-come, first-served:** very fair and calm for the servers, but not what most customers expect. It could be offered as an option for the most popular events.

### Risks and open questions

- **Payment provider outage during the sale:** holds would expire while people cannot pay. Possible fix: extend holds automatically while the provider reports a problem.
- **Bots:** rate limits and login help, but strong bot protection (for example a challenge page in the waiting room) still has to be chosen.
- **Hot seats:** many people want the same best seats, so there will be many `409` answers. The UI should suggest nearby seats quickly.
- **Failover during a sale:** a primary database failure would pause purchases for a short time. Failover must be rehearsed.
- **Refund policy and ticket transfer** are not designed yet.