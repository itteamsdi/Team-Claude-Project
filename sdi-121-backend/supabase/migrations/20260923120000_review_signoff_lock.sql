-- SDI 1-2-1 Review — sign-off and lock
--
-- Adds a two-party sign-off (employee + line manager) to public.reviews and
-- locks a review once it is signed off, so completed 1-2-1s form a fixed
-- history. Enforced in the database, not just in the page:
--
--   * Sign-off columns and status can only change through the sign_review /
--     unsign_review / reopen_review functions below (the page calls these).
--   * While any signature is present, the review content cannot be edited
--     (withdraw the signature first). This stops someone signing one version
--     and the other party signing a different one.
--   * Once status = 'Complete', no signed-in user can update or delete it.
--     Only an admin can reopen it, via reopen_review, which clears both
--     signatures.
--
-- Run once in Supabase → SQL Editor (or `supabase db push`). Safe to re-run.

-- 1) Sign-off columns ---------------------------------------------------------
alter table public.reviews
  add column if not exists employee_signed_at timestamptz,
  add column if not exists employee_signed_by text,
  add column if not exists manager_signed_at  timestamptz,
  add column if not exists manager_signed_by  text,
  add column if not exists completed_at       timestamptz,
  add column if not exists reopened_at        timestamptz,
  add column if not exists reopened_by        text;

-- 2) Helpers ------------------------------------------------------------------
create or replace function public.review_caller_email()
returns text language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.review_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where lower(email) = public.review_caller_email() and role = 'admin'
  )
$$;

-- 3) Guard trigger ------------------------------------------------------------
-- Direct requests from the browser run as the 'authenticated' (or 'anon') role.
-- The sign-off functions run as their owner, so their changes pass through.
create or replace function public.reviews_signoff_guard()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.status             := 'Open';
    new.employee_signed_at := null;  new.employee_signed_by := null;
    new.manager_signed_at  := null;  new.manager_signed_by  := null;
    new.completed_at       := null;
    new.reopened_at        := null;  new.reopened_by        := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'Complete' then
      raise exception 'This review is signed off and locked, so it cannot be deleted.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status = 'Complete' then
    raise exception 'This review is signed off and locked.' using errcode = '42501';
  end if;

  if new.status             is distinct from old.status
  or new.employee_signed_at is distinct from old.employee_signed_at
  or new.employee_signed_by is distinct from old.employee_signed_by
  or new.manager_signed_at  is distinct from old.manager_signed_at
  or new.manager_signed_by  is distinct from old.manager_signed_by
  or new.completed_at       is distinct from old.completed_at
  or new.reopened_at        is distinct from old.reopened_at
  or new.reopened_by        is distinct from old.reopened_by then
    raise exception 'Sign-off can only be changed with the Sign off buttons.'
      using errcode = '42501';
  end if;

  -- Who the review is for / who signs it as manager cannot be changed by users.
  if not public.review_is_admin() and (
       new.employee_email is distinct from old.employee_email
    or new.manager_email  is distinct from old.manager_email
    or new.owner          is distinct from old.owner) then
    raise exception 'Only an admin can change who a review belongs to.'
      using errcode = '42501';
  end if;

  if (old.employee_signed_at is not null or old.manager_signed_at is not null) and (
       new.state::text   is distinct from old.state::text
    or new.employee_name is distinct from old.employee_name
    or new.review_date   is distinct from old.review_date) then
    raise exception 'Sign-off is in progress. Withdraw the signature before editing this review.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

drop trigger if exists reviews_signoff_guard on public.reviews;
create trigger reviews_signoff_guard
  before insert or update or delete on public.reviews
  for each row execute function public.reviews_signoff_guard();

-- 4) Row-level security: completed reviews cannot be updated or deleted --------
-- RESTRICTIVE policies are ANDed with the existing (permissive) policies, so
-- they only ever take access away.
drop policy if exists reviews_locked_no_update on public.reviews;
create policy reviews_locked_no_update on public.reviews
  as restrictive for update to authenticated, anon
  using (status is distinct from 'Complete')
  with check (true);

drop policy if exists reviews_locked_no_delete on public.reviews;
create policy reviews_locked_no_delete on public.reviews
  as restrictive for delete to authenticated, anon
  using (status is distinct from 'Complete');

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass) then
    raise notice 'Row level security is OFF on public.reviews, so the lock policies are inactive. The guard trigger still enforces the lock.';
  end if;
end $$;

-- 5) Sign-off functions (called from the page) -------------------------------
-- The employee signs as 'employee'; the review's manager_email signs as
-- 'manager'. If a review has no manager recorded, an admin (who is not the
-- employee) signs as the reviewer. When both have signed, it becomes Complete.
create or replace function public.sign_review(p_id text)
returns public.reviews
language plpgsql security definer set search_path = public
as $$
declare
  r  public.reviews;
  me text := public.review_caller_email();
begin
  if me = '' then raise exception 'Not signed in' using errcode = '42501'; end if;

  select * into r from public.reviews where id::text = p_id for update;
  if not found then raise exception 'Review not found'; end if;
  if r.status = 'Complete' then raise exception 'This review is already signed off.'; end if;

  if lower(coalesce(r.employee_email, '')) = me then
    if r.employee_signed_at is null then
      update public.reviews set employee_signed_at = now(), employee_signed_by = me where id = r.id;
    end if;
  elsif lower(coalesce(r.manager_email, '')) = me
     or (coalesce(r.manager_email, '') = '' and public.review_is_admin()) then
    if r.manager_signed_at is null then
      update public.reviews set manager_signed_at = now(), manager_signed_by = me where id = r.id;
    end if;
  else
    raise exception 'Only the employee or their line manager can sign off this review.'
      using errcode = '42501';
  end if;

  update public.reviews set status = 'Complete', completed_at = now()
   where id = r.id and employee_signed_at is not null and manager_signed_at is not null;

  select * into r from public.reviews where id = r.id;
  return r;
end
$$;

-- Withdraw your own signature (only before the review is Complete).
create or replace function public.unsign_review(p_id text)
returns public.reviews
language plpgsql security definer set search_path = public
as $$
declare
  r  public.reviews;
  me text := public.review_caller_email();
begin
  select * into r from public.reviews where id::text = p_id for update;
  if not found then raise exception 'Review not found'; end if;
  if r.status = 'Complete' then
    raise exception 'This review is signed off and locked. Ask an admin to reopen it.';
  end if;

  if lower(coalesce(r.employee_signed_by, '')) = me then
    update public.reviews set employee_signed_at = null, employee_signed_by = null where id = r.id;
  elsif lower(coalesce(r.manager_signed_by, '')) = me then
    update public.reviews set manager_signed_at = null, manager_signed_by = null where id = r.id;
  else
    raise exception 'You have not signed this review.';
  end if;

  select * into r from public.reviews where id = r.id;
  return r;
end
$$;

-- Admin only: unlock a completed review. Clears both signatures.
create or replace function public.reopen_review(p_id text)
returns public.reviews
language plpgsql security definer set search_path = public
as $$
declare
  r public.reviews;
begin
  if not public.review_is_admin() then
    raise exception 'Only an admin can reopen a signed-off review.' using errcode = '42501';
  end if;

  update public.reviews
     set status = 'Open', completed_at = null,
         employee_signed_at = null, employee_signed_by = null,
         manager_signed_at  = null, manager_signed_by  = null,
         reopened_at = now(), reopened_by = public.review_caller_email()
   where id::text = p_id
  returning * into r;
  if not found then raise exception 'Review not found'; end if;
  return r;
end
$$;

revoke all on function public.sign_review(text)   from public, anon;
revoke all on function public.unsign_review(text) from public, anon;
revoke all on function public.reopen_review(text) from public, anon;
grant execute on function public.sign_review(text)   to authenticated;
grant execute on function public.unsign_review(text) to authenticated;
grant execute on function public.reopen_review(text) to authenticated;
