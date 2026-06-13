
-- Enum: add Rescheduled (must commit before use in policy)
ALTER TYPE parcel_status ADD VALUE IF NOT EXISTS 'Rescheduled';

-- Bag/COD enums
DO $$ BEGIN
  CREATE TYPE bag_status AS ENUM ('open','sealed','in_transit','arrived');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE cod_status AS ENUM ('pending','remitted','confirmed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- sites
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- bags
CREATE TABLE IF NOT EXISTS public.bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_number text NOT NULL UNIQUE,
  site_origin uuid REFERENCES public.sites(id),
  site_destination uuid REFERENCES public.sites(id),
  status bag_status NOT NULL DEFAULT 'open',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bags ENABLE ROW LEVEL SECURITY;

-- parcels additions
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS bag_id uuid REFERENCES public.bags(id),
  ADD COLUMN IF NOT EXISTS site_origin uuid REFERENCES public.sites(id),
  ADD COLUMN IF NOT EXISTS site_destination uuid REFERENCES public.sites(id),
  ADD COLUMN IF NOT EXISTS submitted_by_rider boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- parcel_status_logs additions
ALTER TABLE public.parcel_status_logs
  ADD COLUMN IF NOT EXISTS old_status parcel_status,
  ADD COLUMN IF NOT EXISTS new_status parcel_status,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS site_from uuid,
  ADD COLUMN IF NOT EXISTS site_to uuid,
  ADD COLUMN IF NOT EXISTS task_order text,
  ADD COLUMN IF NOT EXISTS exception_type text,
  ADD COLUMN IF NOT EXISTS cod_amount numeric;

-- cod_reconciliation
CREATE TABLE IF NOT EXISTS public.cod_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL,
  amount_collected numeric NOT NULL DEFAULT 0,
  amount_remitted numeric,
  status cod_status NOT NULL DEFAULT 'pending',
  remitted_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cod_reconciliation ENABLE ROW LEVEL SECURITY;

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  performed_by uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  timestamp timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings(key,value) VALUES ('whatsapp_admin_number','+254769473510')
  ON CONFLICT (key) DO NOTHING;

-- Seed default sites
INSERT INTO public.sites(name, location) VALUES
  ('Nairobi HQ','Nairobi'),
  ('Mombasa CBD','Mombasa'),
  ('Malindi Branch','Malindi')
ON CONFLICT DO NOTHING;
