-- Add Alimall / external order reference columns
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS external_order_ref text;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS external_source text;
CREATE INDEX IF NOT EXISTS parcels_external_order_ref_idx ON public.parcels(external_order_ref);
CREATE INDEX IF NOT EXISTS parcels_external_source_idx ON public.parcels(external_source);

-- Tighten status transition trigger (mirrors src/lib/parcel-status.ts)
CREATE OR REPLACE FUNCTION public.prevent_invalid_parcel_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
  allowed boolean := false;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  is_admin := COALESCE(public.has_role(auth.uid(), 'super_admin'::app_role), false);
  IF is_admin THEN
    RETURN new;
  END IF;

  IF old.status IN ('Delivered'::parcel_status, 'Return Delivered'::parcel_status, 'Returned'::parcel_status) THEN
    RAISE EXCEPTION 'Parcel is already % — cannot change status. Contact an admin.', old.status
      USING ERRCODE = 'check_violation';
  END IF;

  allowed := CASE old.status
    WHEN 'Created'              THEN new.status IN ('Picked Up','On Hold','Exception')
    WHEN 'Picked Up'            THEN new.status IN ('Vehicle Sealed','Departed','On Hold','Exception')
    WHEN 'Vehicle Sealed'       THEN new.status IN ('Departed','Unsealed','Exception')
    WHEN 'Unsealed'             THEN new.status IN ('Vehicle Sealed','Departed','On Hold','Exception')
    WHEN 'Departed'             THEN new.status IN ('Arrived','Exception','On Hold')
    WHEN 'Arrived'              THEN new.status IN ('Ready for Collection','Out for Delivery','On Hold','Exception')
    WHEN 'Ready for Collection' THEN new.status IN ('Out for Delivery','Delivered','Payment Collected','Exception','On Hold')
    WHEN 'Out for Delivery'     THEN new.status IN ('Delivered','Exception','Rescheduled','Payment Collected','On Hold')
    WHEN 'Rescheduled'          THEN new.status IN ('Out for Delivery','Exception','On Hold')
    WHEN 'Exception'             THEN new.status IN ('Out for Delivery','Rescheduled','Returned','On Hold','Picked Up')
    WHEN 'On Hold'              THEN new.status IN ('Picked Up','Departed','Out for Delivery','Exception','Returned','Rescheduled')
    WHEN 'Payment Collected'    THEN new.status IN ('Delivered','Exception')
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid status change: % → %. This step is not allowed in the workflow.', old.status, new.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN new;
END;
$function$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS prevent_invalid_parcel_status_trg ON public.parcels;
CREATE TRIGGER prevent_invalid_parcel_status_trg
BEFORE UPDATE ON public.parcels
FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_parcel_status();