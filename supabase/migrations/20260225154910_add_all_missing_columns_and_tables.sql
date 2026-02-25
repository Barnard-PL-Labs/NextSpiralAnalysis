-- drawings: add missing columns
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS user_age INTEGER;
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS user_sex TEXT;

-- api_results: add missing columns
ALTER TABLE public.api_results ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.api_results ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE public.api_results ADD COLUMN IF NOT EXISTS status TEXT;

-- feedback: create missing table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    usability_rating INTEGER,
    analysis_accuracy_rating INTEGER,
    performance_speed_rating INTEGER,
    visual_design_rating INTEGER,
    suggestion_text TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user to insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own feedback"
ON public.feedback FOR SELECT
USING (auth.uid() = user_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
