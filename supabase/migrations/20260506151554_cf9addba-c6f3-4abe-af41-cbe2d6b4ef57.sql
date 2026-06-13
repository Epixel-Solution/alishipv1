
CREATE OR REPLACE FUNCTION public.prevent_invalid_parcel_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  allowed boolean := false;
BEGIN
  IF new.status = old.status THEN
    -- Allow non-status updates (notes, photos, etc.); only guard real status changes
    RETURN new;
  END IF;

  -- Super admins can override any transition
  is_admin := COALESCE(public.has_role(auth.uid(), 'super_admin'::app_role), false);
  IF is_admin THEN
    RETURN new;
  END IF;

  -- Terminal statuses cannot be changed
  IF old.status IN ('Delivered'::parcel_status, 'Return Delivered'::parcel_status, 'Returned'::parcel_status) THEN
    RAISE EXCEPTION 'Parcel is already % — cannot change status. Contact an admin.', old.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Allowed transition map
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
    WHEN 'Exception'            THEN new.status IN ('Out for Delivery','Rescheduled','Returned','On Hold','Picked Up')
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_invalid_parcel_status ON public.parcels;
CREATE TRIGGER trg_prevent_invalid_parcel_status
  BEFORE UPDATE OF status ON public.parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invalid_parcel_status();
