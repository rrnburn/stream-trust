
-- Table to persist parsed media items per user per source
CREATE TABLE public.parsed_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES public.iptv_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  poster TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'channel',
  genre TEXT NOT NULL DEFAULT 'Uncategorized',
  description TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT '',
  group_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parsed_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parsed media"
  ON public.parsed_media FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parsed media"
  ON public.parsed_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parsed media"
  ON public.parsed_media FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups by source
CREATE INDEX idx_parsed_media_source ON public.parsed_media(source_id);
CREATE INDEX idx_parsed_media_user ON public.parsed_media(user_id);
CREATE INDEX idx_parsed_media_category ON public.parsed_media(category);
