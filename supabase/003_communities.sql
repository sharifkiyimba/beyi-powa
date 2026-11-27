-- =====================================================================
-- BEYI POWA: migration 003 (communities). Run ONCE in Supabase ->
-- SQL Editor, after schema.sql and 002_signup_phone.sql. Safe to re-run.
--
-- 1. A community member only counts while their blue tick is valid.
--    If a seller's fee lapses or they are suspended, they lose access to
--    community photos and chat until you renew them. (Their membership is
--    kept, so access returns on renewal.)
-- 2. communities_overview(): the list of communities with member counts,
--    which the app needs but members-only rules would otherwise hide.
-- =====================================================================

create or replace function public.is_member(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.seller_active(auth.uid())
     and exists (select 1 from public.community_members
                  where community_id = p_community and user_id = auth.uid())
$$;

create or replace function public.communities_overview()
returns table (
  id           uuid,
  name         text,
  description  text,
  owner_id     uuid,
  created_at   timestamptz,
  member_count bigint,
  is_member    boolean
)
language sql stable security definer set search_path = public as $$
  select c.id,
         c.name,
         c.description,
         c.owner_id,
         c.created_at,
         (select count(*) from public.community_members m where m.community_id = c.id),
         exists (select 1 from public.community_members m
                  where m.community_id = c.id and m.user_id = auth.uid())
    from public.communities c
   where public.seller_active(auth.uid()) or public.is_admin()
   order by c.created_at desc
$$;

revoke all on function public.communities_overview() from public, anon;
grant execute on function public.communities_overview() to authenticated;