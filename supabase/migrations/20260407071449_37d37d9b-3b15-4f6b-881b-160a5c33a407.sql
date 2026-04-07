
-- ============================================================
-- 1. FIX: users table - prevent org_id escalation
-- ============================================================
DROP POLICY IF EXISTS "Users see own profile" ON public.users;

-- SELECT: users can only read their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- UPDATE: users can update own profile but cannot change organisation_id
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organisation_id = (SELECT u.organisation_id FROM public.users u WHERE u.id = auth.uid()));

-- ============================================================
-- 2. FIX: Change all public-role policies to authenticated
-- ============================================================

-- alerts_log
DROP POLICY IF EXISTS "Users see own org" ON public.alerts_log;
CREATE POLICY "Authenticated users see own org" ON public.alerts_log
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- drivers
DROP POLICY IF EXISTS "Users see own org" ON public.drivers;
CREATE POLICY "Authenticated users see own org" ON public.drivers
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- driver_documents
DROP POLICY IF EXISTS "Users see own org" ON public.driver_documents;
CREATE POLICY "Authenticated users see own org" ON public.driver_documents
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- organisations
DROP POLICY IF EXISTS "Users see own org" ON public.organisations;
CREATE POLICY "Authenticated users see own org" ON public.organisations
  FOR ALL TO authenticated
  USING (id = public.get_user_organisation_id());

-- certificates
DROP POLICY IF EXISTS "Users see own org" ON public.certificates;
CREATE POLICY "Authenticated users see own org" ON public.certificates
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- fines
DROP POLICY IF EXISTS "Users see own org" ON public.fines;
CREATE POLICY "Authenticated users see own org" ON public.fines
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- vehicles
DROP POLICY IF EXISTS "Users see own org" ON public.vehicles;
CREATE POLICY "Authenticated users see own org" ON public.vehicles
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- damage_inspections
DROP POLICY IF EXISTS "Users see own org" ON public.damage_inspections;
CREATE POLICY "Authenticated users see own org" ON public.damage_inspections
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- damage_items
DROP POLICY IF EXISTS "Users see own org" ON public.damage_items;
CREATE POLICY "Authenticated users see own org" ON public.damage_items
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- custom_fields
DROP POLICY IF EXISTS "Users see own org" ON public.custom_fields;
CREATE POLICY "Authenticated users see own org" ON public.custom_fields
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- custom_field_values
DROP POLICY IF EXISTS "Users see own org" ON public.custom_field_values;
CREATE POLICY "Authenticated users see own org" ON public.custom_field_values
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- ============================================================
-- 3. FIX: audit_log - SELECT only for users, no tampering
-- ============================================================
DROP POLICY IF EXISTS "Users see own org" ON public.audit_log;
CREATE POLICY "Authenticated users can view own org audit logs" ON public.audit_log
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- ============================================================
-- 4. FIX: Storage - scope documents bucket to org path
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

CREATE POLICY "Org scoped select documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
  );

CREATE POLICY "Org scoped insert documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
  );

CREATE POLICY "Org scoped update documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
  );

CREATE POLICY "Org scoped delete documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_organisation_id()::text
  );
