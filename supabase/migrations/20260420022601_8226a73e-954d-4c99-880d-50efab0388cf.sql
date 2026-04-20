-- Add last_odometer_update tracking to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_odometer_update date;

-- Backfill: set to today for existing vehicles so they don't all show stale on first load
UPDATE public.vehicles SET last_odometer_update = CURRENT_DATE WHERE last_odometer_update IS NULL;

-- Service Trackers table
CREATE TABLE IF NOT EXISTS public.vehicle_service_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  organisation_id uuid,
  tracker_name text NOT NULL,
  tracking_type text NOT NULL DEFAULT 'km', -- 'km' | 'days' | 'hours'
  interval_value numeric NOT NULL,
  last_done_value numeric,           -- km or hours
  last_done_date date,
  next_due_value numeric,            -- km or hours
  next_due_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vst_vehicle ON public.vehicle_service_trackers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vst_org ON public.vehicle_service_trackers(organisation_id);

ALTER TABLE public.vehicle_service_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view service trackers"
  ON public.vehicle_service_trackers FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can insert service trackers"
  ON public.vehicle_service_trackers FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can update service trackers"
  ON public.vehicle_service_trackers FOR UPDATE
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id())
  WITH CHECK (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can delete service trackers"
  ON public.vehicle_service_trackers FOR DELETE
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- Odometer readings history
CREATE TABLE IF NOT EXISTS public.odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  organisation_id uuid,
  reading_km integer NOT NULL,
  reading_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odom_vehicle ON public.odometer_readings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_odom_org ON public.odometer_readings(organisation_id);

ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view odometer readings"
  ON public.odometer_readings FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can insert odometer readings"
  ON public.odometer_readings FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can update odometer readings"
  ON public.odometer_readings FOR UPDATE
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

CREATE POLICY "Org members can delete odometer readings"
  ON public.odometer_readings FOR DELETE
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

-- Trigger to keep updated_at fresh on trackers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vst_updated ON public.vehicle_service_trackers;
CREATE TRIGGER trg_vst_updated
  BEFORE UPDATE ON public.vehicle_service_trackers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();