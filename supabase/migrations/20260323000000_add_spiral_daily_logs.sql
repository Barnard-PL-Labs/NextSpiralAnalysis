-- Create spiral_daily_logs table to track daily spiral counts
CREATE TABLE IF NOT EXISTS public.spiral_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date DATE NOT NULL,
    spiral_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(log_date)
);

ALTER TABLE public.spiral_daily_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.spiral_daily_logs TO anon;
GRANT ALL ON TABLE public.spiral_daily_logs TO authenticated;
GRANT ALL ON TABLE public.spiral_daily_logs TO service_role;
