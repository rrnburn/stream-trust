-- Add position + duration columns for resume support
ALTER TABLE public.watch_history
  ADD COLUMN IF NOT EXISTS position_seconds REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds REAL NOT NULL DEFAULT 0;

-- Deduplicate: keep only the most recent row per (user_id, media_id)
DELETE FROM public.watch_history a
USING public.watch_history b
WHERE a.user_id = b.user_id
  AND a.media_id = b.media_id
  AND a.watched_at < b.watched_at;

-- Enforce one row per user per media so we can UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS watch_history_user_media_unique
  ON public.watch_history (user_id, media_id);

-- Allow users to delete their own history (needed for "remove from continue watching" later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='watch_history' AND policyname='Users can delete own history'
  ) THEN
    CREATE POLICY "Users can delete own history"
      ON public.watch_history
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger to bump watched_at on update
CREATE OR REPLACE FUNCTION public.touch_watch_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.watched_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS watch_history_touch ON public.watch_history;
CREATE TRIGGER watch_history_touch
BEFORE UPDATE ON public.watch_history
FOR EACH ROW EXECUTE FUNCTION public.touch_watch_history();