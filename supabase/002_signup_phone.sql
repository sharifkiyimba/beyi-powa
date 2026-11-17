-- =====================================================================
-- BEYI POWA: migration 002. Run ONCE in Supabase -> SQL Editor,
-- after schema.sql. Safe to run again.
--
-- What it does: when a seller signs up, the phone number they typed is
-- saved straight into the private seller_private table. Doing it here
-- (not from the browser) works even when email confirmation is on.
-- =====================================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role  text := case when new.raw_user_meta_data->>'role' = 'seller' then 'seller' else 'buyer' end;
  v_phone text := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
begin
  insert into public.profiles (id, role, full_name, shop_name, location)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'shop_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'location', '')), '')
  );

  if v_role = 'seller' and v_phone is not null then
    insert into public.seller_private (user_id, phone) values (new.id, v_phone);
  end if;

  return new;
end $$;
