-- Add file URL columns to applications
alter table public.applications
  add column resume_url text,
  add column cover_letter_url text;

-- Make resume_text optional (file upload can replace it)
alter table public.applications
  alter column resume_text drop not null;

-- Create storage bucket for application files
insert into storage.buckets (id, name, public)
  values ('applications', 'applications', true);

-- Anyone can upload files to the applications bucket
create policy "Anyone can upload application files"
  on storage.objects for insert
  with check (bucket_id = 'applications');

-- Anyone can read application files (employers need to view them)
create policy "Anyone can read application files"
  on storage.objects for select
  using (bucket_id = 'applications');
