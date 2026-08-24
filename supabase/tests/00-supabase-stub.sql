-- Minimal Supabase-shaped scaffolding so the project's migrations can be
-- replayed against a scratch Postgres for validation only.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA extensions;
CREATE SCHEMA vault;
CREATE SCHEMA net;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- Stubbed request identity: tests set app.uid to impersonate a user.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.uid', true), '')::uuid;
$$;

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'authenticated');
$$;

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean DEFAULT false
);

CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

CREATE TABLE vault.decrypted_secrets (
  name text PRIMARY KEY,
  decrypted_secret text
);

-- Records calls instead of making them, so trigger bodies are still exercised.
CREATE TABLE net._sent (id bigserial PRIMARY KEY, url text, body jsonb);
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds int DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net._sent (url, body) VALUES (url, body) RETURNING id;
$$;

GRANT USAGE ON SCHEMA public, auth, storage, net, vault, extensions TO anon, authenticated, service_role;
