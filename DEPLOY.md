# Deployment

How this app gets from a commit to `www.spiralanalysis.com`, and the things
that have tripped people up.

*Verified 2026-09-24.*

## The short version

**Push to `main` → production.** That's it. Vercel's Git integration builds and
promotes automatically, usually in about a minute. There is no GitHub Actions
workflow in this repo; the integration is configured on the Vercel side.

```
git push origin main      # ~7 seconds later a build starts, ~1 min to live
```

You do **not** normally need the Vercel CLI. Reach for it only to change
environment variables or to force a rebuild without a new commit.

## Where things live

| Thing | Value |
|---|---|
| Vercel project | `next-spiral-analysis` |
| Vercel team / scope | `spiral-c2d42225` |
| Project ID | `prj_OxvfgApCHTBnUsdiItHItRJadTRN` |
| Production domain | `www.spiralanalysis.com` |
| DNS | Cloudflare (nameservers `ruben` / `angelina.ns.cloudflare.com`), proxied |
| Supabase project ref | `acpxyuiututudgpxcwey` |

Cloudflare sits in front of Vercel, so responses carry `server: cloudflare`
and a Vercel `x-vercel-id`. Both are normal.

## Gotchas

These each cost real debugging time. Read them before you go hunting.

### Raw `*.vercel.app` URLs are behind Vercel SSO

Hitting a deployment URL directly with `curl` returns a **340 KB Vercel login
page**, not the app — so every content check silently "fails" and it looks like
the deploy didn't ship your code.

**Always verify against `https://www.spiralanalysis.com`**, not the deployment
URL. If you need the deployment URL specifically, see the
`access-protected-vercel-deployment` guidance or disable Deployment Protection.

### `NEXT_PUBLIC_*` variables are baked in at build time

Changing one in Vercel does nothing to the live site until a **new build runs**.
Saving the variable is not enough. Either push a commit or:

```bash
npx vercel@latest redeploy <deployment-id> --scope spiral-c2d42225 --target production
```

Server-side variables are also snapshotted into the deployment, so the same rule
applies to them.

### Anything named `NEXT_PUBLIC_*` is public

It is inlined into the JavaScript served to every visitor. Never put a secret,
an allowlist, or anything you would not print on the homepage behind that
prefix. (This bit us once — see *Superusers* below.)

### The bundled Vercel CLI may be stale

A globally installed v50 in this environment gave wrong deployment listings and
looped forever on `vercel env add <name> preview`. Prefer:

```bash
npx vercel@latest ...        # or: npm i -g vercel@latest
```

### `vercel ls` can mislead

It has shown a two-day-old deployment as the newest while the live site was
serving newer code. Treat the live domain as the source of truth, not the CLI
listing.

## Environment variables

Managed in Vercel under Settings → Environment Variables, across three targets:
Production, Preview, Development. `.env.local` is **gitignored** — editing it
changes nothing in production.

Pull the current values into `.env.local`:

```bash
npx vercel@latest env pull .env.local --environment=production --scope spiral-c2d42225
```

Set one (repeat per target; `--force` overwrites an existing entry):

```bash
npx vercel@latest env add MY_VAR production --value "..." --force --yes --scope spiral-c2d42225
```

Then **redeploy** for it to take effect.

## Superusers

The `app_superusers` table is the **single source of truth**. Nothing else
grants superuser access, and no redeploy is needed to change it.

```sql
INSERT INTO app_superusers (email) VALUES ('someone@example.com');
DELETE FROM app_superusers WHERE email = 'someone@example.com';
```

Addresses are stored lower case; a CHECK constraint enforces it, because
`auth.email()` is lower case.

**How it hangs together:**

- `is_superuser()` — a `SECURITY DEFINER` SQL function that looks the caller up
  in the table. RLS policies on `drawings` and `api_results`
  (`user_id = auth.uid() OR is_superuser()`) call it, so superusers can read
  every row.
- `src/lib/superusers.js` — server-only; reads the same table with the service
  role key. Fails closed on any error.
- `GET /api/superuser-status` — validates the caller's Supabase token and
  returns `{ isSuperuser }` about *that caller only*. Never returns the list.
- `src/lib/useSuperuser.js` — the hook `/admin` and `/dashBoard` use, which just
  calls that route.

**Why the table and not an environment variable.** The list used to live in
`NEXT_PUBLIC_SUPERUSER_EMAILS`, which Next inlined into the JS bundle served to
every visitor, publishing everyone's address. The table has RLS enabled with no
policies, so only the service role and the definer function can read it —
membership never reaches the browser. Do not reintroduce an env-var path.

> Historical note: before 2026-09-24 these were two separate mechanisms that had
> drifted apart, and the table half had never worked. `is_superuser()` was
> `SECURITY INVOKER`, so its own read of `app_superusers` was blocked by that
> table's RLS and the function always returned `false`. Every "superuser or
> owner" policy silently degraded to "owner": the UI offered a "view all"
> toggle that returned nothing extra. Fixed in
> `20260924135535_consolidate_superusers.sql`.

## Database migrations

Migrations live in `supabase/migrations/` and are applied with the Supabase CLI:

```bash
supabase db push
```

**The live schema had drifted.** Several migrations were applied by hand without
being recorded, and `is_superuser()` plus its policies existed in the database
but in no migration file. That was reconciled on 2026-09-24: the function and
policies are now captured in a migration, and
`supabase_migrations.schema_migrations` was backfilled so the recorded history
matches what is actually applied.

If you apply something by hand, record it:

```sql
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('<version>');
```

Otherwise the next `supabase db push` will try to replay it and fail.

## Supabase auth configuration

Separate from Vercel, in the Supabase dashboard under **Auth → URL
Configuration**:

- **Site URL** must be `https://www.spiralanalysis.com`. If it is left at
  `http://localhost:3000`, every confirmation and password-reset email sends
  recipients to their own machine and looks broken. The account is still
  confirmed server-side before the redirect fires, but users reasonably assume
  it failed.
- **Redirect URLs** must include `https://www.spiralanalysis.com/**`. The app
  builds `${NEXT_PUBLIC_SITE_URL}/?confirmed=true` and
  `${NEXT_PUBLIC_SITE_URL}/reset-password`; anything not on the allowlist is
  silently replaced with the Site URL.

**Email delivery:** the project uses Supabase's default shared sender, which has
a low hourly rate limit and no SPF/DKIM alignment with `spiralanalysis.com`.
Every `@cumc.columbia.edu` signup so far has gone unconfirmed while every
consumer-domain signup succeeded, which points at enterprise filtering.
Configuring custom SMTP (Resend or Postmark) on a verified domain would fix it.

## Verifying a deploy

```bash
# 1. Did the change ship? Check a string only the new code contains.
curl -sS "https://www.spiralanalysis.com/instruction?cb=$(date +%s)" | grep -c "COV of Width"

# 2. Did an env-var change get baked in? Grep the served chunk, not the source.
curl -sS "https://www.spiralanalysis.com/admin?cb=$(date +%s)" \
  | grep -oE '/_next/static/chunks/app/admin/page-[a-z0-9]+\.js'
# then curl that chunk and grep it

# 3. Confirm nothing secret leaked into the client bundle.
rm -rf .next && npx next build
grep -r "your-secret-here" .next/static && echo LEAK || echo clean
```

Always append a cache-busting query param. Cloudflare returns
`cf-cache-status: DYNAMIC` for app routes, but stale `age` headers have caused
confusion.

## Rollback

```bash
npx vercel@latest ls --scope spiral-c2d42225                 # find a known-good deployment
npx vercel@latest redeploy <deployment-id> --scope spiral-c2d42225 --target production
```

Or use Instant Rollback in the Vercel dashboard, which is faster and does not
rebuild.
