-- Placeholder RPCs for leave approval routing and Sri Lankan payroll calculations.
-- These are intentionally simple: real logic (approval chains, attendance-based
-- proration, tax brackets) should be refined once the frontend is wired.

CREATE OR REPLACE FUNCTION route_leave_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE leave_records
  SET status = 'pending', updated_at = now()
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION advance_leave_request(
  p_request_id uuid,
  p_level integer,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
BEGIN
  IF lower(p_action) = 'approved' THEN
    v_status := 'approved';
  ELSE
    v_status := 'rejected';
  END IF;

  UPDATE leave_records
  SET status = v_status,
      updated_at = now()
  WHERE id = p_request_id;

  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_attendance_based_salary(
  p_employee_id uuid,
  p_basic_salary numeric,
  p_month integer,
  p_year integer
)
RETURNS TABLE(
  total_days integer,
  days_worked integer,
  days_on_leave integer,
  days_absent integer,
  prorated_salary numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_days integer;
  v_days_worked integer;
  v_days_on_leave integer;
  v_days_absent integer;
BEGIN
  v_total_days := extract(day from (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day'))::integer;

  SELECT
    COALESCE(COUNT(*) FILTER (WHERE event_type = 'clock_in'), 0),
    COALESCE(COUNT(*) FILTER (WHERE event_type = 'on_leave'), 0),
    COALESCE(COUNT(*) FILTER (WHERE event_type = 'absent'), 0)
  INTO v_days_worked, v_days_on_leave, v_days_absent
  FROM clock_events
  WHERE employee_id = p_employee_id
    AND extract(month from "timestamp") = p_month
    AND extract(year from "timestamp") = p_year;

  RETURN QUERY
  SELECT
    v_total_days,
    v_days_worked,
    v_days_on_leave,
    v_days_absent,
    CASE
      WHEN v_total_days = 0 THEN p_basic_salary
      ELSE round(p_basic_salary * v_days_worked / v_total_days, 2)
    END;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_statutory_deductions(
  p_basic_salary numeric,
  p_gross_salary numeric
)
RETURNS TABLE(
  epf_employee numeric,
  epf_employer numeric,
  etf numeric,
  paye_tax numeric
)
LANGUAGE sql
AS $$
  SELECT
    round(p_basic_salary * 0.08, 2) AS epf_employee,
    round(p_basic_salary * 0.12, 2) AS epf_employer,
    round(p_basic_salary * 0.03, 2) AS etf,
    0::numeric AS paye_tax;
$$;
