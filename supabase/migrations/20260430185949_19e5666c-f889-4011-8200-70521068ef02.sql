ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS sender_landmark text,
  ADD COLUMN IF NOT EXISTS sender_lat numeric,
  ADD COLUMN IF NOT EXISTS sender_lng numeric,
  ADD COLUMN IF NOT EXISTS sender_map_url text,
  ADD COLUMN IF NOT EXISTS receiver_landmark text,
  ADD COLUMN IF NOT EXISTS receiver_lat numeric,
  ADD COLUMN IF NOT EXISTS receiver_lng numeric,
  ADD COLUMN IF NOT EXISTS receiver_map_url text;