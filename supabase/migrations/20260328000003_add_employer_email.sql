-- Add email column to employers so admins can search/view employer emails
ALTER TABLE public.employers ADD COLUMN email text;

-- Backfill from auth.users (runs as migration with elevated privileges)
UPDATE public.employers
SET email = u.email
FROM auth.users u
WHERE u.id = employers.user_id;
