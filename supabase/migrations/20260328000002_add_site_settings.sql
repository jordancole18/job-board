-- Site settings table for admin-configurable values
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed with the approval notification email (empty = disabled)
INSERT INTO public.site_settings (key, value) VALUES ('approval_notification_email', '');

-- RLS: anyone can read settings, only admins can update
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON public.site_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.user_id = auth.uid()
      AND employers.is_admin = true
    )
  );

-- Grant table access
GRANT SELECT, UPDATE ON public.site_settings TO anon, authenticated;
