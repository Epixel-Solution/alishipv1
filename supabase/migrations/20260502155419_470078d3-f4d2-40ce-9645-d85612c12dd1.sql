-- Rider shifts: track start/end of working day with location.
CREATE TABLE public.rider_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rider_shifts_rider_started ON public.rider_shifts(rider_id, started_at DESC);

ALTER TABLE public.rider_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders manage own shifts"
ON public.rider_shifts FOR ALL TO authenticated
USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office'))
WITH CHECK (rider_id = auth.uid() OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'office'));

-- Enable realtime on parcels so riders get live assignment notifications.
ALTER PUBLICATION supabase_realtime ADD TABLE public.parcels;