
-- sites policies
CREATE POLICY "Authenticated can view sites" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage sites" ON public.sites FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- bags policies
CREATE POLICY "Office and admins view bags" ON public.bags FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office'));
CREATE POLICY "Office and admins manage bags" ON public.bags FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office'));
CREATE POLICY "Riders view bags with their parcels" ON public.bags FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'rider') AND EXISTS (
    SELECT 1 FROM public.parcels p WHERE p.bag_id = bags.id AND p.assigned_rider_id = auth.uid()
  ));

-- cod_reconciliation policies
CREATE POLICY "Riders view own COD" ON public.cod_reconciliation FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office'));
CREATE POLICY "Insert COD" ON public.cod_reconciliation FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid() OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office'));
CREATE POLICY "Office and admins update COD" ON public.cod_reconciliation FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office') OR rider_id = auth.uid());

-- audit_logs policies
CREATE POLICY "Authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Super admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(),'super_admin'));

-- app_settings policies
CREATE POLICY "Authenticated view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin')) WITH CHECK (has_role(auth.uid(),'super_admin'));

-- Tightened parcel update for riders
DROP POLICY IF EXISTS "Riders can update their parcels" ON public.parcels;
CREATE POLICY "Riders can update their parcels" ON public.parcels FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'rider') AND ((assigned_rider_id = auth.uid()) OR (assigned_rider_id IS NULL)))
  WITH CHECK (has_role(auth.uid(),'rider')
    AND ((assigned_rider_id = auth.uid()) OR (assigned_rider_id IS NULL))
    AND status IN ('Out for Delivery'::parcel_status,'Delivered'::parcel_status,'Return Delivered'::parcel_status,'Exception'::parcel_status,'Rescheduled'::parcel_status,'Picked Up'::parcel_status,'Payment Collected'::parcel_status));

-- Riders can insert pickup waybills (auto-flagged submitted_by_rider)
CREATE POLICY "Riders submit pickup waybills" ON public.parcels FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'rider') AND submitted_by_rider = true AND created_by = auth.uid());

-- Updated parcel status change logger (records old + new)
CREATE OR REPLACE FUNCTION public.log_parcel_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (tg_op = 'INSERT') THEN
    INSERT INTO public.parcel_status_logs(parcel_id, status, new_status, updated_by, notes)
    VALUES (new.id, new.status, new.status, new.created_by, 'Created');
    RETURN new;
  ELSIF (tg_op = 'UPDATE' AND new.status IS DISTINCT FROM old.status) THEN
    INSERT INTO public.parcel_status_logs(parcel_id, status, old_status, new_status, updated_by, notes)
    VALUES (new.id, new.status, old.status, new.status, auth.uid(), new.notes);
    RETURN new;
  END IF;
  RETURN new;
END $$;

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_entity text; v_id uuid;
BEGIN
  v_entity := tg_table_name;
  IF (tg_op = 'INSERT') THEN
    INSERT INTO public.audit_logs(action, entity, entity_id, performed_by, new_value)
    VALUES ('create', v_entity, new.id, auth.uid(), to_jsonb(new));
    RETURN new;
  ELSIF (tg_op = 'UPDATE') THEN
    INSERT INTO public.audit_logs(action, entity, entity_id, performed_by, old_value, new_value)
    VALUES ('update', v_entity, new.id, auth.uid(), to_jsonb(old), to_jsonb(new));
    RETURN new;
  ELSIF (tg_op = 'DELETE') THEN
    INSERT INTO public.audit_logs(action, entity, entity_id, performed_by, old_value)
    VALUES ('delete', v_entity, old.id, auth.uid(), to_jsonb(old));
    RETURN old;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS audit_parcels ON public.parcels;
CREATE TRIGGER audit_parcels AFTER INSERT OR UPDATE OR DELETE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
DROP TRIGGER IF EXISTS audit_bags ON public.bags;
CREATE TRIGGER audit_bags AFTER INSERT OR UPDATE OR DELETE ON public.bags
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();
DROP TRIGGER IF EXISTS audit_sites ON public.sites;
CREATE TRIGGER audit_sites AFTER INSERT OR UPDATE OR DELETE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- touch_updated_at triggers
DROP TRIGGER IF EXISTS touch_sites ON public.sites;
CREATE TRIGGER touch_sites BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_bags ON public.bags;
CREATE TRIGGER touch_bags BEFORE UPDATE ON public.bags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bag number generator (SECURITY INVOKER, no escalated privileges needed)
CREATE OR REPLACE FUNCTION public.generate_bag_number() RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN 'BAG-' || to_char(now(),'YYYYMMDD') || '-' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
END $$;

-- exceptions storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('exceptions','exceptions', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read exceptions" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exceptions' AND (
    has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office')
    OR EXISTS (SELECT 1 FROM public.parcels p WHERE p.id::text = (storage.foldername(name))[1] AND p.assigned_rider_id = auth.uid())
  ));
CREATE POLICY "Upload exceptions" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exceptions');
