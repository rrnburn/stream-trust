
-- Add EPG URL column to iptv_sources
ALTER TABLE public.iptv_sources ADD COLUMN epg_url text;

-- Create EPG programs table
CREATE TABLE public.epg_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES public.iptv_sources(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_epg_programs_user_channel ON public.epg_programs(user_id, channel_id);
CREATE INDEX idx_epg_programs_time ON public.epg_programs(start_time, end_time);

-- Enable RLS
ALTER TABLE public.epg_programs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own EPG data
CREATE POLICY "Users can view their own EPG data"
  ON public.epg_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own EPG data"
  ON public.epg_programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own EPG data"
  ON public.epg_programs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
