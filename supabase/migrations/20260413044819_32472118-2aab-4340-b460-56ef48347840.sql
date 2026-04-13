
-- Create toolbox_talks table for driver toolbox talk records
CREATE TABLE public.toolbox_talks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid REFERENCES public.organisations(id),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  topic text NOT NULL,
  date_conducted date NOT NULL DEFAULT CURRENT_DATE,
  conducted_by text,
  file_url text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.toolbox_talks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users see own org toolbox talks"
  ON public.toolbox_talks FOR ALL TO authenticated
  USING (organisation_id = get_user_organisation_id());

-- Add equipment JSON column to vehicles table
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS equipment jsonb DEFAULT '[]'::jsonb;
