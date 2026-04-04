
-- Add RLS policies for driver_documents
CREATE POLICY "Users see own org" ON public.driver_documents
FOR ALL USING (
  organisation_id = (SELECT users.organisation_id FROM users WHERE users.id = auth.uid())
);

-- Add RLS policies for audit_log
CREATE POLICY "Users see own org" ON public.audit_log
FOR ALL USING (
  organisation_id = (SELECT users.organisation_id FROM users WHERE users.id = auth.uid())
);

-- Enable RLS on driver_documents (in case not already enabled)
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create a trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, organisation_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'fleetcontroller'),
    (NEW.raw_user_meta_data->>'organisation_id')::uuid
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
