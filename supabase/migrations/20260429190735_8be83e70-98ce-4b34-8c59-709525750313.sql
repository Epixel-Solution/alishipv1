-- Add staff_code and phone to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Per-role sequence via a single counter table
CREATE TABLE IF NOT EXISTS public.staff_code_counters (
  role app_role PRIMARY KEY,
  next_value integer NOT NULL DEFAULT 1
);
INSERT INTO public.staff_code_counters(role, next_value) VALUES
  ('super_admin', 1), ('office', 1), ('rider', 1)
ON CONFLICT (role) DO NOTHING;

ALTER TABLE public.staff_code_counters ENABLE ROW LEVEL SECURITY;
-- No policies = locked down to service role only.

-- Function: allocate next code for a role
CREATE OR REPLACE FUNCTION public.next_staff_code(_role app_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
  v_prefix text;
BEGIN
  UPDATE public.staff_code_counters
    SET next_value = next_value + 1
    WHERE role = _role
    RETURNING next_value - 1 INTO v_n;
  IF v_n IS NULL THEN
    INSERT INTO public.staff_code_counters(role, next_value) VALUES (_role, 2) RETURNING next_value - 1 INTO v_n;
  END IF;
  v_prefix := CASE _role
    WHEN 'super_admin' THEN 'ALS-SA-'
    WHEN 'office' THEN 'ALS-AD-'
    WHEN 'rider' THEN 'ALS-RD-'
  END;
  RETURN v_prefix || lpad(v_n::text, 4, '0');
END;
$$;