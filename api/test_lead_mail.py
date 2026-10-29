"""Lead notice delivery without a socket or a database."""

import json
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import psycopg  # noqa: F401
except ModuleNotFoundError:
    stub = types.ModuleType("psycopg")
    stub.Error = Exception
    stub.connect = lambda *args, **kwargs: None
    sys.modules["psycopg"] = stub

import app


FIELDS = {
    "email": "guest@example.com",
    "name": "Guest Example",
    "phone": None,
    "trip": "Cruise",
    "when": None,
    "who": None,
    "notes": None,
    "source_url": "https://preview.forevermemoriestravel.com/",
}
STORED = {
    "created": True,
    "id": "00000000-0000-4000-8000-000000000001",
    "submitted_at": datetime(2026, 10, 27, 20, 0, 39, tzinfo=timezone.utc),
    "visitor_email": "pending",
    "ryan_email": "pending",
}
WHEN = "October 27, 2026 at 2:00 PM MDT"


class Response:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def accepted(recipient):
    return Response({
        "success": True,
        "result": {"delivered": [], "queued": [recipient], "permanent_bounces": []},
    })


class LeadMailTests(unittest.TestCase):
    def deliver(self, urlopen, mail_disabled=""):
        env = {"MAIL_DISABLED": mail_disabled, "CLOUDFLARE_EMAIL_API_TOKEN": "test-token"}
        with patch.object(app, "format_when", return_value=WHEN), patch.dict(
            app.os.environ, env, clear=False
        ), patch.object(app.urllib.request, "urlopen", urlopen), patch.object(
            app, "mark_email"
        ) as mark, patch.object(app.traceback, "print_exc"):
            visitor, ryan = app.deliver(FIELDS, STORED)
        return visitor, ryan, mark

    def test_mail_disabled_does_not_open_a_socket(self):
        def refuse(*args, **kwargs):
            raise AssertionError("network opened")

        visitor, ryan, mark = self.deliver(refuse, mail_disabled="1")
        self.assertEqual((visitor, ryan), ("failed", "failed"))
        self.assertEqual(mark.call_args_list[0].args, (STORED["id"], "visitor", "failed"))
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "failed"))

    def test_replay_does_not_send(self):
        replay = dict(STORED, created=False, visitor_email="sent", ryan_email="sent")
        with patch.object(app, "send_mail") as send, patch.object(app, "mark_email") as mark:
            visitor, ryan = app.deliver(FIELDS, replay)
        send.assert_not_called()
        mark.assert_not_called()
        self.assertEqual((visitor, ryan), ("sent", "sent"))

    def test_both_accepted(self):
        seen = []

        def urlopen(request, timeout=20):
            payload = json.loads(request.data.decode("utf-8"))
            seen.append(payload)
            return accepted(payload["to"])

        visitor, ryan, mark = self.deliver(urlopen)
        self.assertEqual((visitor, ryan), ("sent", "sent"))
        self.assertEqual([item["subject"] for item in seen], [
            "We have your trip request",
            "Trip request — Forever Memories Travel",
            "Trip request — Forever Memories Travel",
        ])
        self.assertEqual([item["to"] for item in seen], [
            "guest@example.com",
            "ryanhocking@gmail.com",
            "jennifer@forevermemoriestravel.com",
        ])
        self.assertTrue(all(item["reply_to"] == "ryanhocking@gmail.com" for item in seen))
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "sent"))

    def _one_lead_fails(self, failing):
        seen = []

        def urlopen(request, timeout=20):
            payload = json.loads(request.data.decode("utf-8"))
            seen.append(payload["to"])
            if payload["to"] == failing:
                raise app.urllib.error.URLError("down")
            return accepted(payload["to"])

        visitor, ryan, mark = self.deliver(urlopen)
        self.assertEqual(visitor, "sent")
        self.assertEqual(ryan, "failed")
        self.assertEqual(seen, [
            "guest@example.com",
            "ryanhocking@gmail.com",
            "jennifer@forevermemoriestravel.com",
        ])
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "failed"))

    def test_ryan_failure_still_sends_to_jennifer(self):
        self._one_lead_fails("ryanhocking@gmail.com")

    def test_jennifer_failure_still_sends_to_ryan(self):
        self._one_lead_fails("jennifer@forevermemoriestravel.com")


if __name__ == "__main__":
    unittest.main()
