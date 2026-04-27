ALTER TABLE public.toolbox_talks
ADD COLUMN IF NOT EXISTS issue_date date,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'valid';

UPDATE public.toolbox_talks
SET issue_date = COALESCE(issue_date, date_conducted),
    expiry_date = COALESCE(expiry_date, (COALESCE(issue_date, date_conducted) + interval '6 months')::date),
    status = CASE
      WHEN (COALESCE(expiry_date, (COALESCE(issue_date, date_conducted) + interval '6 months')::date)) < CURRENT_DATE THEN 'expired'
      WHEN (COALESCE(expiry_date, (COALESCE(issue_date, date_conducted) + interval '6 months')::date)) <= CURRENT_DATE + interval '30 days' THEN 'expiring'
      ELSE 'valid'
    END;