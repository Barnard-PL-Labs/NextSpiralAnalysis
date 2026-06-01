-- Issue #21: Add primary key and foreign key constraints to api_results
-- 
-- ON DELETE CASCADE chosen for api_results.drawing_id → drawings.id because:
-- a result row has no meaning without its parent drawing, so deleting a 
-- drawing should automatically clean up its associated result.
--
-- ON DELETE CASCADE chosen for api_results.user_id → auth.users.id because:
-- result data should not persist after a user account is deleted (data privacy).
--
-- Indexes added on drawing_id and session_id as these are the primary lookup
-- columns in the results page query path.
--
-- Note: PK and FK constraints were already present in production schema.
-- Only the indexes below were applied as part of this issue.

CREATE INDEX IF NOT EXISTS api_results_drawing_id_idx ON api_results (drawing_id);
CREATE INDEX IF NOT EXISTS api_results_session_id_idx ON api_results (session_id);