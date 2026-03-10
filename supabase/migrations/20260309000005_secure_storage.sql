-- Make the applications bucket private so files aren't publicly accessible
update storage.buckets
  set public = false
  where id = 'applications';

-- Drop the open read policy
drop policy if exists "Anyone can read application files" on storage.objects;

-- Only authenticated users can read files in the applications bucket
create policy "Authenticated users can read application files"
  on storage.objects for select
  using (bucket_id = 'applications' and auth.role() = 'authenticated');
