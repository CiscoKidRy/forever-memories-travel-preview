"""Lead notice recipients. Does not open a socket and does not need the database."""

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
import staff_api


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


class LeadNoticeTests(unittest.TestCase):
    def test_both_addresses_and_subject(self):
        self.assertEqual(
            app.LEAD_NOTICE_TO,
            ("ryanhocking@gmail.com", "jennifer@forevermemoriestravel.com"),
        )
        self.assertEqual(app.LEAD_NOTICE_SUBJECT, "Trip request — Forever Memories Travel")
        self.assertEqual(app.REPLY_TO, "ryanhocking@gmail.com")

    def test_both_sends_mark_sent(self):
        calls = []

        def fake_send(recipient, subject, body, html_body=None):
            calls.append((recipient, subject))

        with patch.object(app, "format_when", return_value="October 27, 2026 at 2:00 PM MDT"), patch.object(
            app, "send_mail", fake_send
        ), patch.object(app, "mark_email") as mark:
            visitor, ryan = app.deliver(FIELDS, STORED)
        self.assertEqual(visitor, "sent")
        self.assertEqual(ryan, "sent")
        self.assertEqual(
            calls,
            [
                ("guest@example.com", "We have your trip request"),
                ("ryanhocking@gmail.com", "Trip request — Forever Memories Travel"),
                ("jennifer@forevermemoriestravel.com", "Trip request — Forever Memories Travel"),
            ],
        )
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "sent"))

    def test_one_lead_failure_still_tries_the_other(self):
        calls = []

        def fake_send(recipient, subject, body, html_body=None):
            calls.append(recipient)
            if recipient == "ryanhocking@gmail.com":
                raise RuntimeError("down")

        with patch.object(app, "format_when", return_value="October 27, 2026 at 2:00 PM MDT"), patch.object(
            app, "send_mail", fake_send
        ), patch.object(app, "mark_email") as mark, patch.object(app.traceback, "print_exc"):
            visitor, ryan = app.deliver(FIELDS, STORED)
        self.assertEqual(visitor, "sent")
        self.assertEqual(ryan, "failed")
        self.assertEqual(
            calls,
            ["guest@example.com", "ryanhocking@gmail.com", "jennifer@forevermemoriestravel.com"],
        )
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "failed"))

    def test_mail_disabled_does_not_open_a_socket(self):
        opened = []

        def refuse(*args, **kwargs):
            opened.append(args)
            raise AssertionError("network opened")

        with patch.object(app, "format_when", return_value="October 27, 2026 at 2:00 PM MDT"), patch.dict(
            app.os.environ, {"MAIL_DISABLED": "1"}
        ), patch.object(app.urllib.request, "urlopen", refuse), patch.object(app, "mark_email") as mark:
            visitor, ryan = app.deliver(FIELDS, STORED)
        self.assertEqual(opened, [])
        self.assertEqual(visitor, "failed")
        self.assertEqual(ryan, "failed")
        self.assertEqual(mark.call_args_list[1].args, (STORED["id"], "ryan", "failed"))

    def test_replay_does_not_send(self):
        replay = dict(STORED, created=False, visitor_email="sent", ryan_email="sent")
        with patch.object(app, "send_mail") as send, patch.object(app, "mark_email") as mark:
            visitor, ryan = app.deliver(FIELDS, replay)
        send.assert_not_called()
        mark.assert_not_called()
        self.assertEqual((visitor, ryan), ("sent", "sent"))


class AuthorTests(unittest.TestCase):
    def test_clean_author(self):
        self.assertEqual(
            staff_api.clean_author("  Jennifer@ForeverMemoriesTravel.com "),
            "jennifer@forevermemoriestravel.com",
        )
        self.assertIsNone(staff_api.clean_author(""))
        self.assertIsNone(staff_api.clean_author("has space@example.com"))
        self.assertIsNone(staff_api.clean_author("missing-at.example.com"))
        self.assertIsNone(staff_api.clean_author("a@b"))
        self.assertIsNone(staff_api.clean_author("x" * 250 + "@example.com"))
        self.assertEqual(staff_api.author_for_notes("   ", "not-an-email"), "")
        self.assertEqual(
            staff_api.author_for_notes("Saved", "RyanHocking@gmail.com"),
            "ryanhocking@gmail.com",
        )
        self.assertIsNone(staff_api.author_for_notes("Saved", "not an email"))


if __name__ == "__main__":
    unittest.main()
