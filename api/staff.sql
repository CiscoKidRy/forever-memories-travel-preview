-- Additive staff fields and functions for the existing inquiries table.
-- Do not replace submit_inquiry or mark_inquiry_email.
-- This file was applied once. Do not apply it to the live database again.
-- The note-history objects in this file were applied from api/staff-notes.sql.
-- Do not run schema.sql against the live database.

alter table public.inquiries
  add column if not exists status text not null default 'new',
  add column if not exists staff_notes text,
  add column if not exists staff_updated_at timestamptz;

alter table public.inquiries
  drop constraint if exists inquiries_status,
  add constraint inquiries_status
    check (status in ('new', 'contacted', 'planning', 'booked', 'closed', 'spam'));

alter table public.inquiries
  drop constraint if exists inquiries_staff_notes,
  add constraint inquiries_staff_notes
    check (staff_notes is null
      or (staff_notes = btrim(staff_notes)
          and char_length(staff_notes) between 1 and 4000));

create index if not exists inquiries_status_submitted_idx
  on public.inquiries (status, submitted_at desc);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fmtstaff') then
    create role fmtstaff login;
  end if;
end $$;

create or replace function list_inquiries(p_status text, p_limit integer)
returns table (
  id uuid,
  submitted_at timestamptz,
  name text,
  email text,
  phone text,
  trip text,
  travel_when text,
  party text,
  notes text,
  visitor_email_status text,
  ryan_email_status text,
  status text,
  staff_notes text,
  staff_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer;
begin
  lim := least(coalesce(p_limit, 100), 100);
  if lim < 1 then
    lim := 1;
  end if;
  if p_status is not null and p_status not in (
    'new', 'contacted', 'planning', 'booked', 'closed', 'spam'
  ) then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  return query
  select i.id, i.submitted_at, i.name, i.email, i.phone, i.trip,
         i.travel_when, i.party, i.notes, i.visitor_email_status,
         i.ryan_email_status, i.status, i.staff_notes, i.staff_updated_at
  from inquiries i
  where p_status is null or i.status = p_status
  order by i.submitted_at desc
  limit lim;
end;
$$;

create or replace function get_inquiry(p_id uuid)
returns table (
  id uuid,
  submitted_at timestamptz,
  name text,
  email text,
  phone text,
  trip text,
  travel_when text,
  party text,
  notes text,
  visitor_email_status text,
  ryan_email_status text,
  status text,
  staff_notes text,
  staff_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select i.id, i.submitted_at, i.name, i.email, i.phone, i.trip,
         i.travel_when, i.party, i.notes, i.visitor_email_status,
         i.ryan_email_status, i.status, i.staff_notes, i.staff_updated_at
  from inquiries i
  where i.id = p_id;
end;
$$;

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

revoke all on function list_inquiries(text, integer) from public;
revoke all on function get_inquiry(uuid) from public;
revoke all on function update_inquiry_staff(uuid, text, text) from public;
revoke all on function purge_expired_staff_notes() from public;
revoke all on function refresh_inquiry_staff_summary(uuid) from public;
revoke all on function list_staff_notes(uuid) from public;
revoke all on function delete_staff_note(uuid, uuid) from public;

grant execute on function list_inquiries(text, integer) to fmtstaff;
grant execute on function get_inquiry(uuid) to fmtstaff;
grant execute on function update_inquiry_staff(uuid, text, text) to fmtstaff;
grant execute on function list_staff_notes(uuid) to fmtstaff;
grant execute on function delete_staff_note(uuid, uuid) to fmtstaff;

insert into inquiry_staff_notes (inquiry_id, body, created_at)
select i.id, i.staff_notes, coalesce(i.staff_updated_at, clock_timestamp())
from inquiries i
where i.staff_notes is not null
  and not exists (
    select 1 from inquiry_staff_notes n where n.inquiry_id = i.id
  );
