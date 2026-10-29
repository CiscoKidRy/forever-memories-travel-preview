-- Staff note history for Forever Memories Travel.
-- Apply this file once. Do not reapply api/staff.sql.
-- A deleted note stays visible for 48 hours, then this file's functions remove the row.

create table if not exists inquiry_staff_notes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint inquiry_staff_notes_body
    check (body = btrim(body) and char_length(body) between 1 and 4000)
);

create index if not exists inquiry_staff_notes_inquiry_idx
  on inquiry_staff_notes (inquiry_id, created_at desc);

create or replace function purge_expired_staff_notes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from inquiry_staff_notes
  where deleted_at is not null
    and deleted_at <= clock_timestamp() - interval '48 hours';
end;
$$;

create or replace function refresh_inquiry_staff_summary(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update inquiries
  set staff_notes = (
        select body
        from inquiry_staff_notes
        where inquiry_id = p_id
          and deleted_at is null
        order by created_at desc
        limit 1
      ),
      staff_updated_at = (
        select created_at
        from inquiry_staff_notes
        where inquiry_id = p_id
          and deleted_at is null
        order by created_at desc
        limit 1
      )
  where id = p_id;
end;
$$;

create or replace function list_staff_notes(p_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform purge_expired_staff_notes();
  return query
  select n.id, n.body, n.created_at, n.deleted_at
  from inquiry_staff_notes n
  where n.inquiry_id = p_id
  order by n.created_at desc;
end;
$$;

create or replace function delete_staff_note(p_inquiry_id uuid, p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform purge_expired_staff_notes();
  perform 1 from inquiries where inquiries.id = p_inquiry_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update inquiry_staff_notes
  set deleted_at = clock_timestamp()
  where inquiry_staff_notes.id = p_note_id
    and inquiry_id = p_inquiry_id
    and deleted_at is null;
  if not found then
    perform 1
    from inquiry_staff_notes
    where inquiry_staff_notes.id = p_note_id
      and inquiry_id = p_inquiry_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;
  perform refresh_inquiry_staff_summary(p_inquiry_id);
end;
$$;

create or replace function update_inquiry_staff(
  p_id uuid,
  p_status text,
  p_staff_notes text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_notes text;
begin
  if p_status not in ('new', 'contacted', 'planning', 'booked', 'closed', 'spam') then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  clean_notes := nullif(btrim(coalesce(p_staff_notes, '')), '');
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
    insert into inquiry_staff_notes (inquiry_id, body)
    values (p_id, clean_notes);
  end if;
  perform purge_expired_staff_notes();
  perform refresh_inquiry_staff_summary(p_id);
end;
$$;

insert into inquiry_staff_notes (inquiry_id, body, created_at)
select i.id, i.staff_notes, coalesce(i.staff_updated_at, clock_timestamp())
from inquiries i
where i.staff_notes is not null
  and not exists (
    select 1 from inquiry_staff_notes n where n.inquiry_id = i.id
  );

revoke all on function purge_expired_staff_notes() from public;
revoke all on function refresh_inquiry_staff_summary(uuid) from public;
revoke all on function list_staff_notes(uuid) from public;
revoke all on function delete_staff_note(uuid, uuid) from public;
revoke all on function update_inquiry_staff(uuid, text, text) from public;

grant execute on function list_staff_notes(uuid) to fmtstaff;
grant execute on function delete_staff_note(uuid, uuid) to fmtstaff;
grant execute on function update_inquiry_staff(uuid, text, text) to fmtstaff;
