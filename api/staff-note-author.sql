-- Store the staff username on each new note.
-- Apply this file once. Do not reapply api/staff.sql, api/schema.sql, or api/staff-notes.sql.
-- This file does not copy old notes and does not invent an author for them.

begin;

alter table inquiry_staff_notes
  add column if not exists created_by text;

alter table inquiry_staff_notes
  drop constraint if exists inquiry_staff_notes_created_by;

alter table inquiry_staff_notes
  add constraint inquiry_staff_notes_created_by
  check (
    created_by is null
    or (
      created_by = btrim(created_by)
      and created_by = lower(created_by)
      and char_length(created_by) between 3 and 254
      and created_by ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

drop function if exists list_staff_notes(uuid);

create function list_staff_notes(p_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  deleted_at timestamptz,
  created_by text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform purge_expired_staff_notes();
  return query
  select n.id, n.body, n.created_at, n.deleted_at, n.created_by
  from inquiry_staff_notes n
  where n.inquiry_id = p_id
  order by n.created_at desc;
end;
$$;

drop function if exists update_inquiry_staff(uuid, text, text);
drop function if exists update_inquiry_staff(uuid, text, text, text);

create function update_inquiry_staff(
  p_id uuid,
  p_status text,
  p_staff_notes text,
  p_author text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_notes text;
  author text;
begin
  if p_status not in ('new', 'contacted', 'planning', 'booked', 'closed', 'spam') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  clean_notes := nullif(btrim(coalesce(p_staff_notes, '')), '');
  if clean_notes is not null and clean_notes !~ '[^[:space:]]' then
    clean_notes := null;
  end if;
  if clean_notes is not null and char_length(clean_notes) > 4000 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;
  update inquiries
  set status = p_status
  where inquiries.id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if clean_notes is not null then
    author := nullif(btrim(coalesce(p_author, '')), '');
    if author is null
       or author <> lower(author)
       or char_length(author) < 3
       or char_length(author) > 254
       or author !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'bad_author' using errcode = 'P0001';
    end if;
    insert into inquiry_staff_notes (inquiry_id, body, created_by)
    values (p_id, clean_notes, author);
  end if;
  perform purge_expired_staff_notes();
  perform refresh_inquiry_staff_summary(p_id);
end;
$$;

revoke all on function list_staff_notes(uuid) from public;
revoke all on function update_inquiry_staff(uuid, text, text, text) from public;

grant execute on function list_staff_notes(uuid) to fmtstaff;
grant execute on function delete_staff_note(uuid, uuid) to fmtstaff;
grant execute on function update_inquiry_staff(uuid, text, text, text) to fmtstaff;

commit;
