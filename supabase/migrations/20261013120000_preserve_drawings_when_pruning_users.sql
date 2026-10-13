-- Preserve drawings when an anonymous user is pruned.
--
-- Anonymous visitors now get a real auth.users row, and Supabase does not
-- prune abandoned ones, so they accumulate (~150/month). The obvious cleanup --
-- deleting anonymous users older than N days -- was quietly destructive:
-- drawings.user_id and api_results.user_id referenced auth.users ON DELETE
-- CASCADE, so pruning a user would have taken their research data with it.
--
-- SET NULL instead. A pruned user's rows survive with no owner, which places
-- them in the same superuser-only state as the pre-2026-10-13 rows: still
-- readable for research, not reachable by anyone else. Nothing can create an
-- ownerless row going forward -- the INSERT policies require
-- user_id = auth.uid() -- so NULL now means exactly "owner was pruned".

ALTER TABLE public.drawings
  DROP CONSTRAINT IF EXISTS drawings_user_id_fkey;
ALTER TABLE public.drawings
  ADD CONSTRAINT drawings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.api_results
  DROP CONSTRAINT IF EXISTS api_results_user_id_fkey;
ALTER TABLE public.api_results
  ADD CONSTRAINT api_results_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Prune abandoned anonymous users, keeping their drawings. Returns how many
-- were removed. SECURITY DEFINER because auth.users is not writable by the
-- application roles; restricted to service_role so it cannot be called from a
-- browser.
CREATE OR REPLACE FUNCTION public.prune_anonymous_users(older_than interval DEFAULT '30 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  WITH gone AS (
    DELETE FROM auth.users
    WHERE is_anonymous IS TRUE
      AND created_at < now() - older_than
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM gone;
  RETURN removed;
END;
$$;

ALTER FUNCTION public.prune_anonymous_users(interval) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prune_anonymous_users(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_anonymous_users(interval) TO service_role;
