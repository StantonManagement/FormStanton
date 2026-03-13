-- Ensure storage bucket exists for form uploads used by form APIs.
insert into storage.buckets (id, name, public)
select 'form-photos', 'form-photos', true
where not exists (
  select 1
  from storage.buckets
  where id = 'form-photos'
);

-- Ensure form_type supports tenant_assessment and future forms.
-- This removes restrictive form_type check constraints and replaces them with a non-empty guard.
do $$
declare
  constraint_row record;
begin
  if to_regclass('public.form_submissions') is null then
    raise notice 'public.form_submissions not found, skipping constraint update';
    return;
  end if;

  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.form_submissions'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%form_type%'
  loop
    execute format(
      'alter table public.form_submissions drop constraint %I',
      constraint_row.conname
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.form_submissions'::regclass
      and c.conname = 'form_submissions_form_type_nonempty_chk'
  ) then
    alter table public.form_submissions
      add constraint form_submissions_form_type_nonempty_chk
      check (length(btrim(form_type)) > 0);
  end if;
end
$$;
