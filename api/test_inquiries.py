"""Database rules for trip requests. Requires DATABASE_URL and the schema."""

import os
import unittest
import uuid
from datetime import timedelta

import psycopg

IP = "203.0.113.50"
SOURCE = "https://preview.forevermemoriestravel.com/"


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def submit(cur, key, name, ip=IP, source=SOURCE, trip="Cruise", email="guest@example.com"):
    cur.execute(
        """
        select inquiry_id, created
        from submit_inquiry(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (key, source, name, email, None, trip, "June", "2 adults", "A quiet week", ip),
    )
    return cur.fetchone()


class InquiryTests(unittest.TestCase):
    def setUp(self):
        if not os.environ.get("DATABASE_URL"):
            self.skipTest("DATABASE_URL is not set")
        self.conn = connect()
        self.cur = self.conn.cursor()
        self.cur.execute("delete from inquiries where client_ip = %s", (IP,))
        self.conn.commit()

    def tearDown(self):
        if hasattr(self, "cur"):
            self.cur.execute("delete from inquiries where client_ip = %s", (IP,))
            self.conn.commit()
            self.cur.close()
            self.conn.close()

    def test_insert_and_replay(self):
        key = str(uuid.uuid4())
        first_id, created = submit(self.cur, key, "Ada Lovelace")
        self.conn.commit()
        self.assertTrue(created)
        second_id, again = submit(self.cur, key, "Ada Lovelace")
        self.conn.commit()
        self.assertFalse(again)
        self.assertEqual(first_id, second_id)
        self.cur.execute(
            "select submitted_at from inquiries where id = %s",
            (first_id,),
        )
        stored = self.cur.fetchone()[0]
        self.assertIsNotNone(stored.tzinfo)

    def test_same_key_different_body_conflicts(self):
        key = str(uuid.uuid4())
        submit(self.cur, key, "Ada Lovelace")
        self.conn.commit()
        with self.assertRaises(psycopg.Error) as caught:
            submit(self.cur, key, "Grace Hopper")
            self.conn.commit()
        self.assertIn("idempotency_conflict", str(caught.exception))
        self.conn.rollback()

    def test_same_body_inside_two_minutes_is_one_row(self):
        first_id, created = submit(self.cur, str(uuid.uuid4()), "Grace Hopper")
        self.conn.commit()
        self.assertTrue(created)
        second_id, again = submit(self.cur, str(uuid.uuid4()), "Grace Hopper")
        self.conn.commit()
        self.assertFalse(again)
        self.assertEqual(first_id, second_id)

    def test_same_body_after_two_minutes_is_a_second_row(self):
        first_id, _created = submit(self.cur, str(uuid.uuid4()), "Katherine Johnson")
        self.conn.commit()
        self.cur.execute(
            "update inquiries set submitted_at = submitted_at - %s where id = %s",
            (timedelta(minutes=5), first_id),
        )
        self.conn.commit()
        second_id, created = submit(self.cur, str(uuid.uuid4()), "Katherine Johnson")
        self.conn.commit()
        self.assertTrue(created)
        self.assertNotEqual(first_id, second_id)

    def test_rate_limit(self):
        for index in range(5):
            _row_id, created = submit(self.cur, str(uuid.uuid4()), f"Person {index}")
            self.conn.commit()
            self.assertTrue(created)
        with self.assertRaises(psycopg.Error) as caught:
            submit(self.cur, str(uuid.uuid4()), "Person 6")
            self.conn.commit()
        self.assertIn("rate_limited", str(caught.exception))
        self.conn.rollback()

    def test_trigger_replaces_client_time(self):
        key = str(uuid.uuid4())
        self.cur.execute(
            """
            insert into inquiries (
              idempotency_key, payload_fingerprint, source_url, name, email,
              trip, client_ip, submitted_at
            ) values (
              %s, repeat('ab', 32), %s, 'Trigger Test', 'trigger@example.com',
              'Cruise', %s, '2001-01-01T00:00:00Z'
            ) returning submitted_at
            """,
            (key, SOURCE, IP),
        )
        stored = self.cur.fetchone()[0]
        self.conn.commit()
        self.assertGreater(stored.year, 2001)


if __name__ == "__main__":
    unittest.main()
