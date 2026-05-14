# APP 1 — Product Inventory

Standalone Next.js 14 + TypeScript inventory app, backed by Supabase Postgres.
The same codebase runs as Factory 1–4 and Warehouse 1–2. Every instance shares
one Supabase project and one table — rows are isolated by an `instance_name`
column that is set per deployment via env vars. The UI cannot change instance
identity; that comes from the environment only.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `@supabase/supabase-js` (server-side queries from API routes)
- In-browser polling for live data; client-side activity log
- Vercel-ready (no custom port handling)

## Layout

```
app-1-product-inventory/
├── app/
│   ├── api/
│   │   ├── inventory/             (GET list, [id] GET, reserve/release/restock POST)
│   │   └── status/                (GET)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ActivityFeed.tsx
│   ├── ConnectionStatus.tsx
│   ├── Dashboard.tsx              (client orchestrator)
│   ├── InventoryTable.tsx
│   ├── QuantityModal.tsx
│   ├── StatCard.tsx
│   ├── StatusBadge.tsx
│   └── Toast.tsx
├── lib/
│   ├── api-helpers.ts
│   ├── inventory-store.ts         (Supabase-backed)
│   ├── supabase.ts                (cached client + instance-name guard)
│   └── types.ts
├── supabase/
│   ├── schema.sql                 (one-time: table, indexes, trigger)
│   └── seed.sql                   (idempotent: seeds all 6 instances)
└── package.json
```

## 1. Supabase setup

### 1a. Schema (run once)

Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) into the
Supabase SQL editor and run. It creates `public.product_inventory`, the
`updated_at` trigger, indexes on `instance_name`, and disables RLS for the demo.

### 1b. Seed (run any time)

Paste the contents of [`supabase/seed.sql`](supabase/seed.sql) into the SQL
editor and run. It inserts 60 rows — the same 10 manufacturing SKUs across all
six instances, with different on-hand / reserved values so each location looks
operationally distinct:

| Instance      | Operational character                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Factory 1     | Baseline mid-stock assembly line                                         |
| Factory 2     | Second line, heavier on body panels and batteries                        |
| Factory 3     | Starved line — many LOW STOCK rows and one OUT OF STOCK                  |
| Factory 4     | High-throughput line, very high reservations across the board           |
| Warehouse 1   | Bulk storage — large `on_hand`, low `reserved`                           |
| Warehouse 2   | Smaller depot — two OUT OF STOCK rows                                    |

The seed uses `on conflict (instance_name, sku) do update set …`, so re-running
it acts as a **demo reset** — quantities revert to seed values, IDs are
preserved.

### 1c. (Optional) reset a single instance

```sql
delete from public.product_inventory where instance_name = 'Factory 3';
-- then re-run supabase/seed.sql to repopulate it
```

## 2. Environment variables

```env
INSTANCE_NAME=Factory 1
NEXT_PUBLIC_INSTANCE_NAME=Factory 1

SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

- `INSTANCE_NAME` is read on the server and is **the** filter applied to every
  Supabase query. Setting it correctly is what makes Factory 1 invisible to
  Factory 2 and vice versa.
- `NEXT_PUBLIC_INSTANCE_NAME` is only used for the header label and document
  title.
- The `NEXT_PUBLIC_SUPABASE_*` pair is provided per the project spec but is not
  required for current functionality — all Supabase calls happen on the server
  using the non-prefixed vars.

`.env.local` (see `.env.example`) is used for local development. In Vercel,
set the same variables in the project's Environment Variables UI for each
Environment (Production, Preview, Development).

## 3. How instance isolation works

Every Supabase query in `lib/inventory-store.ts` is chained with:

```ts
.eq("instance_name", getInstanceName())   // process.env.INSTANCE_NAME
```

That applies to:

- `listProducts()` — `GET /api/inventory`
- `getProduct(id)` — `GET /api/inventory/:id`
- `productCount()` — `GET /api/status`
- The read-validate-write cycle inside `reserve` / `release` / `restock`

A row with a different `instance_name` is invisible — even by primary key —
to a deployment running with a different `INSTANCE_NAME`. The
`(instance_name, sku)` unique constraint also lets the same SKU exist
independently in every instance.

## 4. How live status & auto-refresh work

The dashboard runs two intervals:

- A **5 s polling interval** that re-fetches `/api/inventory`. After a
  successful mutation (Reserve / Release / Restock) it also fires an immediate
  out-of-band fetch so the table reflects the change instantly.
- A **1 s ticker** that updates a `now` value, used solely to evaluate
  staleness without waiting for the next poll.

The header chip in the top right shows one of four states:

| State          | When                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| `Connecting`   | Initial load, before the first successful fetch                        |
| `Live`         | Most recent fetch succeeded and was less than 15 s ago                 |
| `Reconnecting` | Most recent fetch failed but we had a recent success                   |
| `Stale`        | No successful fetch in more than 15 s                                  |

The header also shows **Last refreshed: HH:MM:SS**, updated only on a
successful fetch.

## 5. Mutation feedback

- A toast appears in the top-right after each Reserve / Release / Restock —
  green on success, red on failure — auto-dismissing after ~3 s.
- The bottom panel **Recent Activity** logs every attempt (success or
  failure) with timestamp, action, product, quantity, and result. The log is
  client-side only and clears on page reload.

## 6. API response shape

All errors:

```json
{ "success": false, "error": "..." }
```

All mutation successes (`POST .../reserve|release|restock`):

```json
{ "success": true, "product": { "id": "...", "sku": "...", "available": 42, "status": "OK", ... } }
```

Read endpoints (`GET /api/inventory`, `GET /api/inventory/:id`,
`GET /api/status`) return their raw payload on success and the wrapped error
shape above on failure.

## 7. How to deploy this app to Vercel

1. Push `app-1-product-inventory/` to GitHub (or another git remote).
2. In the Vercel dashboard → **Add New… → Project**. If the repo holds multiple
   apps, set **Root Directory** to `app-1-product-inventory`. The Next.js
   preset is auto-detected.
3. Create **one Vercel project per instance** — same repo and root directory,
   different project names and env vars. Each gets its own
   `*.vercel.app` URL.
4. In each project's Settings → Environment Variables, add the variables for
   **Production**, **Preview**, and **Development**:

   | Key                              | Value (example for Factory 1)            |
   | -------------------------------- | ---------------------------------------- |
   | `INSTANCE_NAME`                  | `Factory 1`                              |
   | `NEXT_PUBLIC_INSTANCE_NAME`      | `Factory 1`                              |
   | `SUPABASE_URL`                   | `https://YOUR-PROJECT-REF.supabase.co`   |
   | `SUPABASE_ANON_KEY`              | `eyJhbGciOi...` (anon key from Supabase) |
   | `NEXT_PUBLIC_SUPABASE_URL`       | Same as `SUPABASE_URL`                   |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Same as `SUPABASE_ANON_KEY`              |

   For Factory 2 etc., reuse all Supabase values; only swap the two instance
   variables.

5. Deploy. Vercel handles the port — there is nothing port-related in
   `package.json` (`dev`, `build`, `start`, `lint` are vanilla Next scripts).

Optional CLI flow:

```bash
npm i -g vercel
vercel link
vercel env add INSTANCE_NAME production           # type "Factory 1"
vercel env add NEXT_PUBLIC_INSTANCE_NAME production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel deploy --prod
```

## 8. Local dev

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` must contain valid Supabase values pointing at the same project
where you ran `schema.sql` and `seed.sql`. To preview a different instance
locally, change `INSTANCE_NAME` and `NEXT_PUBLIC_INSTANCE_NAME` in
`.env.local` and restart the dev server.

## 9. curl examples

Use a real product id from `GET /api/inventory`. UUIDs are stable across
re-runs of `seed.sql` because the seed is an upsert.

```bash
BASE=http://localhost:3000

# 200 — list all products visible to this instance
curl $BASE/api/inventory

# 200 — fetch one product
curl $BASE/api/inventory/<uuid>

# 200 — reserve 5 units  → { "success": true, "product": { ... } }
curl -X POST $BASE/api/inventory/<uuid>/reserve \
  -H "Content-Type: application/json" \
  -d '{"quantity":5}'

# 200 — release 2 units
curl -X POST $BASE/api/inventory/<uuid>/release \
  -H "Content-Type: application/json" \
  -d '{"quantity":2}'

# 200 — restock 10 units
curl -X POST $BASE/api/inventory/<uuid>/restock \
  -H "Content-Type: application/json" \
  -d '{"quantity":10}'

# 200 — status / health
curl $BASE/api/status

# 404 — unknown id (uuid-shaped but absent for this instance)
curl $BASE/api/inventory/00000000-0000-0000-0000-000000000000
# → { "success": false, "error": "Product not found" }

# 400 — invalid quantity (zero)
curl -X POST $BASE/api/inventory/<uuid>/reserve \
  -H "Content-Type: application/json" -d '{"quantity":0}'
# → { "success": false, "error": "Invalid quantity. Must be a positive integer." }

# 400 — non-JSON body
curl -X POST $BASE/api/inventory/<uuid>/reserve \
  -H "Content-Type: application/json" -d 'not-json'
# → { "success": false, "error": "Invalid JSON body" }

# 409 — reserve more than on-hand (try the wiring harness for Factory 1, which
#       has on_hand = 0 in the seed)
curl -X POST $BASE/api/inventory/<wiring-harness-uuid>/reserve \
  -H "Content-Type: application/json" -d '{"quantity":1}'
# → { "success": false, "error": "Cannot reserve more than on-hand quantity." }

# 409 — release more than reserved
curl -X POST $BASE/api/inventory/<wiring-harness-uuid>/release \
  -H "Content-Type: application/json" -d '{"quantity":50}'
# → { "success": false, "error": "Cannot release more than currently reserved." }
```

PowerShell users: swap the single-quoted JSON bodies for `"{\"quantity\":5}"`
and the trailing `\` line continuations for backtick `` ` ``.

## 10. Verifying in the browser

1. Apply `supabase/schema.sql` and `supabase/seed.sql`.
2. Set `.env.local` and run `npm run dev`.
3. Open <http://localhost:3000>. You should see:
   - Header reads `Factory 1 — Product Inventory`
   - "Current Instance: Factory 1" chip
   - Green **Live** chip, "Last refreshed" timestamp updating roughly every 5 s
   - Four stat cards summing the seeded data for Factory 1
   - 10 rows in the inventory table, with the wiring harness row showing
     OUT OF STOCK
4. Click **Reserve** on any in-stock row → enter a number → submit. The toast
   should appear, the row should refresh immediately with the new Reserved
   value, and a new entry should land at the top of **Recent Activity**.
5. Click **Reserve** on the wiring harness with quantity 1 → the toast and the
   modal should both surface "Cannot reserve more than on-hand quantity."
   and the activity feed should log it as **failure**.
6. Stop the dev server. Within 5 s the chip should flip to
   **Reconnecting**; after another ~10 s it should flip to **Stale**. Restart
   the dev server and it should return to **Live** on the next poll.
7. Change `INSTANCE_NAME` and `NEXT_PUBLIC_INSTANCE_NAME` in `.env.local` to
   `Warehouse 1`, restart, and confirm the page now shows Warehouse 1's
   inventory and that the Factory 1 changes you just made are not visible.
