
-- 1. Create a security definer function to get user's org_id for storage policies
CREATE OR REPLACE FUNCTION public.get_user_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM public.users WHERE id = auth.uid()
$$;

-- 2. Fix storage policies on storage.objects
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;

-- Recreate SELECT policy: only allow reading files in your org's folder
CREATE POLICY "Users can view own org files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
);

-- Recreate INSERT policy: only allow uploading to your org's folder
CREATE POLICY "Users can upload to own org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
);

-- 3. Fix compliance_templates SELECT policy
DROP POLICY IF EXISTS "Anyone can read templates" ON public.compliance_templates;

-- System templates (no org) readable by authenticated users; custom templates only by own org
CREATE POLICY "Authenticated users read templates"
ON public.compliance_templates FOR SELECT
TO authenticated
USING (
  organisation_id IS NULL
  OR organisation_id = (SELECT organisation_id FROM public.users WHERE id = auth.uid())
);
