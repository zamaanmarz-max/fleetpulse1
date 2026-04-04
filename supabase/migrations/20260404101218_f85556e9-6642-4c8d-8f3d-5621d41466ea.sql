
-- Update handle_new_user trigger to auto-create organisation when company_name is provided
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
    INSERT INTO public.organisations (name, registration_number, primary_contact_email, primary_contact_name)
    VALUES (
      NEW.raw_user_meta_data->>'company_name',
      NEW.raw_user_meta_data->>'brn',
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    RETURNING id INTO _org_id;
  ELSE
    _org_id := (NEW.raw_user_meta_data->>'organisation_id')::uuid;
  END IF;

  INSERT INTO public.users (id, email, full_name, role, organisation_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'fleetcontroller'),
    _org_id
  );
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
