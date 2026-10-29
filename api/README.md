# Preview inquiry API

This copy is only for the preview site. Do not install it over `/opt/forever-memories-inquiries`. Do not apply `schema.sql` to the database `forever_memories`. Do not restart `forever-memories-inquiries.service` or `forever-memories-staff.service`.

The preview process listens on `127.0.0.1:8789`. The preview staff process listens on `127.0.0.1:8790`. Cloudflare Tunnel publishes them as `https://preview-inquiries.forevermemoriestravel.com`. The database name is `forever_memories_preview`. `MAIL_DISABLED=1` is required. A preview form post must not call Email Sending.

The live API stays on `127.0.0.1:8787` at `https://inquiries.forevermemoriestravel.com`.

The service account is `fmtinq`. It may execute `submit_inquiry` and `mark_inquiry_email`. It cannot select, update, or delete rows. The OS user `ryanhocking` can select rows through peer authentication.

The visitor confirmation and the lead notice are HTML messages with plain-text alternatives. Both use the site logo, navy, gold, sky, and paper colors. Both leave through Cloudflare Email Sending as Forever Memories Travel `<donotreply@forevermemoriestravel.com>`, with `reply_to` set to `ryanhocking@gmail.com`. The lead notice goes to `ryanhocking@gmail.com` and `jennifer@forevermemoriestravel.com`. `donotreply@` is not a mailbox. The record is [Documentation/EMAIL-SENDING.md](../Documentation/EMAIL-SENDING.md). `jennifer@forevermemoriestravel.com` and `michael@forevermemoriestravel.com` exist in Zoho. The apex MX points at Zoho. That record is [Documentation/ZOHO-MAIL.md](../Documentation/ZOHO-MAIL.md). Do not change `REPLY_TO` for that request.

The database is `forever_memories_preview` on `hp-linux-plex-server`. PostgreSQL listens on `127.0.0.1:5432` only. Do not point this API at `forever_memories`.

Secrets stay in `/etc/forever-memories-inquiries-preview.env` and `/etc/forever-memories-staff-preview.env`. Do not commit those files. Do not copy the live Email Sending token into them.

Apply `schema.sql` as the Postgres superuser with `psql -d forever_memories_preview`. Then apply `staff-note-author.sql` to that same database. Run `test_inquiries.py` with `DATABASE_URL` pointing at `forever_memories_preview` as a role that can delete test rows.
