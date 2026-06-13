
-- Lock search_path on all our functions
alter function public.handle_new_user() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.log_parcel_status_change() set search_path = public;

-- Restrict execution: revoke from anon, allow only authenticated (where appropriate)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.log_parcel_status_change() from public, anon, authenticated;
