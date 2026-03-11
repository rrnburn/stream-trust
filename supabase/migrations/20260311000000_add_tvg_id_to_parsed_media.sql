
-- Add tvg_id column to parsed_media for EPG matching
ALTER TABLE public.parsed_media ADD COLUMN tvg_id text;

-- Index for efficient EPG lookups
CREATE INDEX idx_parsed_media_tvg_id ON public.parsed_media(tvg_id);
