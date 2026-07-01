SET search_path = public;

ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS overall_score integer,
  ADD COLUMN IF NOT EXISTS attendance_score integer,
  ADD COLUMN IF NOT EXISTS punctuality_score integer,
  ADD COLUMN IF NOT EXISTS productivity_score integer,
  ADD COLUMN IF NOT EXISTS teamwork_score integer,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS review_period_start date,
  ADD COLUMN IF NOT EXISTS review_period_end date,
  ADD COLUMN IF NOT EXISTS review_period text,
  ADD COLUMN IF NOT EXISTS self_submitted_at timestamp with time zone;
