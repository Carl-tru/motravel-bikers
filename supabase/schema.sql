create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
    rider_role text not null default 'pilot' check (rider_role in ('pilot', 'copilot')),
    motorcycle text check (motorcycle is null or char_length(motorcycle) <= 100),
    riding_style text check (riding_style is null or char_length(riding_style) <= 100),
    account_role text not null default 'member' check (account_role in ('member', 'admin')),
    membership_status text not null default 'pending' check (membership_status in ('pending', 'approved', 'rejected')),
    activity_status text not null default 'inactive' check (activity_status in ('active', 'frequent', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists profiles_approved_full_name_idx
    on public.profiles (full_name)
    where membership_status = 'approved';

create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and membership_status = 'approved'
    );
$$;

create or replace function public.is_club_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and account_role = 'admin'
          and membership_status = 'approved'
    );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        rider_role,
        motorcycle,
        riding_style
    )
    values (
        new.id,
        coalesce(left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 100), 'Integrante'),
        case
            when new.raw_user_meta_data ->> 'rider_role' = 'copilot' then 'copilot'
            else 'pilot'
        end,
        left(nullif(btrim(new.raw_user_meta_data ->> 'motorcycle'), ''), 100),
        left(nullif(btrim(new.raw_user_meta_data ->> 'riding_style'), ''), 100)
    );
    return new;
end;
$$;

create or replace function public.protect_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is not null
       and coalesce((select auth.role()), '') <> 'service_role'
       and not public.is_club_admin()
       and (
           new.account_role is distinct from old.account_role
           or new.membership_status is distinct from old.membership_status
           or new.activity_status is distinct from old.activity_status
       )
    then
        raise exception 'Only an administrator can change membership permissions or activity.'
            using errcode = '42501';
    end if;

    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.list_profiles_for_admin()
returns table (
    id uuid,
    email text,
    full_name text,
    rider_role text,
    membership_status text,
    activity_status text,
    motorcycle text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select p.id, u.email::text, p.full_name, p.rider_role,
           p.membership_status, p.activity_status, p.motorcycle, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where public.is_club_admin()
    order by p.created_at desc;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute function public.create_profile_for_new_user();

drop trigger if exists protect_profile_permissions on public.profiles;
create trigger protect_profile_permissions
    before update on public.profiles
    for each row execute function public.protect_profile_permissions();

alter table public.profiles enable row level security;

drop policy if exists "Approved members and admins can read profiles" on public.profiles;
create policy "Approved members and admins can read profiles"
    on public.profiles for select to authenticated
    using (
        id = (select auth.uid())
        or public.is_club_admin()
        or (
            membership_status = 'approved'
            and (select public.is_approved_member())
        )
    );

drop policy if exists "Members can update their profile and admins can manage all" on public.profiles;
create policy "Members can update their profile and admins can manage all"
    on public.profiles for update to authenticated
    using (id = (select auth.uid()) or public.is_club_admin())
    with check (id = (select auth.uid()) or public.is_club_admin());

revoke all on public.profiles from anon, authenticated;
grant usage on schema public to authenticated;
grant select (
    id, full_name, rider_role, motorcycle, riding_style,
    membership_status, activity_status, created_at
) on public.profiles to authenticated;
grant update (full_name, rider_role, motorcycle, riding_style) on public.profiles to authenticated;
grant update (membership_status, activity_status) on public.profiles to authenticated;
revoke all on function public.is_approved_member() from public, anon;
revoke all on function public.is_club_admin() from public, anon;
revoke all on function public.list_profiles_for_admin() from public, anon;
grant execute on function public.is_approved_member() to authenticated;
grant execute on function public.is_club_admin() to authenticated;
grant execute on function public.list_profiles_for_admin() to authenticated;

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1
           from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'profiles'
       )
    then
        alter publication supabase_realtime add table public.profiles;
    end if;
end;
$$;
