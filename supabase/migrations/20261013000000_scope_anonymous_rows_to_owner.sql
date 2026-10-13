-- Scope anonymous rows to their owner.
--
-- Background
-- ----------
-- Anonymous visitors' rows were written with user_id = NULL, so RLS had no
-- owner to key on. The policies compensated with `OR is_anonymous = true`,
-- which grants every caller -- including the public `anon` API key that ships
-- in the JS bundle -- access to every anonymous row:
--
--   SELECT  1068 drawings / 1001 api_results readable by anyone, including
--           30 rows carrying a real name, age and sex
--   UPDATE  any anonymous drawing modifiable by anyone
--   DELETE  `USING (user_id IS NULL)` let anyone delete every such row
--
-- The application now signs visitors in as Supabase anonymous users before
-- writing, so every row has a real owner in auth.users and ordinary
-- owner-scoped policies are sufficient. Deploy that change BEFORE applying
-- this migration: the tightened INSERT check requires user_id = auth.uid(),
-- which older bundles do not send.
--
-- Pre-existing rows keep user_id = NULL and so become readable only by
-- superusers. That is intended -- those sessions cannot be returned to anyway,
-- since their session_id lived in browser storage that has long since expired.

-- SELECT -------------------------------------------------------------------
-- "Allow superuser or owner read access" already covers owner + superuser, so
-- these duplicates only ever contributed the `is_anonymous` escape hatch.
DROP POLICY IF EXISTS "Users can view their own drawings"    ON public.drawings;
DROP POLICY IF EXISTS "Users can view their own api_results" ON public.api_results;

-- UPDATE -------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow user to update drawings" ON public.drawings;
CREATE POLICY "Allow user to update drawings"
  ON public.drawings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE -------------------------------------------------------------------
-- Ownerless rows no longer exist going forward, and the legacy ones must not
-- be deletable by strangers. The owner policy below is the only one needed.
DROP POLICY IF EXISTS "Anonymous users delete own session drawings" ON public.drawings;

DROP POLICY IF EXISTS "Authenticated users delete own drawings" ON public.drawings;
CREATE POLICY "Authenticated users delete own drawings"
  ON public.drawings FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT -------------------------------------------------------------------
-- Drop the ownerless branch so nothing can create an unowned row again.
DROP POLICY IF EXISTS "Allow user to insert drawings" ON public.drawings;
CREATE POLICY "Allow user to insert drawings"
  ON public.drawings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user to insert api_results" ON public.api_results;
CREATE POLICY "Allow user to insert api_results"
  ON public.api_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);
