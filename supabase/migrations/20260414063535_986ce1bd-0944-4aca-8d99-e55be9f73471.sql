
-- Job Cards table
CREATE TABLE public.job_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  job_card_number text,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  workshop_name text,
  workshop_contact text,
  job_type text NOT NULL DEFAULT 'Other',
  description text,
  parts_replaced text,
  labour_cost numeric DEFAULT 0,
  parts_cost numeric DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (COALESCE(labour_cost, 0) + COALESCE(parts_cost, 0)) STORED,
  invoice_number text,
  invoice_file_url text,
  status text NOT NULL DEFAULT 'open',
  completed_date date,
  odometer_reading integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users see own org job cards"
  ON public.job_cards FOR ALL TO authenticated
  USING (organisation_id = get_user_organisation_id());

-- Update handle_new_user to also create a Main Branch
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- If company_name is provided, create a new organisation
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL AND NEW.raw_user_meta_data->>'company_name' != '' THEN
    INSERT INTO public.organisations (name, registration_number, primary_contact_email, primary_contact_name, primary_contact_phone, subscription_status)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'brn',
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.raw_user_meta_data->>'phone',
      'active'
    )
    RETURNING id INTO _org_id;

    -- Create a default Main Branch
    INSERT INTO public.branches (name, organisation_id)
    VALUES ('Main Branch', _org_id);
  ELSE
    _org_id := (NEW.raw_user_meta_data->>'organisation_id')::uuid;
  END IF;

  INSERT INTO public.users (id, email, full_name, role, organisation_id, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'fleetcontroller'),
    _org_id,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;
