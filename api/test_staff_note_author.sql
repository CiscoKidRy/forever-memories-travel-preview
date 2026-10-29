-- Throwaway checks for staff-note authors. Rolls back its inquiry.
-- Run only after api/staff-note-author.sql. Prints check names that failed, then one boolean.
-- Does not print a note body, a name, an email address, or a timestamp.
-- known_before is created here. A wrapper may create the same snapshot before the
-- schema file. This statement does not replace that earlier snapshot.

\set ON_ERROR_STOP on

begin;

create temp table note_author_checks (
  name text primary key,
  ok boolean not null
);

create temp table if not exists known_before as
select id, created_at
from inquiry_staff_notes
where inquiry_id = '69b49075-4863-42a2-9841-0dade9cd99e9';

do $$
declare
  iid uuid;
  note_id uuid;
  first_deleted timestamptz;
  second_deleted timestamptz;
  status_text text;
  note_count integer;
  listed integer;
  author_ok boolean;
  long_ok text;
  too_long text;
  known uuid := '69b49075-4863-42a2-9841-0dade9cd99e9';
begin
  select inquiry_id into iid
  from submit_inquiry(
    gen_random_uuid(),
    'https://preview.forevermemoriestravel.com/',
    'Guest Example',
    'guest@example.com',
    null,
    'Cruise',
    'June',
    '2 adults',
    'note-check',
    '203.0.113.61'::inet
  );

  perform update_inquiry_staff(iid, 'contacted', E'  \n  ', 'not-an-email');
  select status, (
    select count(*) from inquiry_staff_notes where inquiry_id = iid
  ) into status_text, note_count
  from inquiries where id = iid;
  insert into note_author_checks values (
    'blank_status_only',
    status_text = 'contacted' and note_count = 0
  );

  begin
    perform update_inquiry_staff(iid, 'planning', 'note-check', '');
    insert into note_author_checks values ('empty_author_rejected', false);
  exception
    when sqlstate 'P0001' then
      insert into note_author_checks values ('empty_author_rejected', sqlerrm like '%bad_author%');
  end;
  begin
    perform update_inquiry_staff(iid, 'planning', 'note-check', 'bad author');
    insert into note_author_checks values ('space_author_rejected', false);
  exception
    when sqlstate 'P0001' then
      insert into note_author_checks values ('space_author_rejected', sqlerrm like '%bad_author%');
  end;
  begin
    perform update_inquiry_staff(iid, 'planning', 'note-check', 'nosymbol.example.com');
    insert into note_author_checks values ('missing_at_rejected', false);
  exception
    when sqlstate 'P0001' then
      insert into note_author_checks values ('missing_at_rejected', sqlerrm like '%bad_author%');
  end;

  too_long := 'a@' || repeat('b', 251) || '.c';
  begin
    perform update_inquiry_staff(iid, 'planning', 'note-check', too_long);
    insert into note_author_checks values ('long_author_rejected', false);
  exception
    when sqlstate 'P0001' then
      insert into note_author_checks values (
        'long_author_rejected',
        char_length(too_long) = 255 and sqlerrm like '%bad_author%'
      );
  end;

  select status into status_text from inquiries where id = iid;
  insert into note_author_checks values ('bad_author_keeps_status', status_text = 'contacted');
  select count(*) into note_count from inquiry_staff_notes where inquiry_id = iid;
  insert into note_author_checks values ('bad_author_inserts_nothing', note_count = 0);

  long_ok := 'a@' || repeat('b', 250) || '.c';
  perform update_inquiry_staff(iid, 'planning', 'note-check', long_ok);
  insert into note_author_checks values (
    'length_254_stored',
    char_length(long_ok) = 254
    and exists (
      select 1 from inquiry_staff_notes
      where inquiry_id = iid and created_by = long_ok and deleted_at is null
    )
  );

  perform update_inquiry_staff(iid, 'booked', 'note-check', 'staff.check@example.com');
  select created_by = 'staff.check@example.com' into author_ok
  from inquiry_staff_notes
  where inquiry_id = iid and deleted_at is null
  order by created_at desc
  limit 1;
  insert into note_author_checks values ('author_match', author_ok is true);

  select id, deleted_at into note_id, first_deleted
  from inquiry_staff_notes
  where inquiry_id = iid and created_by = 'staff.check@example.com';
  perform delete_staff_note(iid, note_id);
  select deleted_at into first_deleted
  from inquiry_staff_notes where id = note_id;
  perform delete_staff_note(iid, note_id);
  select deleted_at into second_deleted
  from inquiry_staff_notes where id = note_id;
  insert into note_author_checks values (
    'deleted_at_unchanged',
    first_deleted is not null and first_deleted = second_deleted
  );

  update inquiry_staff_notes
  set deleted_at = clock_timestamp() - interval '48 hours' + interval '1 second'
  where id = note_id;
  set local role fmtstaff;
  select count(*) into listed from list_staff_notes(iid) where id = note_id;
  reset role;
  insert into note_author_checks values ('kept_until_48_hours', listed = 1);

  update inquiry_staff_notes
  set deleted_at = clock_timestamp() - interval '48 hours'
  where id = note_id;
  set local role fmtstaff;
  select count(*) into listed from list_staff_notes(iid) where id = note_id;
  reset role;
  insert into note_author_checks values ('purged_at_48_hours', listed = 0);

  insert into note_author_checks values (
    'known_untouched',
    (select count(*) from known_before) > 0
    and (select count(*) from inquiry_staff_notes where inquiry_id = known)
        = (select count(*) from known_before)
    and (select count(created_by) from inquiry_staff_notes where inquiry_id = known) = 0
    and not exists (
      select 1
      from (
        select id, created_at from inquiry_staff_notes where inquiry_id = known
        except
        select id, created_at from known_before
      ) changed
    )
  );

  insert into note_author_checks values (
    'fmtstaff_closed',
    not has_table_privilege('fmtstaff', 'public.inquiry_staff_notes', 'SELECT')
    and not has_table_privilege('fmtstaff', 'public.inquiry_staff_notes', 'INSERT')
    and not has_table_privilege('fmtstaff', 'public.inquiry_staff_notes', 'UPDATE')
    and not has_table_privilege('fmtstaff', 'public.inquiry_staff_notes', 'DELETE')
    and not has_function_privilege('fmtstaff', 'public.purge_expired_staff_notes()', 'EXECUTE')
  );

  insert into note_author_checks values (
    'one_update_function',
    (
      select count(*) = 1
        and bool_and(pg_get_function_identity_arguments(p.oid) = 'p_id uuid, p_status text, p_staff_notes text, p_author text')
      from pg_proc p
      where p.proname = 'update_inquiry_staff'
        and p.pronamespace = 'public'::regnamespace
    )
  );
end
$$;

select name from note_author_checks where not ok order by name;
select bool_and(ok) as note_author_checks_ok from note_author_checks;

rollback;
