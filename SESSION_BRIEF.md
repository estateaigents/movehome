# SESSION_BRIEF — MoveHome.org migration & build

**Created:** 2026-05-08
**Author:** Eugin Song + Claude (raia repo session, prior context-switch)
**Purpose:** Hand off the MoveHome.org build to a fresh Claude session running with cwd `/root/projects/movehome`.

---

## TL;DR — what is this project

**MoveHome.org** is the reference open-source RAIA Protocol consumer. Not-for-profit property listing aggregator. Aigent-to-aigent transactions. Operated by **Move Home Organisation CIC** (registered company **17202438**), licensed MIT, separate legal entity from EstateAigents.com Ltd.

**It does NOT host primary listings** — it federates from RAIA Protocol agents (the same ones registered in the raia-public mirror's `tbl_raia_agent_registry`) and presents a clean public-facing search UI for consumers (homebuyers, tenants, landlords searching for an agent).

Think of it as the consumer side of the RAIA Protocol:
- **Producer side** = EstateAigents (raia-public DB) — agents publish listings via `/.well-known/raia-agent.json`
- **Consumer side** = MoveHome.org (this repo) — crawls + caches + searches across producers

---

## Where things stand right now

### ✅ Phase 0 — Repo reconciliation (DONE)
- Local clone re-pointed: `/root/projects/movehome` origin = `https://github.com/MoveHome/MoveHome.Org.git`
- Old repo `estateaigents/movehome` **archived** on GitHub (read-only, preserved for history)
- All commits up to `9903ed5` are on the canonical repo

### ✅ Phase 1 — Vercel build (DONE)
- Was failing on `npm install` ERESOLVE — next@15.0.0 wanted react@^18.2.0 but project had react@19.0.0
- Fixed by bumping `next` and `eslint-config-next` to `^15.5.18` (commit `9903ed5`)
- Local `npm run build` succeeds; Vercel should auto-redeploy on the push
- **Verify:** check https://vercel.com/move-home/move-home-org for green deployment

### ✅ Phase 2 — Supabase provisioned via Vercel Marketplace (DONE 2026-05-08)

**New project:**
- **Ref:** `vfnpmtqxrffppqajxxpb`
- **URL:** `https://vfnpmtqxrffppqajxxpb.supabase.co`
- **Org:** `MoveHome` (slug `vercel_icfg_HM1AzIKzSa3aihb2y7BvK5uy`)
- **Region:** eu-west-2 (London)
- **Compute:** t4g.nano, Free plan
- **Postgres:** 17.6.1.121
- **Status:** ACTIVE_HEALTHY

Env vars auto-injected by Vercel into MoveHome project (Production + Preview + Development): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_PASSWORD`. Pull locally with `vercel env pull .env.local`.

**Reachable via Supabase MCP:** all `mcp__supabase__*` tools accept `project_id="vfnpmtqxrffppqajxxpb"`. Schema is empty (no migrations, no backups, no GitHub repo connected at the Supabase level — that's fine).

### ⏸ Phase 2 — Provision Supabase via Vercel Marketplace (HISTORICAL INSTRUCTIONS, KEPT FOR REFERENCE)

**Why via Vercel and not directly in Supabase:**
We tried provisioning under Geneieux org directly on supabase.com once — that's how `raia-public` was created. For MoveHome we want the **Vercel Marketplace integration** so:
- Supabase org auto-created under MoveHome Vercel team
- DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY auto-injected as Vercel env vars
- Billing flows through Vercel
- Same pattern as `db_raia` (raia main project) → consistency across the platform

**Steps the user takes in Vercel dashboard:**
1. Go to **MoveHome team** → **Storage** tab → **Create Database** → **Supabase**
2. Region: `eu-west-2` (matches db_raia + raia-public for cross-project query latency)
3. Name suggestion: `db_movehome` or `movehome-prod`
4. After creation, env vars auto-appear in Vercel project → confirm visible in **Settings → Environment Variables**

**Once provisioned, ask the user for the project ref** (the `xxxxxxx.supabase.co` subdomain) so the next session can target it via Supabase MCP.

### 📋 Phase 3 — Schema design + apply (PENDING — start here in fresh session)

**Project ref to target:** `vfnpmtqxrffppqajxxpb` (use as `project_id` argument to `mcp__supabase__*` tools)

#### Decision already made: mirror raia-public + add MoveHome extensions

The starting schema **borrows from the raia repo's** `03_technology/database/ddl/raia-public/` (4 SQL files, ~340 lines):
- `01_tbl_listings.sql` — canonical listings (jurisdiction-neutral)
- `02_tbl_listings_uk.sql` — UK extensions (council tax band, EPC, leasehold)
- `03_tbl_listings_th.sql` — Thailand extensions
- `04_tbl_listings_portals.sql` — portal channel publishing log

Plus from `03_technology/database/ddl/live-supabase/V180/` and `V181/`:
- `tbl_raia_agent_registry` — registered RAIA agents (federated trust ladder)
- `tbl_external_raia_listings` — federated listings cached from agents
- `vw_raia_agent_registry_public` — public view of agents
- `vw_external_listings_combined` — union of scraped + federated

#### MoveHome-specific tables to add on top

These are NEW for MoveHome (not in raia-public):

```sql
-- tbl_users — registered MoveHome users (savers, alert subscribers)
-- Uses Supabase Auth. Stores preferences, saved searches.

-- tbl_saved_searches — user-defined search filters with email alerts
--   user_id FK, name, filters JSONB, alert_frequency, last_run_at

-- tbl_enquiries — leads created on movehome.org, routed back to source agent
--   enquiry_id, raia_id (target listing), user_id, source_agent_id (FK tbl_raia_agent_registry),
--   message, created_at, forwarded_at, status ENUM('new','forwarded','responded','closed')

-- tbl_listing_views — analytics: how often each listing is viewed
--   listing_id, viewed_at, anon_session_id, user_id (nullable)

-- tbl_agent_clicks — outbound clicks to agent profiles
--   agent_id, clicked_at, source_listing_id, anon_session_id, user_id

-- tbl_alerts_sent — log of alert emails sent to users
--   alert_id, saved_search_id, sent_at, listing_count, opened, clicked
```

#### How to organise migrations

Two choices for the migration directory layout:

| Option A: matched to raia | Option B: clean cleanroom |
|---|---|
| `database/ddl/live-supabase/V001/`, `V002/`, ... | `supabase/migrations/0001_initial.sql`, ... |
| Use `migrate.sh` cribbed from raia | Use Supabase CLI native flow |
| Familiar to anyone working on raia | Native Supabase tooling, smaller commits |

**Recommendation: Option B** for a fresh project. The raia migrate.sh exists because it predates Supabase CLI maturity. MoveHome should use `supabase db push` natively. **Confirm with Eugin before committing to this** — if he wants migration parity for cross-project tooling, choose Option A.

#### Apply order
1. Copy raia-public schema files into MoveHome's migration dir (rename to MoveHome conventions)
2. Add the MoveHome-specific tables (users, enquiries, etc.)
3. Apply via Supabase MCP `mcp__supabase__apply_migration` to the new project ref
4. Verify with MCP `list_tables` + `get_advisors`

### 🏗️ Phase 4 — App build (PENDING — main session work)

#### What's already scaffolded in `src/`

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # homepage (8-bit blue door brand)
│   ├── globals.css
│   ├── about/page.tsx
│   ├── api/health/route.ts         # liveness probe
│   ├── property/[raia_id]/page.tsx # property detail
│   └── search/                     # empty? check
├── components/
└── lib/
```

#### What needs building

1. **Search page** (`src/app/search/page.tsx`) — query params → SQL filter on `tbl_external_raia_listings`, render results
2. **Property detail** (`src/app/property/[raia_id]/page.tsx`) — fetch single listing by raia_id, show full snapshot, agent contact card with enquiry CTA
3. **Federated crawler** — scheduled job that calls each registered RAIA agent's `/.well-known/raia-agent.json` and `/api/raia/search`, caches into `tbl_external_raia_listings`. **Reference implementation already exists** — see raia repo's `feat/raia-protocol-crawler` branch (PR #188, file `03_technology/programs/raia-protocol-crawl.cjs` + `lib/raia-protocol-listing-mapper.cjs`). Copy + adapt.
4. **Enquiry flow** — POST `/api/enquire` → insert `tbl_enquiries` → forward to agent's `/api/raia/enquire` endpoint
5. **Auth** — Supabase Auth wired into a `lib/supabase-server.ts` + `lib/supabase-browser.ts` pattern (mirror raia's `frontend/src/lib/supabase-*.ts`)
6. **Saved searches + alerts** — cron-driven email job (Resend? Or borrow Vercel Cron)
7. **Brand polish** — door animation, typography, the 8-bit aesthetic is already partly there

---

## Constraints + ground rules

1. **No PII / no proprietary data.** This is OSS. Anything pulled from RAIA agents that contains PII must stay on the agent's side (per RAIA Protocol delegation tokens). MoveHome only stores public listing data + its own user accounts.
2. **OSS-friendly stack.** Next.js, Supabase, MIT licence everywhere. Don't add proprietary dependencies (no Cloudinary, no Sentry, etc.) unless they have a free tier MoveHome can stay on indefinitely.
3. **Match the raia codebase patterns** where they apply: `tbl_*` table naming, `current_org_id()`-style RLS (or its MoveHome equivalent), `createSupabaseAdmin()` vs `createSupabaseServer()` split.
4. **No `tbl_organisations` / multi-tenancy on day 1.** MoveHome is a single-tenant SaaS-style consumer app. No organisations, no per-tenant RLS — just user-scoped where it matters (saved searches, enquiries).
5. **Commit author:** `MoveHome.org <admin@movehome.org>` (already set in package.json).
6. **Push directly to main** during development per Eugin's standing preference (no feature branches for solo work).

---

## Files to read first in a fresh session

In `/root/projects/movehome` (this repo):
1. `package.json` — confirm next 15.5.18, dep tree
2. `src/app/page.tsx` — current homepage
3. `next.config.js`, `tailwind.config.ts`, `vercel.json` — build config
4. `.env.local.example` — env var conventions

In `/root/projects/raia` (cross-reference for schema + crawler):
1. `03_technology/database/ddl/raia-public/*.sql` — schema starting point
2. `03_technology/database/ddl/live-supabase/V180/` and `V181/` (on branch `feat/listings-architecture-v166-v181`) — agent registry + federated listings tables. Note V166-V181 may be merged to main by the time you read this — check `git log main --oneline | head -20`.
3. `03_technology/programs/raia-protocol-crawl.cjs` (on branch `feat/raia-protocol-crawler`, PR #188) — federated crawler reference impl
4. `03_technology/programs/lib/raia-protocol-listing-mapper.cjs` (same branch) — schema → row mapper
5. `03_technology/architecture/decisions/ADR-211-*.md` — RAIA Protocol design

---

## Open decisions for the fresh session

1. **Migration tooling:** Supabase CLI (Option B) vs raia-style `migrate.sh` (Option A) — recommend B, confirm with Eugin
2. **Crawler hosting:** Vercel Cron, GitHub Actions, or Hostinger VPS? GitHub Actions is the raia repo pattern — recommend that
3. **Email provider for alerts:** Resend (raia uses it) or skip for v1?
4. **Auth providers:** Google + Microsoft (matches raia)? Email-only? Magic-link?
5. **Analytics:** any? PostHog OSS would fit the OSS stance but is heavy

---

## What this session (raia repo) was doing in parallel

The raia repo (`/root/projects/raia`) is mid-cleanup at HEAD `edb5733`. 6 open PRs queued for sequential merge per `docs/WORK_ORDER_2026-05-08.md`:

```
Phase 1: PR #191 feat/listings-architecture-v166-v181  (must merge first)
Phase 2: PR #186 #187 #189 (parallel — snapshot, sync, portal-push)
Phase 3: PR #190 then #188 (sequential — valuation then crawler)
```

When PR #191 lands and migrations apply, the raia-public mirror will have V166-V181 schema. **At that point the MoveHome schema can be lifted directly** from raia-public's live tables (via `mcp__supabase__execute_sql` to dump DDL, or copy from the raia repo files).

---

## First commands to run in the fresh session

```bash
cd /root/projects/movehome
git status                          # confirm clean
git pull                            # pick up any pushes since 9903ed5
npm install                         # 370 packages
npm run build                       # verify still building
npm run dev                         # localhost:3000

# Then read this brief, the raia-public schema files, and start Phase 2
```

---

## Contact

- Eugin Song · `eugin.song@rentlondonflat.com` · GitHub `eugin-song`
- Commit author for this repo: `admin@movehome.org`
- Repo: https://github.com/MoveHome/MoveHome.Org
- Vercel: https://vercel.com/move-home/move-home-org
