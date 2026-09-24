-- Consolidate superuser identity onto the app_superusers table.
--
-- Background
-- ----------
-- Two parallel mechanisms had drifted apart: a NEXT_PUBLIC_ environment
-- variable compared in the browser (which published every superuser's email
-- address in the JS bundle) and this table, which drives RLS.
--
-- The table path had never actually worked. is_superuser() was SECURITY
-- INVOKER, so its read of app_superusers ran as the calling user -- and
-- app_superusers has RLS enabled with no policies, so that read returned zero
-- rows and the function always returned false. Every "superuser or owner"
-- policy silently degraded to "owner".
--
-- Making the function SECURITY DEFINER fixes the lookup while leaving the
-- table unreadable by clients, so membership never leaves the server. That is
-- the property the environment variable could not provide.
--
-- No email addresses are seeded here on purpose: this file is public, and
-- committing the list would recreate the leak in git history. Rows are
-- inserted out-of-band with the service role key.

-- 1. auth.email() is lower case; keep stored addresses comparable.
UPDATE public.app_superusers SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE public.app_superusers
  DROP CONSTRAINT IF EXISTS app_superusers_email_lowercase;
ALTER TABLE public.app_superusers
  ADD CONSTRAINT app_superusers_email_lowercase CHECK (email = lower(email));

-- 2. RLS stays on with no policies. Only service_role (which bypasses RLS)
--    and the definer function below can read this table.
ALTER TABLE public.app_superusers ENABLE ROW LEVEL SECURITY;

-- 3. SECURITY DEFINER so the lookup is not blocked by step 2. search_path is
--    pinned so the definer context cannot be redirected to another schema.
CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_superusers WHERE email = lower(auth.email())
  );
$$;

ALTER FUNCTION public.is_superuser() OWNER TO postgres;

-- anon must keep EXECUTE: the SELECT policies below call this function, and a
-- policy that cannot execute it would fail the query outright for anonymous
-- visitors rather than simply returning false.
REVOKE ALL ON FUNCTION public.is_superuser() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superuser() TO anon, authenticated, service_role;

-- 4. These policies already existed in the live database but were never
--    captured in a migration. Recreate them idempotently so the repo matches.
DROP POLICY IF EXISTS "Allow superuser or owner read access" ON public.drawings;
CREATE POLICY "Allow superuser or owner read access"
  ON public.drawings FOR SELECT
  USING ((user_id = auth.uid()) OR public.is_superuser());

DROP POLICY IF EXISTS "Allow superuser or owner read access" ON public.api_results;
CREATE POLICY "Allow superuser or owner read access"
  ON public.api_results FOR SELECT
  USING ((user_id = auth.uid()) OR public.is_superuser());
