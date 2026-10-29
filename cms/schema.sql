-- Staff sign-in, drafts, and media metadata.
-- There is no inquiries table. Trip requests stay on the home laptop.

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  hash_params TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  deleted_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('section', 'step', 'story', 'listing', 'plan', 'agency')),
  slug TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  body_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE UNIQUE INDEX documents_slug ON documents (kind, slug) WHERE slug IS NOT NULL;

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  repo_path TEXT NOT NULL UNIQUE,
  alt TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  git_sha TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT NOT NULL,
  succeeded INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX login_attempts_user ON login_attempts (username, created_at);
CREATE INDEX login_attempts_ip ON login_attempts (ip, created_at);

CREATE TABLE staff_audit (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE INDEX staff_audit_at ON staff_audit (at);
