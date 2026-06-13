-- 1. Extend parcels for external waybills + proof of delivery
alter table public.parcels
  add column if not exists is_external boolean not null default false,
  add column if not exists carrier text,
  add column if not exists external_tracking_number text,
  add column if not exists pod_photo_path text,
  add column if not exists pod_signature text,
  add column if not exists delivered_at timestamptz;

create index if not exists parcels_external_tracking_idx
  on public.parcels (external_tracking_number)
  where external_tracking_number is not null;

-- 2. POD storage bucket (private)
insert into storage.buckets (id, name, public)
values ('pod', 'pod', false)
on conflict (id) do nothing;

-- 3. Storage policies for the pod bucket
-- Path convention: {parcel_id}/{filename}

drop policy if exists "Riders upload POD for their parcels" on storage.objects;
create policy "Riders upload POD for their parcels"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pod'
  and exists (
    select 1 from public.parcels p
    where p.id::text = (storage.foldername(name))[1]
      and p.assigned_rider_id = auth.uid()
  )
);

drop policy if exists "Riders read POD for their parcels" on storage.objects;
create policy "Riders read POD for their parcels"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod'
  and exists (
    select 1 from public.parcels p
    where p.id::text = (storage.foldername(name))[1]
      and p.assigned_rider_id = auth.uid()
  )
);

drop policy if exists "Office and admins read all POD" on storage.objects;
create policy "Office and admins read all POD"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pod'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'office'::app_role)
  )
);

drop policy if exists "Office and admins manage POD" on storage.objects;
create policy "Office and admins manage POD"
on storage.objects for all
to authenticated
using (
  bucket_id = 'pod'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'office'::app_role)
  )
)
with check (
  bucket_id = 'pod'
  and (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    or public.has_role(auth.uid(), 'office'::app_role)
  )
);
