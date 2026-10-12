CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  password text NOT NULL, role text NOT NULL CHECK(role IN ('admin','seller')),
  active boolean NOT NULL DEFAULT true, must_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS attempts (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets (
  token text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY, identity text NOT NULL UNIQUE, cnpj text UNIQUE, name text NOT NULL,
  city text NOT NULL, state char(2) NOT NULL, segment text NOT NULL, size text NOT NULL,
  phone text NOT NULL DEFAULT '', whatsapp text NOT NULL DEFAULT '', website text NOT NULL DEFAULT '',
  source_url text NOT NULL, structure text NOT NULL DEFAULT '', pumping boolean, fleet boolean, branches boolean,
  verified_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS companies_region_segment_idx ON companies(state, segment, city);
CREATE TABLE IF NOT EXISTS leads (
  company_id text PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  saved_by text NOT NULL REFERENCES users(id), saved_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  equipment_interest text NOT NULL DEFAULT '',
  contact_result text NOT NULL DEFAULT '',
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE lead_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  equipment_interest text NOT NULL DEFAULT '',
  contact_result text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_activities_company ON lead_activities(company_id, created_at DESC);
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message_id text UNIQUE,
  direction text NOT NULL CHECK(direction IN ('in','out')),
  body text NOT NULL,
  user_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_company ON whatsapp_messages(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id text, action text NOT NULL,
  target text, created_at timestamptz NOT NULL DEFAULT now()
);
