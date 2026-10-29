-- Forever Memories Travel trip requests.
-- The API connects as fmtinq and may only execute the functions.
-- ryanhocking may select. Passwords are not stored in this file.
-- The running database is described in Documentation/DATA-DICTIONARY.md.
-- Any change to this schema requires that data dictionary to be updated
-- in the same pull request.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'fmtinq') then
    create role fmtinq login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'ryanhocking') then
    create role ryanhocking login;
  end if;
end $$;

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default clock_timestamp(),
  idempotency_key uuid not null unique,
  payload_fingerprint text not null,
  source_url text not null,
  name text not null,
  email text not null,
  phone text,
  trip text not null,
  travel_when text,
  party text,
  notes text,
  client_ip inet not null,
  visitor_email_status text not null default 'pending',
  ryan_email_status text not null default 'pending',
  constraint inquiries_fingerprint_hex
    check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint inquiries_name
    check (name = btrim(name) and char_length(name) between 1 and 200),
  constraint inquiries_email
    check (email = lower(btrim(email)) and char_length(email) between 3 and 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint inquiries_phone
    check (phone is null
      or (phone = btrim(phone) and char_length(phone) between 1 and 40)),
  constraint inquiries_trip
    check (trip in ('Family vacation', 'Theme park', 'Cruise',
                    'International', 'Not sure yet')),
  constraint inquiries_travel_when
    check (travel_when is null or (travel_when = btrim(travel_when)
      and char_length(travel_when) between 1 and 300)),
  constraint inquiries_party
    check (party is null or (party = btrim(party)
      and char_length(party) between 1 and 400)),
  constraint inquiries_notes
    check (notes is null or (notes = btrim(notes)
      and char_length(notes) between 1 and 4000)),
  constraint inquiries_source_url
    check (char_length(source_url) between 1 and 500
      and source_url ~ '^https://preview\.forevermemoriestravel\.com(/[^[:space:]]*)?$'),
  constraint inquiries_visitor_email_status
    check (visitor_email_status in ('pending', 'sent', 'failed')),
  constraint inquiries_ryan_email_status
    check (ryan_email_status in ('pending', 'sent', 'failed'))
);

create index if not exists inquiries_submitted_at_idx
  on inquiries (submitted_at desc);

create index if not exists inquiries_fingerprint_submitted_idx
  on inquiries (payload_fingerprint, submitted_at desc);

create index if not exists inquiries_client_ip_submitted_idx
  on inquiries (client_ip, submitted_at desc);

create or replace function inquiries_stamp_submitted_at()
returns trigger
language plpgsql
as $$
begin
  new.submitted_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists inquiries_stamp_submitted_at on inquiries;
create trigger inquiries_stamp_submitted_at
before insert on inquiries
for each row execute function inquiries_stamp_submitted_at();

create or replace function submit_inquiry(
  p_idempotency_key uuid,
  p_source_url text,
  p_name text,
  p_email text,
  p_phone text,
  p_trip text,
  p_travel_when text,
  p_party text,
  p_notes text,
  p_client_ip inet
) returns table (
  inquiry_id uuid,
  inquiry_submitted_at timestamptz,
  created boolean,
  out_visitor_email text,
  out_ryan_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_email text := lower(btrim(p_email));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_when text := nullif(btrim(coalesce(p_travel_when, '')), '');
  v_party text := nullif(btrim(coalesce(p_party, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_source text := btrim(p_source_url);
  v_trip text := btrim(p_trip);
  v_fingerprint text;
  v_existing inquiries%rowtype;
  v_recent inquiries%rowtype;
  v_recent_count integer;
begin
  if p_idempotency_key is null or p_client_ip is null then
    raise exception 'missing_key' using errcode = 'P0001';
  end if;

  v_fingerprint := encode(digest(convert_to(concat_ws(
    chr(31), v_name, v_email, coalesce(v_phone, ''), v_trip,
    coalesce(v_when, ''), coalesce(v_party, ''), coalesce(v_notes, ''), v_source
  ), 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0));

  select * into v_existing
  from inquiries
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_fingerprint <> v_fingerprint then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    inquiry_id := v_existing.id;
    inquiry_submitted_at := v_existing.submitted_at;
    created := false;
    out_visitor_email := v_existing.visitor_email_status;
    out_ryan_email := v_existing.ryan_email_status;
    return next;
    return;
  end if;

  select * into v_recent
  from inquiries
  where payload_fingerprint = v_fingerprint
    and submitted_at > clock_timestamp() - interval '2 minutes'
  order by submitted_at desc
  limit 1;

  if found then
    inquiry_id := v_recent.id;
    inquiry_submitted_at := v_recent.submitted_at;
    created := false;
    out_visitor_email := v_recent.visitor_email_status;
    out_ryan_email := v_recent.ryan_email_status;
    return next;
    return;
  end if;

  select count(*) into v_recent_count
  from inquiries
  where client_ip = p_client_ip
    and submitted_at > clock_timestamp() - interval '1 hour';

  if v_recent_count >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into inquiries (
    idempotency_key, payload_fingerprint, source_url, name, email, phone,
    trip, travel_when, party, notes, client_ip
  ) values (
    p_idempotency_key, v_fingerprint, v_source, v_name, v_email, v_phone,
    v_trip, v_when, v_party, v_notes, p_client_ip
  )
  returning inquiries.id, inquiries.submitted_at
  into inquiry_id, inquiry_submitted_at;

  created := true;
  out_visitor_email := 'pending';
  out_ryan_email := 'pending';
  return next;
end;
$$;

create or replace function mark_inquiry_email(
  p_id uuid,
  p_which text,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_which not in ('visitor', 'ryan') or p_status not in ('sent', 'failed') then
    raise exception 'bad_email_status' using errcode = 'P0001';
  end if;
  if p_which = 'visitor' then
    update inquiries
    set visitor_email_status = p_status
    where id = p_id
      and visitor_email_status <> 'sent';
  else
    update inquiries
    set ryan_email_status = p_status
    where id = p_id
      and ryan_email_status <> 'sent';
  end if;
end;
$$;

revoke all on table inquiries from public;
revoke all on function submit_inquiry(
  uuid, text, text, text, text, text, text, text, text, inet
) from public;
revoke all on function mark_inquiry_email(uuid, text, text) from public;
revoke all on function inquiries_stamp_submitted_at() from public;

grant execute on function submit_inquiry(
  uuid, text, text, text, text, text, text, text, text, inet
) to fmtinq;
grant execute on function mark_inquiry_email(uuid, text, text) to fmtinq;
grant select on table inquiries to ryanhocking;

-- Staff columns and functions. Does not replace submit_inquiry or mark_inquiry_email.
\ir staff.sql
