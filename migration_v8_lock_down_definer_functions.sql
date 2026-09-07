-- ============================================================================
-- DukaSmart v8 — revoke EXECUTE on internal SECURITY DEFINER functions
--
-- Run once in the Supabase SQL editor, after migration_v7_winga_consignment.sql.
--
-- WHAT THE LINTER FOUND
--   PostgreSQL grants EXECUTE on every new function to PUBLIC by default. Under
--   Supabase, PUBLIC includes `anon` and `authenticated`, and every function in
--   the `public` schema is published at /rest/v1/rpc/<name>. Earlier migrations
--   revoked this for the functions written to be called — complete_sale,
--   record_loss, process_return — but not for the trigger functions, which were
--   never meant to be reachable from the API at all.
--
-- HOW BAD IS IT
--   Not very, on its own. All three flagged functions return `trigger`, and
--   PostgreSQL refuses to execute a trigger function outside a trigger, so
--   PostgREST cannot usefully call them. But they run as the definer — they
--   bypass RLS by design — and leaving them granted means the only thing
--   standing between an anonymous caller and a definer-rights function is an
--   error message. The grant is not needed, so it goes.
--
-- THIS DOES NOT BREAK THE TRIGGERS
--   PostgreSQL checks EXECUTE on a trigger function when the trigger is
--   CREATED, not each time it fires. Revoking here leaves every trigger working
--   exactly as before. Do not "restore" these grants if stock movements look
--   wrong — the cause will be somewhere else.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Every definer-rights trigger function in the exposed schema
--
-- Written as a sweep rather than three named revokes so that any trigger
-- function added later is covered the next time this runs, and so the file
-- stays correct if a function is renamed.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
    raise notice 'Revoked EXECUTE on %', fn.signature;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. rls_auto_enable
--
-- Flagged by the linter but absent from every migration in this repo, and not
-- called anywhere in the app. It was added out-of-band — through the dashboard,
-- a template or an extension. Revoked because nothing here needs it; the guard
-- means this file is still safe on a project that has never had it.
--
-- Worth finding out where it came from:
--   select prosrc from pg_proc where proname = 'rls_auto_enable';
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. username_available stays reachable — on purpose
--
-- The linter flags it too, and it is the one that should keep its grant. Signup
-- checks whether a name is taken before an account exists, so the caller is
-- necessarily `anon`, and it must read user_profiles past RLS, so it must be
-- SECURITY DEFINER. It takes a username and returns a boolean, nothing else.
--
-- The real cost is that it lets someone probe which usernames are registered.
-- That is inherent to any availability check, and the alternative — letting
-- signup fail on a unique-violation instead — is worse for a shopkeeper on a
-- phone. Left as it is, deliberately, so a future reader does not "fix" it.
-- ---------------------------------------------------------------------------

commit;

notify pgrst, 'reload schema';
