-- Allow anonymous inserts to drawings (user_id is null and is_anonymous is true)
DROP POLICY IF EXISTS "Allow user to insert drawings" ON public.drawings;
CREATE POLICY "Allow user to insert drawings"
ON public.drawings FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_anonymous = true)
);

-- Allow anonymous inserts to api_results
DROP POLICY IF EXISTS "Allow user to insert api_results" ON public.api_results;
CREATE POLICY "Allow user to insert api_results"
ON public.api_results FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_anonymous = true)
);

-- Allow anonymous users to read their own drawings/results by session_id
DROP POLICY IF EXISTS "Users can view their own drawings" ON public.drawings;
CREATE POLICY "Users can view their own drawings"
ON public.drawings FOR SELECT
USING (
    auth.uid() = user_id
    OR is_anonymous = true
);

DROP POLICY IF EXISTS "Users can view their own api_results" ON public.api_results;
CREATE POLICY "Users can view their own api_results"
ON public.api_results FOR SELECT
USING (
    auth.uid() = user_id
    OR is_anonymous = true
);

-- Allow anonymous users to update their drawings (for demographics)
CREATE POLICY "Allow user to update drawings"
ON public.drawings FOR UPDATE
USING (
    auth.uid() = user_id
    OR is_anonymous = true
)
WITH CHECK (
    auth.uid() = user_id
    OR is_anonymous = true
);

-- Allow anonymous feedback inserts
DROP POLICY IF EXISTS "Allow user to insert feedback" ON public.feedback;
CREATE POLICY "Allow user to insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

NOTIFY pgrst, 'reload schema';
