# Forever Memories Travel admin

## Preview

This Worker is the preview. Deploying it must never use the Worker name `fmt-admin` and must never attach the live D1 database. Publish stays unconfigured until a separate fine-grained GitHub token exists for `forever-memories-travel-preview` only. Do not invent a token.

The Worker name is `fmt-admin-preview`. The D1 binding is `DB` and the database name is `fmt-admin-preview`. `database_id` is `093bfa2d-b51b-43d6-bd8d-707313693600`. Do not replace it with the live D1 id. There is no cron, no queue, and no Durable Object.

Preview listing categories are family, park, cruise, international, all-inclusive, and celebration. The live Worker keeps the first four only. A later upload of this Worker must send `keep_bindings` for `secret_text` so the password pepper, setup token, and inquiry staff token stay in place.

Private staff site for page copy, drafts, images, and inquiry follow-up. The public site stays on GitHub Pages. Trip requests stay in PostgreSQL on the home laptop. This Worker does not open Postgres and it has no `inquiries` table.

## Budget

One agency, no cron, no queues, and no Durable Objects. Form posts do not hit this Worker. A month of staff use stays inside the Workers Paid included amounts: 10 million requests, 30 million CPU milliseconds, and 30 seconds on one request. D1 here is text rows only, inside the included 5 GB, 25 billion reads, and 50 million writes. Email Sending is not used.

## Password hash

Measured on this PC with `wrangler dev` 4.54.0 on 14 October 2026. One PBKDF2-HMAC-SHA-256 hash, 32-byte salt, pepper mixed in before the slow hash:

| Iterations | Time |
| --- | --- |
| 100,000 | 31 ms |
| 210,000 | 69 ms |
| 600,000 | 188 ms |

The production Workers runtime rejects a count above 100,000. A live login at 600,000 returned: "Pbkdf2 failed: iteration counts above 100000 are not supported (requested 600000)." The live setting is therefore 100,000, the highest count that runtime accepts. It measured 31 ms, under the one-second limit. Workers has no built-in Argon2. A WASM Argon2id at 19 MiB was not added. The hash parameters are stored on the staff row as `pbkdf2-sha256:100000`.

## Sign-in

The first username is `ryanhocking@gmail.com`. `POST /setup` accepts that user once, with header `Authorization: Bearer` the `SETUP_TOKEN` secret, and JSON `username` and `password`. After the setup marker exists, `POST /setup` returns 404. There is no public registration and no email password reset.

The session cookie is `fmt_session`. It is HttpOnly, Secure, and SameSite=Strict, and it lasts 12 hours. The database stores only the SHA-256 of the cookie value.

A wrong username, a wrong password, a disabled user, and a deleted user all return: That username and password did not match.

Five failures for one username, or twenty for one IP, in 15 minutes return that same text and do not run the slow hash. Login deletes attempt rows older than two days.

## Lockout recovery

No password belongs in this command. Replace the username if it is not the first account. This command is for the preview database `fmt-admin-preview` only. Do not run it against the live database.

```
npx wrangler d1 execute fmt-admin-preview --remote --command "UPDATE staff SET disabled = 0 WHERE username = 'THE_USER'"
```

If the password itself is lost, set a new one with a local script that hashes the same way the Worker hashes, then `wrangler d1 execute`. Do not add an unauthenticated reset route.

## Accounts

The Account page lists every staff user. Another signed-in user can reset a password, disable, enable, delete, or restore. The reset button shows a temporary password once on that page. The CMS does not email it. `must_change_password` is set, and that user's sessions end.

Delete sets `deleted_at` and keeps the row for 432000 seconds, which is 5 days of 86400 seconds. The row is grey, darker than a disabled row. Restore during that hold clears `deleted_at` only. A disabled account stays disabled. The next sign-in or account-page load deletes the row and its sessions after the hold. There is no cron. A purged username can be added again.

`last_login_at` is set only after a successful sign-in. The activity window shows the newest 500 `staff_audit` rows: sign-in, sign-out, and changes. It does not store passwords, note text, or document bodies. Opening a page does not add a line. You cannot reset, disable, or delete your own row. At least one account that can sign in has to remain.

## Secrets

`PASSWORD_PEPPER`, `SETUP_TOKEN`, and, when Ryan creates them, `GITHUB_TOKEN`, `INQUIRY_STAFF_TOKEN`, and `GA_SERVICE_ACCOUNT_JSON`. Put them on the Worker with `wrangler secret put`. Do not commit `.dev.vars`. This preview copy does not add those secrets. Do not add a Google service account.

`GITHUB_TOKEN` is a fine-grained token for `CiscoKidRy/forever-memories-travel-preview` only, Contents read and write, no Administration, Workflows, or Secrets. It is not the live repository token. Until that preview token exists, publish and image upload return 503 with the text "GitHub publishing is not configured." Drafts still save.

## Inquiries

The Worker calls `https://preview-inquiries.forevermemoriestravel.com/staff/*` only after the staff cookie is valid. The browser never sees the bearer. If the laptop or the staff path is down, the screen says "The inquiry store is not reachable." It does not show zero.

## Statistics

`GET /api/statistics` reads Google Analytics property `properties/558909334` for the last 28 days only when `GA_SERVICE_ACCOUNT_JSON` is present. This preview does not have that secret. The Statistics screen then says "Statistics are not collected on the preview." A disabled API or a Google error, if a service account were present, still returns "Statistics are not reachable." A dash on the screen means no row yet. Do not store the report.
