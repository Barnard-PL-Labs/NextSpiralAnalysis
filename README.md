## Local Installation

Clone the repository

```
git clone https://github.com/Alcasni/NextSpiralAnalysis.git
cd NextSpiralAnalysis
```

Install dependencies:

```
npm install
```

Set up environment variables by creating a `.env.local` file in the root directory:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Or, to run without a db, just leave these blank or omit `.env.local`.

Then run the development server:

```
npm run dev
```

## Database Setup

We use [Supabase](https://supabase.com) for the database. All setup is done via the Supabase CLI.

### 1. Install & log in to the Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
```

### 2. Link to your Supabase project

```bash
supabase link --project-ref <your-project-ref>
```

You can find your project ref in the Supabase dashboard under Project Settings.

### 3. Push the schema

The full database schema is managed via migrations in `supabase/migrations/`. To apply them to your project:

```bash
supabase db push
```

This creates all tables, RLS policies, and functions automatically. The schema includes:

**Tables:**

- `drawings` — stores spiral drawing data (supports both authenticated and anonymous users)
- `api_results` — stores analysis results linked to drawings
- `feedback` — stores user feedback ratings
- `profiles` — user profile info (username, bio, avatar)
- `app_superusers` — emails of superuser accounts

**Key columns by table:**

`drawings`: id, user_id, email, username, drawing_data (JSONB), session_id, is_anonymous, hand_used, hand_side, user_name, user_age, user_sex, created_at

`api_results`: id, user_id, email, username, drawing_id (FK to drawings), session_id, is_anonymous, status, result_data (JSONB), created_at

`feedback`: id, session_id, user_id, usability_rating, analysis_accuracy_rating, performance_speed_rating, visual_design_rating, suggestion_text, created_at

`profiles`: id (FK to auth.users), username, bio, avatar_path, created_at

`app_superusers`: email (PK)

**RLS policies** allow both authenticated users (`auth.uid() = user_id`) and anonymous users (`is_anonymous = true`) to insert and view drawings/results. Superusers get read access to all drawings and results via the `is_superuser()` function.

### 4. Storage bucket

Create a **private** bucket called `avatars` in the Supabase dashboard (Storage > New Bucket). The storage policy is included in the migrations and restricts users to their own folder (`auth.uid()/filename`).

### 5. Superusers

Superuser access is controlled entirely by the `app_superusers` table:

```sql
INSERT INTO app_superusers (email) VALUES ('admin@example.com');
```

That is the only step — no environment variable, and no redeploy. The same
table backs the `is_superuser()` function used by the RLS policies on
`drawings` and `api_results`, so the UI and the data layer always agree.

> Do **not** add a `NEXT_PUBLIC_` variable holding these addresses. Anything
> with that prefix is inlined into the browser bundle, which is how this list
> was previously published to every visitor. See
> [DEPLOY.md](./DEPLOY.md#superusers).

## Deployment

Hosted on [Vercel](https://vercel.com). **Pushing to `main` deploys to
production automatically** — no CLI step required.

```bash
git push origin main      # builds and goes live in about a minute
```

See **[DEPLOY.md](./DEPLOY.md)** for environment variables, how to force a
rebuild, rollbacks, Supabase auth URL configuration, and the gotchas worth
knowing before you debug a deploy (notably: raw `*.vercel.app` URLs are behind
SSO, and `NEXT_PUBLIC_*` values are frozen at build time).

## Project Structure

- `src/app/{route}/page.jsx` — page components (home page is `src/app/page.jsx`)
- `src/components/` — reusable components (Header, etc.)
- `src/styles/` — page/component-specific CSS (global styles in `src/app/global.css`)
- `supabase/migrations/` — database schema migrations
*
*
