CREATE TABLE public.vehicle_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'available',
  workshop_name text,
  workshop_contact text,
  date_sent_for_repair date,
  repair_description text,
  estimated_return_date date,
  actual_return_date date,
  repair_cost numeric DEFAULT 0,
  comments text,
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('available', 'out_for_repair', 'on_route', 'off_road', 'standby'))
);

ALTER TABLE public.vehicle_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users see own org"
  ON public.vehicle_status
  FOR ALL
  TO authenticated
  USING (organisation_id = public.get_user_organisation_id());

CREATE INDEX idx_vehicle_status_vehicle_id ON public.vehicle_status(vehicle_id);
CREATE INDEX idx_vehicle_status_org ON public.vehicle_status(organisation_id);