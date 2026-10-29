"""Local inquiry API for Forever Memories Travel.

Listens on localhost. Cloudflare Tunnel is the public door.
The database password is not in this file.
"""

import json
import os
import re
import traceback
import urllib.error
import urllib.request
from datetime import datetime
from html import escape
from string import Template
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import ip_address
from zoneinfo import ZoneInfo

import psycopg

ALLOWED_ORIGINS = {
    "https://preview.forevermemoriestravel.com",
}
TRIPS = {
    "Family vacation",
    "Theme park",
    "Cruise",
    "International",
    "Not sure yet",
}
SOURCE_URL = re.compile(
    r"^https://preview\.forevermemoriestravel\.com(/[^\s]*)?$"
)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
LIMITS = {
    "name": 200,
    "email": 254,
    "phone": 40,
    "when": 300,
    "who": 400,
    "notes": 4000,
}
DENVER = ZoneInfo("America/Denver")
MAX_BODY = 32_000
EMAIL_SEND_URL = (
    "https://api.cloudflare.com/client/v4/accounts/"
    "aac0196dfd6a1ccec84b92a22602ffb3/email/sending/send"
)
FROM_ADDRESS = "donotreply@forevermemoriestravel.com"
FROM_NAME = "Forever Memories Travel"
REPLY_TO = "ryanhocking@gmail.com"
LEAD_NOTICE_SUBJECT = "Trip request — Forever Memories Travel"
LEAD_NOTICE_TO = (
    "ryanhocking@gmail.com",
    "jennifer@forevermemoriestravel.com",
)


def database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def clean(value, limit, required):
    if value is None:
        text = ""
    elif not isinstance(value, str):
        raise ValueError("invalid")
    else:
        text = value.strip()
    if len(text) > limit:
        raise ValueError("too_long")
    if required and not text:
        raise ValueError("required")
    return text


def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError("invalid")
    company = payload.get("company")
    if isinstance(company, str) and company.strip():
        return {"honeypot": True}
    name = clean(payload.get("name"), LIMITS["name"], True)
    email = clean(payload.get("email"), LIMITS["email"], True).lower()
    if not EMAIL.match(email):
        raise ValueError("email")
    phone = clean(payload.get("phone"), LIMITS["phone"], False)
    trip = clean(payload.get("trip"), 40, True)
    if trip not in TRIPS:
        raise ValueError("trip")
    travel_when = clean(payload.get("when"), LIMITS["when"], False)
    party = clean(payload.get("who"), LIMITS["who"], False)
    notes = clean(payload.get("notes"), LIMITS["notes"], False)
    source = clean(payload.get("source_url"), 500, True)
    if not SOURCE_URL.match(source):
        raise ValueError("source")
    key = clean(payload.get("idempotency_key"), 36, True).lower()
    if not UUID.match(key):
        raise ValueError("key")
    return {
        "honeypot": False,
        "name": name,
        "email": email,
        "phone": phone,
        "trip": trip,
        "when": travel_when,
        "who": party,
        "notes": notes,
        "source_url": source,
        "idempotency_key": key,
    }


def client_ip(headers, peer):
    forwarded = headers.get("CF-Connecting-IP") or headers.get("Cf-Connecting-Ip")
    if forwarded:
        try:
            return str(ip_address(forwarded.strip()))
        except ValueError:
            pass
    host = peer[0] if isinstance(peer, tuple) else peer
    if host.startswith("::ffff:"):
        host = host[7:]
    return str(ip_address(host))


def submit(fields, address):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select inquiry_id, inquiry_submitted_at, created,
                       out_visitor_email, out_ryan_email
                from submit_inquiry(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    fields["idempotency_key"],
                    fields["source_url"],
                    fields["name"],
                    fields["email"],
                    fields["phone"],
                    fields["trip"],
                    fields["when"],
                    fields["who"],
                    fields["notes"],
                    address,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return {
        "id": str(row[0]),
        "submitted_at": row[1],
        "created": bool(row[2]),
        "visitor_email": row[3],
        "ryan_email": row[4],
    }


def mark_email(inquiry_id, which, status):
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select mark_inquiry_email(%s, %s, %s)",
                (inquiry_id, which, status),
            )
        conn.commit()


def format_when(moment):
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZoneInfo("UTC"))
    return moment.astimezone(DENVER).strftime("%B %-d, %Y at %-I:%M %p %Z")


class MailOff(Exception):
    pass


SITE_URL = "https://preview.forevermemoriestravel.com"
LOGO_URL = "https://preview.forevermemoriestravel.com/assets/design/crest.png"
VISITOR_HTML = Template("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>We have your trip request</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Nunito+Sans:wght@400;700&display=swap">
</head>
<body style="margin:0;padding:0;background-color:#f7f4ee;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f7f4ee;">Colorado Springs travel agency. We will reply to this email address.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ee" style="margin:0;border-collapse:collapse;background-color:#f7f4ee;">
    <tr>
      <td align="center" bgcolor="#f7f4ee" style="padding:28px 12px;background-color:#f7f4ee;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">
          <tr>
            <td height="4" bgcolor="#279fba" style="height:4px;font-size:0;line-height:0;background-color:#279fba;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 28px 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#074570;">Colorado Springs travel agency</td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px 20px;">
              <img src="$logo" width="280" height="280" alt="Forever Memories Travel. Family vacations, theme parks, cruises, and international travel." style="display:block;width:280px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;line-height:1.15;font-weight:500;color:#042c48;">The request starts the conversation.</td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:17px;line-height:1.6;color:#1c2830;">Hello $name. Forever Memories Travel has your trip request.</td>
          </tr>
          <tr>
            <td style="padding:12px 36px 8px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:17px;line-height:1.6;color:#1c2830;">We plan family vacations, theme parks, cruises, and international travel around the people going. We shape the plan with you.</td>
          </tr>
          <tr>
            <td style="padding:20px 36px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ee" style="width:100%;border-collapse:collapse;background-color:#f7f4ee;">
                <tr>
                  <td height="3" bgcolor="#d59d3b" style="height:3px;font-size:0;line-height:0;background-color:#d59d3b;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:16px 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Name</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$name</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Reference</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 14px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$reference</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Received</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 14px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$received</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Trip</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 18px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$trip</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px 8px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:17px;line-height:1.6;color:#1c2830;">Forever Memories Travel will reply to this email address. The reply goes to the address you entered.</td>
          </tr>
          <tr>
            <td align="left" style="padding:18px 36px 32px;">
              <a href="$site" style="display:inline-block;background-color:#074570;color:#ffffff;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;font-weight:700;line-height:1;text-decoration:none;padding:14px 22px;">Back to the site</a>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#074570" style="padding:26px 28px 32px;background-color:#074570;font-family:'Nunito Sans','Segoe UI',sans-serif;color:#ffffff;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:24px;line-height:1.2;color:#ffffff;">Forever Memories Travel</p>
              <p style="margin:8px 0 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#ffffff;">Colorado Springs · Family vacations · Theme parks · Cruises · International travel</p>
              <p style="margin:12px 0 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:15px;line-height:1.5;"><a href="$site" style="color:#ffffff;text-decoration:underline;">forevermemoriestravel.com</a></p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
""")


def visitor_plain(fields, stored, when):
    return "\n".join([
        "The request starts the conversation.",
        "",
        f"Hello {fields['name']}. Forever Memories Travel has your trip request.",
        "",
        "We plan family vacations, theme parks, cruises, and international travel around the people going. We shape the plan with you.",
        "",
        f"Reference: {stored['id']}",
        f"Received: {when}",
        f"Trip: {fields['trip']}",
        "",
        "Forever Memories Travel will reply to this email address. The reply goes to the address you entered.",
        "",
        SITE_URL,
    ])


def visitor_html(fields, stored, when):
    return VISITOR_HTML.substitute(
        logo=LOGO_URL,
        site=SITE_URL,
        name=escape(fields["name"]),
        reference=escape(str(stored["id"])),
        received=escape(when),
        trip=escape(fields["trip"]),
    )


def html_text(value):
    text = value.strip() if value else ""
    if not text:
        return "(none)"
    return "<br>".join(escape(line) for line in text.splitlines())


LEAD_HTML = Template("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trip request — Forever Memories Travel</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Nunito+Sans:wght@400;700&display=swap">
</head>
<body style="margin:0;padding:0;background-color:#f7f4ee;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f7f4ee;">New trip request from $name.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ee" style="margin:0;border-collapse:collapse;background-color:#f7f4ee;">
    <tr>
      <td align="center" bgcolor="#f7f4ee" style="padding:28px 12px;background-color:#f7f4ee;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">
          <tr>
            <td height="4" bgcolor="#279fba" style="height:4px;font-size:0;line-height:0;background-color:#279fba;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 28px 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#074570;">Colorado Springs travel agency</td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px 20px;">
              <img src="$logo" width="280" height="280" alt="Forever Memories Travel. Family vacations, theme parks, cruises, and international travel." style="display:block;width:280px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;line-height:1.15;font-weight:500;color:#042c48;">New trip request</td>
          </tr>
          <tr>
            <td style="padding:20px 36px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f4ee" style="width:100%;border-collapse:collapse;background-color:#f7f4ee;">
                <tr>
                  <td height="3" bgcolor="#d59d3b" style="height:3px;font-size:0;line-height:0;background-color:#d59d3b;">&nbsp;</td>
                </tr>
                <tr><td style="padding:16px 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Reference</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$reference</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Received</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$received</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Name</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$name</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Email</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$email</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Phone</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$phone</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Trip</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$trip</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">When</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$travel_when</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Who</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$who</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Notes</td></tr>
                <tr><td style="padding:0 20px 12px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$notes</td></tr>
                <tr><td style="padding:0 20px 6px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#074570;">Page</td></tr>
                <tr><td style="padding:0 20px 18px;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c2830;">$page</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#074570" style="padding:26px 28px 32px;background-color:#074570;font-family:'Nunito Sans','Segoe UI',sans-serif;color:#ffffff;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:24px;line-height:1.2;color:#ffffff;">Forever Memories Travel</p>
              <p style="margin:8px 0 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#ffffff;">Colorado Springs · Family vacations · Theme parks · Cruises · International travel</p>
              <p style="margin:12px 0 0;font-family:'Nunito Sans','Segoe UI',sans-serif;font-size:15px;line-height:1.5;"><a href="$site" style="color:#ffffff;text-decoration:underline;">forevermemoriestravel.com</a></p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
""")


def lead_plain(fields, stored, when):
    return "\n".join([
        "New trip request",
        f"Reference: {stored['id']}",
        f"Received: {when}",
        f"Name: {fields['name']}",
        f"Email: {fields['email']}",
        f"Phone: {fields['phone'] or '(none)'}",
        f"Trip: {fields['trip']}",
        f"When: {fields['when'] or '(none)'}",
        f"Who: {fields['who'] or '(none)'}",
        f"Notes: {fields['notes'] or '(none)'}",
        f"Page: {fields['source_url']}",
    ])


def lead_html(fields, stored, when):
    email = escape(fields["email"])
    page = escape(fields["source_url"])
    return LEAD_HTML.substitute(
        logo=LOGO_URL,
        site=SITE_URL,
        name=escape(fields["name"]),
        email=f'<a href="mailto:{email}" style="color:#074570;text-decoration:underline;">{email}</a>',
        phone=html_text(fields["phone"]),
        trip=escape(fields["trip"]),
        travel_when=html_text(fields["when"]),
        who=html_text(fields["who"]),
        notes=html_text(fields["notes"]),
        reference=escape(str(stored["id"])),
        received=escape(when),
        page=f'<a href="{page}" style="color:#074570;text-decoration:underline;">{page}</a>',
    )


def email_accepted(payload, recipient):
    if not isinstance(payload, dict) or payload.get("success") is not True:
        return False
    result = payload.get("result")
    if not isinstance(result, dict):
        return False
    bounced = result.get("permanent_bounces") or []
    if recipient in bounced:
        return False
    delivered = result.get("delivered") or []
    queued = result.get("queued") or []
    return recipient in delivered or recipient in queued


def send_mail(recipient, subject, body, html_body=None):
    if os.environ.get("MAIL_DISABLED", "").strip() == "1":
        raise MailOff()
    token = os.environ.get("CLOUDFLARE_EMAIL_API_TOKEN", "").strip()
    if not token or not html_body:
        raise RuntimeError("mail is not configured")
    payload = {
        "from": {"address": FROM_ADDRESS, "name": FROM_NAME},
        "to": recipient,
        "reply_to": REPLY_TO,
        "subject": subject,
        "text": body,
        "html": html_body,
    }
    request = urllib.request.Request(
        EMAIL_SEND_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        exc.read()
        raise RuntimeError(f"email send failed: HTTP {exc.code}") from None
    except urllib.error.URLError:
        raise RuntimeError("email send failed: network") from None
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        raise RuntimeError("email send failed: bad response") from None
    if not email_accepted(parsed, recipient):
        raise RuntimeError("email send failed: not accepted")


def deliver(fields, stored):
    if not stored["created"]:
        return stored["visitor_email"], stored["ryan_email"]
    when = format_when(stored["submitted_at"])
    visitor_status = "failed"
    ryan_status = "sent"
    try:
        send_mail(
            fields["email"],
            "We have your trip request",
            visitor_plain(fields, stored, when),
            visitor_html(fields, stored, when),
        )
        visitor_status = "sent"
    except MailOff:
        visitor_status = "failed"
    except Exception:
        traceback.print_exc()
    for recipient in LEAD_NOTICE_TO:
        try:
            send_mail(
                recipient,
                LEAD_NOTICE_SUBJECT,
                lead_plain(fields, stored, when),
                lead_html(fields, stored, when),
            )
        except MailOff:
            ryan_status = "failed"
        except Exception:
            traceback.print_exc()
            ryan_status = "failed"
    try:
        mark_email(stored["id"], "visitor", visitor_status)
        mark_email(stored["id"], "ryan", ryan_status)
    except Exception:
        traceback.print_exc()
    return visitor_status, ryan_status


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)

    def handle_error(self, request, client_address):
        traceback.print_exc()

    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")

    def _send(self, status, payload=None):
        body = b""
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if self.path.split("?", 1)[0] != "/inquiries":
            self._send(404, {"error": "not_found"})
            return
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/health":
            self._send(404, {"error": "not_found"})
            return
        try:
            with psycopg.connect(database_url()) as conn:
                with conn.cursor() as cur:
                    cur.execute("select 1")
                    cur.fetchone()
        except Exception:
            traceback.print_exc()
            self._send(503, {"ok": False})
            return
        self._send(200, {"ok": True})

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/inquiries":
            self._send(404, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            self._send(400, {"error": "invalid"})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
            fields = validate(payload)
        except (ValueError, UnicodeError, json.JSONDecodeError):
            self._send(400, {"error": "invalid"})
            return
        if fields["honeypot"]:
            self._send(400, {"error": "invalid"})
            return
        try:
            address = client_ip(self.headers, self.client_address)
        except ValueError:
            self._send(400, {"error": "invalid"})
            return
        try:
            stored = submit(fields, address)
        except psycopg.Error as exc:
            message = str(exc).splitlines()[0]
            if "rate_limited" in message:
                self._send(429, {"error": "rate_limited"})
                return
            if "idempotency_conflict" in message:
                self._send(409, {"error": "conflict"})
                return
            traceback.print_exc()
            self._send(400, {"error": "invalid"})
            return
        except Exception:
            traceback.print_exc()
            self._send(503, {"error": "unavailable"})
            return
        visitor_status, ryan_status = deliver(fields, stored)
        self._send(201, {
            "id": stored["id"],
            "submitted_at": stored["submitted_at"].isoformat(),
            "visitor_email": visitor_status,
            "ryan_email": ryan_status,
        })


def main():
    host = os.environ.get("BIND", "127.0.0.1")
    port = int(os.environ.get("PORT", "8787"))
    if host not in {"127.0.0.1", "::1"}:
        raise RuntimeError("BIND must stay on localhost")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"listening on {host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
