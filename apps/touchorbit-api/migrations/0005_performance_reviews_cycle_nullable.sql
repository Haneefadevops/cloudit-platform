SET search_path = public;

ALTER TABLE public.performance_reviews
  ALTER COLUMN cycle_id DROP NOT NULL;
