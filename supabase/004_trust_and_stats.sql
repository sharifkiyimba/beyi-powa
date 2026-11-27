-- =====================================================================
-- BEYI POWA: migration 004. Run ONCE in Supabase -> SQL Editor,
-- BEFORE you deploy the new app code. Safe to run again.
--
-- What it adds:
--   1. A private IMEI record per phone (only the seller and you can read it),
--      plus a public "IMEI on record" flag buyers can see. The same IMEI cannot
--      be on two available listings at once.
--   2. Reports can point at one phone (listing), and you can remove a listing.
--   3. View counts per phone, shown only to the seller who owns it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IMEI
-- ---------------------------------------------------------------------
create table if not exists public.listing_private (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  imei       text not null check (imei ~ '^[0-9]{15}$')
);

alter table public.listing_private enable row level security;

drop policy if exists "owner or admin reads imei" on public.listing_private;
create policy "owner or admin reads imei" on public.listing_private
  for select using (
    public.is_admin()
    or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

drop policy if exists "owner adds imei" on public.listing_private;
create policy "owner adds imei" on public.listing_private
  for insert with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

drop policy if exists "owner edits imei" on public.listing_private;
create policy "owner edits imei" on public.listing_private
  for update using (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

drop policy if exists "owner removes imei" on public.listing_private;
create policy "owner removes imei" on public.listing_private
  for delete using (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

-- The public flag. Nobody can write to it directly: only the trigger below does.
create table if not exists public.listing_imei_flags (
  listing_id uuid primary key references public.listings(id) on delete cascade
);

alter table public.listing_imei_flags enable row level security;

drop policy if exists "anyone sees imei flags" on public.listing_imei_flags;
create policy "anyone sees imei flags" on public.listing_imei_flags
  for select using (true);

create or replace function public.sync_imei_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.listing_imei_flags where listing_id = old.listing_id;
    return old;
  end if;
  insert into public.listing_imei_flags (listing_id) values (new.listing_id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists listing_private_flag on public.listing_private;
create trigger listing_private_flag
  after insert or update or delete on public.listing_private
  for each row execute function public.sync_imei_flag();

-- One IMEI, one available listing. (Runs as the system so it can see other sellers' records.)
create or replace function public.check_imei_unique() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
      from public.listing_private p
      join public.listings l on l.id = p.listing_id
     where p.imei = new.imei
       and p.listing_id <> new.listing_id
       and l.status = 'available'
  ) then
    raise exception 'This IMEI is already listed on BEYI POWA.';
  end if;
  return new;
end $$;

drop trigger if exists listing_private_unique on public.listing_private;
create trigger listing_private_unique
  before insert or update on public.listing_private
  for each row execute function public.check_imei_unique();

-- ---------------------------------------------------------------------
-- 2. Reports about one phone, and removing a listing
-- ---------------------------------------------------------------------
alter table public.reports
  add column if not exists listing_id uuid references public.listings(id) on delete set null;

-- Admin only: remove a listing (its photos rows and IMEI record go with it).
create or replace function public.admin_remove_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  delete from public.listings where id = p_listing;
end $$;

-- Admin only: read the IMEI of a reported phone (the table policy already allows it,
-- this keeps the admin page simple and works even for hidden listings).
create or replace function public.admin_listing_imei(p_listing uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select imei into v from public.listing_private where listing_id = p_listing;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- 3. Views per phone (one count per visitor per day)
-- ---------------------------------------------------------------------
create table if not exists public.listing_views (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer     text not null check (length(viewer) between 8 and 64),
  day        date not null default current_date,
  primary key (listing_id, viewer, day)
);

alter table public.listing_views enable row level security;  -- no policies: only record_view() writes

create table if not exists public.listing_stats (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  views      bigint not null default 0
);

alter table public.listing_stats enable row level security;

drop policy if exists "owner or admin reads stats" on public.listing_stats;
create policy "owner or admin reads stats" on public.listing_stats
  for select using (
    public.is_admin()
    or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

create or replace function public.record_view(p_listing uuid, p_viewer text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if p_viewer is null or length(p_viewer) < 8 or length(p_viewer) > 64 then
    return;
  end if;
  select seller_id into v_owner from public.listings where id = p_listing;
  if not found or v_owner = auth.uid() then
    return;  -- unknown phone, or the seller looking at their own phone
  end if;
  insert into public.listing_views (listing_id, viewer) values (p_listing, p_viewer)
  on conflict do nothing;
  if found then
    insert into public.listing_stats (listing_id, views) values (p_listing, 1)
    on conflict (listing_id) do update set views = public.listing_stats.views + 1;
  end if;
end $$;

grant execute on function public.record_view(uuid, text) to anon, authenticated;
grant execute on function public.admin_remove_listing(uuid) to authenticated;
grant execute on function public.admin_listing_imei(uuid) to authenticated;
