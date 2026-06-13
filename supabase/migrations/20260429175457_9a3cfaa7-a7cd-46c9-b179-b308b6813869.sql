
-- =========================================
-- ENUMS
-- =========================================
create type public.app_role as enum ('super_admin', 'office', 'rider');

create type public.parcel_status as enum (
  'Created',
  'Picked Up',
  'Departed',
  'Arrived',
  'Ready for Collection',
  'Out for Delivery',
  'Delivered',
  'Return Delivered',
  'On Hold',
  'Vehicle Sealed',
  'Unsealed',
  'Exception',
  'Returned',
  'Payment Collected'
);

create type public.payment_type as enum ('cod', 'prepaid');

-- =========================================
-- PROFILES
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- =========================================
-- USER_ROLES
-- =========================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer role check (avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role
    when 'super_admin' then 1
    when 'office' then 2
    when 'rider' then 3
  end
  limit 1;
$$;

-- =========================================
-- PARCELS
-- =========================================
create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  qr_code_data text not null,
  sender_name text not null,
  sender_phone text not null,
  sender_location text not null,
  receiver_name text not null,
  receiver_phone text not null,
  receiver_location text not null,
  description text not null default '',
  weight numeric(10,2) not null default 0,
  quantity integer not null default 1,
  payment_type public.payment_type not null default 'cod',
  amount numeric(12,2) not null default 0,
  status public.parcel_status not null default 'Created',
  notes text,
  assigned_rider_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parcels enable row level security;

create index parcels_status_idx on public.parcels(status);
create index parcels_assigned_rider_idx on public.parcels(assigned_rider_id);
create index parcels_created_at_idx on public.parcels(created_at desc);

-- =========================================
-- PARCEL STATUS LOGS
-- =========================================
create table public.parcel_status_logs (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.parcels(id) on delete cascade,
  status public.parcel_status not null,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.parcel_status_logs enable row level security;

create index logs_parcel_idx on public.parcel_status_logs(parcel_id, created_at desc);

-- =========================================
-- TRIGGERS
-- =========================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Auto updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger parcels_touch before update on public.parcels
for each row execute function public.touch_updated_at();

-- Log parcel status changes
create or replace function public.log_parcel_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.parcel_status_logs(parcel_id, status, updated_by, notes)
    values (new.id, new.status, new.created_by, 'Created');
    return new;
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.parcel_status_logs(parcel_id, status, updated_by, notes)
    values (new.id, new.status, auth.uid(), new.notes);
    return new;
  end if;
  return new;
end;
$$;

create trigger parcels_log_status
after insert or update of status on public.parcels
for each row execute function public.log_parcel_status_change();

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Office and admins can view all profiles"
  on public.profiles for select
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'office'));

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Super admins can update any profile"
  on public.profiles for update
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins can insert profiles"
  on public.profiles for insert
  with check (public.has_role(auth.uid(), 'super_admin'));

-- user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Super admins can view all roles"
  on public.user_roles for select
  using (public.has_role(auth.uid(), 'super_admin'));

create policy "Super admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- parcels
create policy "Office and admins can view all parcels"
  on public.parcels for select
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'office'));

create policy "Riders can view their assigned parcels"
  on public.parcels for select
  using (
    public.has_role(auth.uid(), 'rider')
    and (assigned_rider_id = auth.uid() or assigned_rider_id is null)
  );

create policy "Office and admins can insert parcels"
  on public.parcels for insert
  with check (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'office'));

create policy "Office and admins can update parcels"
  on public.parcels for update
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'office'));

create policy "Riders can update their parcels"
  on public.parcels for update
  using (
    public.has_role(auth.uid(), 'rider')
    and (assigned_rider_id = auth.uid() or assigned_rider_id is null)
  );

create policy "Super admins can delete parcels"
  on public.parcels for delete
  using (public.has_role(auth.uid(), 'super_admin'));

-- parcel_status_logs
create policy "View logs for accessible parcels"
  on public.parcel_status_logs for select
  using (
    public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'office')
    or exists (
      select 1 from public.parcels p
      where p.id = parcel_id and p.assigned_rider_id = auth.uid()
    )
  );

create policy "Authenticated can insert logs"
  on public.parcel_status_logs for insert
  with check (auth.uid() is not null);
