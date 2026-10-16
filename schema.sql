-- Run in a NEW Supabase project SQL Editor. Do not run over a production schema.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'viewer' check (role in ('admin','editor','viewer')),
 enabled boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.employees (
 id uuid primary key default gen_random_uuid(),
 employee_no text unique,
 full_name text not null,
 department text not null default '',
 worksite text not null default '',
 position text not null default '',
 hire_date date,
 exit_date date,
 updated_at timestamptz not null default now(),
 constraint valid_dates check (exit_date is null or hire_date is null or exit_date >= hire_date)
);
create table public.certificates (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id) on delete cascade,
 name text not null,
 level text not null default '',
 field text not null default '',
 certificate_no text not null default '',
 acquired_date date,
 expires_date date,
 updated_at timestamptz not null default now()
);
create table public.technical_records (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id) on delete cascade,
 technical_field text not null default '',
 grade text not null default '',
 industry text not null default '',
 license_type text not null default '',
 registration_status text not null default '',
 updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid,
 table_name text not null,
 action text not null,
 record_id text,
 changed_at timestamptz not null default now()
);
create index cert_employee_idx on public.certificates(employee_id);
create index tech_employee_idx on public.technical_records(employee_id);
create index emp_hire_idx on public.employees(hire_date);
create index emp_exit_idx on public.employees(exit_date);
create index audit_changed_idx on public.audit_logs(changed_at desc);

create function public.can_access(min_role text default 'viewer') returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.enabled and (case min_role when 'admin' then p.role='admin' when 'editor' then p.role in ('editor','admin') else p.role in ('viewer','editor','admin') end));
$$;
revoke all on function public.can_access(text) from public;
grant execute on function public.can_access(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.certificates enable row level security;
alter table public.technical_records enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (public.can_access('admin') or (id = (select auth.uid())));
create policy profiles_update on public.profiles for update to authenticated using (public.can_access('admin')) with check (public.can_access('admin'));
create policy profiles_insert on public.profiles for insert to authenticated with check (public.can_access('admin'));
create policy employees_read on public.employees for select to authenticated using (public.can_access('viewer'));
create policy employees_add on public.employees for insert to authenticated with check (public.can_access('editor'));
create policy employees_edit on public.employees for update to authenticated using (public.can_access('editor')) with check (public.can_access('editor'));
create policy employees_remove on public.employees for delete to authenticated using (public.can_access('admin'));
create policy cert_read on public.certificates for select to authenticated using (public.can_access('viewer'));
create policy cert_add on public.certificates for insert to authenticated with check (public.can_access('editor'));
create policy cert_edit on public.certificates for update to authenticated using (public.can_access('editor')) with check (public.can_access('editor'));
create policy cert_delete on public.certificates for delete to authenticated using (public.can_access('editor'));
create policy tech_read on public.technical_records for select to authenticated using (public.can_access('viewer'));
create policy tech_add on public.technical_records for insert to authenticated with check (public.can_access('editor'));
create policy tech_edit on public.technical_records for update to authenticated using (public.can_access('editor')) with check (public.can_access('editor'));
create policy tech_delete on public.technical_records for delete to authenticated using (public.can_access('editor'));
create policy audit_read on public.audit_logs for select to authenticated using (public.can_access('admin'));

-- Auto-create disabled viewer profile when a new Auth user is invited/created.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name,role,enabled) values(new.id, coalesce(new.raw_user_meta_data->>'display_name',''), 'viewer', false) on conflict(id) do nothing;
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Audit write events server-side; clients cannot forge or delete history.
create function public.audit_data_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_logs(actor_id,table_name,action,record_id)
 values(auth.uid(),TG_TABLE_NAME,TG_OP,coalesce(case when TG_OP='DELETE' then to_jsonb(OLD)->>'id' else to_jsonb(NEW)->>'id' end,''));
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
create trigger employees_audit after insert or update or delete on public.employees for each row execute function public.audit_data_change();
create trigger cert_audit after insert or update or delete on public.certificates for each row execute function public.audit_data_change();
create trigger tech_audit after insert or update or delete on public.technical_records for each row execute function public.audit_data_change();
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.audit_data_change();

-- Initial admin after creating the FIRST account in Authentication > Users:
-- update public.profiles set role='admin', enabled=true where id='REPLACE-WITH-AUTH-USER-UUID';
-- All later users are disabled viewers until admin assigns role and enables them.
