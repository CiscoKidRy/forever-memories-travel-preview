"""Staff read and update API for Forever Memories Travel inquiries.

Listens on localhost port 8788 as the OS user fmtstaff.
The public inquiry process does not use this file.
The bearer token is not in this file.
"""

import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg

MAX_BODY = 8_000
STATUSES = {"new", "contacted", "planning", "booked", "closed", "spam"}
UUID_TEXT = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
AUTHOR_TEXT = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def database_url():
    url = os.environ.get("STAFF_DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("STAFF_DATABASE_URL is not set")
    return url


def token_ok(header):
    expected = os.environ.get("INQUIRY_STAFF_TOKEN", "")
    if not expected or not header or not header.startswith("Bearer "):
        return False
    presented = header[7:]
    if len(presented) != len(expected):
        return False
    diff = 0
    for left, right in zip(presented, expected):
        diff |= ord(left) ^ ord(right)
    return diff == 0


def clean_author(value):
    if not isinstance(value, str):
        return None
    author = value.strip().lower()
    if not 3 <= len(author) <= 254 or AUTHOR_TEXT.fullmatch(author) is None:
        return None
    return author


def author_for_notes(notes, raw_author):
    if not isinstance(notes, str) or not notes.strip():
        return ""
    return clean_author(raw_author)


def note_dict(row):
    created = row[2]
    deleted = row[3]
    return {
        "id": str(row[0]),
        "body": row[1],
        "created_at": created.isoformat() if created else None,
        "deleted_at": deleted.isoformat() if deleted else None,
        "created_by": row[4],
    }


def row_dict(row):
    submitted = row[1]
    updated = row[13]
    return {
        "id": str(row[0]),
        "submitted_at": submitted.isoformat() if submitted else None,
        "name": row[2],
        "email": row[3],
        "phone": row[4],
        "trip": row[5],
        "travel_when": row[6],
        "party": row[7],
        "notes": row[8],
        "visitor_email_status": row[9],
        "ryan_email_status": row[10],
        "status": row[11],
        "staff_notes": row[12],
        "staff_updated_at": updated.isoformat() if updated else None,
    }


COLUMNS = """
id, submitted_at, name, email, phone, trip, travel_when, party, notes,
visitor_email_status, ryan_email_status, status, staff_notes, staff_updated_at
"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)

    def _send(self, status, payload=None):
        body = b""
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _guard(self):
        if not token_ok(self.headers.get("Authorization")):
            self._send(401, {"error": "unauthorized"})
            return False
        return True

    def do_GET(self):
        if not self._guard():
            return
        path = self.path.split("?", 1)[0]
        if path == "/staff/inquiries":
            self._list()
            return
        prefix = "/staff/inquiries/"
        if path.startswith(prefix):
            self._get(path[len(prefix):])
            return
        self._send(404, {"error": "not_found"})

    def do_DELETE(self):
        if not self._guard():
            return
        parts = self.path.split("?", 1)[0].strip("/").split("/")
        if len(parts) == 5 and parts[0] == "staff" and parts[1] == "inquiries" and parts[3] == "notes":
            self._delete_note(parts[2], parts[4])
            return
        self._send(404, {"error": "not_found"})

    def do_PATCH(self):
        if not self._guard():
            return
        prefix = "/staff/inquiries/"
        path = self.path.split("?", 1)[0]
        if not path.startswith(prefix):
            self._send(404, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            self._send(400, {"error": "invalid"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send(400, {"error": "invalid"})
            return
        if not isinstance(payload, dict):
            self._send(400, {"error": "invalid"})
            return
        if set(payload) - {"status", "staff_notes", "author"}:
            self._send(400, {"error": "invalid"})
            return
        status = payload.get("status")
        notes = payload.get("staff_notes", "")
        if status not in STATUSES or not isinstance(notes, str) or len(notes) > 4000:
            self._send(400, {"error": "invalid"})
            return
        author = author_for_notes(notes, payload.get("author", ""))
        if author is None:
            self._send(400, {"error": "invalid"})
            return
        inquiry_id = path[len(prefix):]
        try:
            with psycopg.connect(database_url()) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "select update_inquiry_staff(%s, %s, %s, %s)",
                        (inquiry_id, status, notes, author),
                    )
                conn.commit()
        except psycopg.Error as exc:
            message = str(exc).splitlines()[0]
            if "not_found" in message:
                self._send(404, {"error": "not_found"})
                return
            self._send(400, {"error": "invalid"})
            return
        self._get(inquiry_id)

    def _list(self):
        try:
            with psycopg.connect(database_url()) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"select {COLUMNS} from list_inquiries(%s, %s)",
                        (None, 100),
                    )
                    rows = cur.fetchall()
        except psycopg.Error:
            self._send(503, {"error": "unavailable"})
            return
        self._send(200, {"inquiries": [row_dict(row) for row in rows]})

    def _delete_note(self, inquiry_id, note_id):
        if not UUID_TEXT.match(inquiry_id) or not UUID_TEXT.match(note_id):
            self._send(404, {"error": "not_found"})
            return
        try:
            with psycopg.connect(database_url()) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "select delete_staff_note(%s, %s)",
                        (inquiry_id, note_id),
                    )
                conn.commit()
        except psycopg.Error as exc:
            message = str(exc).splitlines()[0]
            if "not_found" in message:
                self._send(404, {"error": "not_found"})
                return
            self._send(400, {"error": "invalid"})
            return
        self._get(inquiry_id)

    def _note_entries(self, cur, inquiry_id):
        cur.execute(
            "select id, body, created_at, deleted_at, created_by from list_staff_notes(%s)",
            (inquiry_id,),
        )
        return [note_dict(item) for item in cur.fetchall()]

    def _get(self, inquiry_id):
        try:
            with psycopg.connect(database_url()) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"select {COLUMNS} from get_inquiry(%s)",
                        (inquiry_id,),
                    )
                    row = cur.fetchone()
                    notes = self._note_entries(cur, inquiry_id) if row is not None else []
                conn.commit()
        except psycopg.Error:
            self._send(503, {"error": "unavailable"})
            return
        if row is None:
            self._send(404, {"error": "not_found"})
            return
        payload = row_dict(row)
        payload["staff_note_entries"] = notes
        self._send(200, payload)


def main():
    host = os.environ.get("BIND", "127.0.0.1")
    port = int(os.environ.get("PORT", "8788"))
    if host not in {"127.0.0.1", "::1"}:
        raise RuntimeError("BIND must stay on localhost")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"listening on {host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
