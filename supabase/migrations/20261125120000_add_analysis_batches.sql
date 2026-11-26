-- Batch analysis: run many spirals through a spiral backend (MATLAB today, a
-- Python port later) and keep the results for comparison. Two tables:
--
--   analysis_batches      one row per batch: its name, who sent it, status
--   analysis_batch_items  one row per spiral x backend: what to analyze, the
--                         result, and the bookkeeping the workers need
--
-- How it works (see src/app/api/batch and src/lib/batch):
--   * POST /api/batch writes the rows; nothing is analyzed in that request.
--   * Short-lived workers claim rows with claim_analysis_batch_items(), which
--     uses FOR UPDATE SKIP LOCKED so two workers never take the same row. A
--     claim is a lease: if a worker dies, the row comes back for another.
--   * Before calling the backend, a worker looks for an earlier finished row
--     with the same input_hash, backend and backend_version and reuses its
--     result, so re-running unchanged spirals costs no backend calls.
--
-- Both tables have RLS enabled with no policies: only the service role (used
-- by the API routes, which check for a superuser or the batch API key) can
-- read or write them.

CREATE TABLE IF NOT EXISTS public.analysis_batches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label            text,
  backends         text[] NOT NULL,
  backend_versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  use_cache        boolean NOT NULL DEFAULT true,
  workers          integer NOT NULL DEFAULT 20 CHECK (workers BETWEEN 1 AND 50),
  options          jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_items      integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'completed', 'cancelled')),
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.analysis_batch_items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id        uuid NOT NULL REFERENCES public.analysis_batches(id) ON DELETE CASCADE,
  -- What to analyze, one of:
  --   drawing_id  a stored drawing; the worker loads and preprocesses it
  --   spec        a synthetic spiral recipe (generateSpiral options); the
  --               worker draws it with src/lib/syntheticSpiral.js
  --   draw_data   points sent inline with the request, already preprocessed
  -- No FK on drawing_id: deleting a drawing must not be blocked by, or
  -- silently rewrite, a past batch.
  drawing_id      uuid,
  spec            jsonb,
  draw_data       jsonb,
  ref             text,
  -- The caller's name for the kind of spiral (e.g. "Slow tremor"), so
  -- results can be grouped without the caller's own records.
  label           text,
  backend         text NOT NULL,
  backend_version text NOT NULL,
  -- sha256 of the payload sent to the backend; the key for reusing results.
  input_hash      text,
  css_ppi         real,
  css_ppi_assumed boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'done', 'failed', 'skipped')),
  attempts        integer NOT NULL DEFAULT 0,
  lease_until     timestamptz,
  cache_hit       boolean NOT NULL DEFAULT false,
  result          jsonb,
  error           text,
  duration_ms     integer,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (drawing_id IS NOT NULL OR spec IS NOT NULL OR draw_data IS NOT NULL OR status IN ('failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS analysis_batch_items_batch_status_idx
  ON public.analysis_batch_items (batch_id, status, id);

-- Finding an earlier result for the same input (the cache).
CREATE INDEX IF NOT EXISTS analysis_batch_items_reuse_idx
  ON public.analysis_batch_items (input_hash, backend, backend_version)
  WHERE status = 'done' AND cache_hit = false;

ALTER TABLE public.analysis_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_batch_items ENABLE ROW LEVEL SECURITY;

-- Hand out up to p_limit rows of one batch to the calling worker.
CREATE OR REPLACE FUNCTION public.claim_analysis_batch_items(
  p_batch_id      uuid,
  p_limit         integer,
  p_lease_seconds integer,
  p_max_attempts  integer
)
RETURNS SETOF public.analysis_batch_items
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A row whose lease ran out on its last allowed attempt will never be
  -- claimed again; close it out so the batch can finish.
  UPDATE public.analysis_batch_items
     SET status = 'failed',
         error = coalesce(error, 'Worker stopped before finishing') || ' (gave up after ' || attempts || ' attempts)',
         lease_until = NULL,
         updated_at = now()
   WHERE batch_id = p_batch_id
     AND status = 'running'
     AND lease_until < now()
     AND attempts >= p_max_attempts;

  RETURN QUERY
  UPDATE public.analysis_batch_items AS i
     SET status = 'running',
         attempts = i.attempts + 1,
         lease_until = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   WHERE i.id IN (
     SELECT c.id
       FROM public.analysis_batch_items AS c
      WHERE c.batch_id = p_batch_id
        AND (c.status = 'queued' OR (c.status = 'running' AND c.lease_until < now()))
      ORDER BY c.id
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING i.*;
END;
$$;

-- Per-backend, per-status counts for the progress endpoint.
CREATE OR REPLACE FUNCTION public.analysis_batch_progress(p_batch_id uuid)
RETURNS TABLE (
  backend        text,
  status         text,
  items          bigint,
  cache_hits     bigint,
  live_leases    bigint,
  expired_leases bigint
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT backend,
         status,
         count(*),
         count(*) FILTER (WHERE cache_hit),
         count(*) FILTER (WHERE status = 'running' AND lease_until >= now()),
         count(*) FILTER (WHERE status = 'running' AND lease_until < now())
    FROM public.analysis_batch_items
   WHERE batch_id = p_batch_id
   GROUP BY backend, status;
$$;

REVOKE ALL ON FUNCTION public.claim_analysis_batch_items(uuid, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analysis_batch_progress(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis_batch_items(uuid, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.analysis_batch_progress(uuid) TO service_role;
