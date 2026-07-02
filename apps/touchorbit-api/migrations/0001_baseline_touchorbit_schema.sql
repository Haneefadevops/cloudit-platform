-- TouchOrbit baseline schema generated from Supabase SQL Editor CSV
-- Generated at: 2026-07-01T05:52:25.693Z
SET statement_timeout = 0;
SET client_min_messages = warning;
SET standard_conforming_strings = on;
SET search_path = public;

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Platform-only additions to the users table
ALTER TABLE IF EXISTS users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal'::text,
  author_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.asset_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  expected_return_at date,
  returned_at timestamp with time zone,
  condition_on_assignment text,
  condition_on_return text,
  notes text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.asset_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category_id uuid,
  name text NOT NULL,
  serial_number text,
  model_number text,
  purchase_date date,
  purchase_cost numeric(12,2),
  condition text DEFAULT 'good'::text,
  status text DEFAULT 'available'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  branch_id uuid
);
CREATE TABLE public.attendance_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  original_event_id uuid,
  correction_type text NOT NULL,
  requested_time timestamp with time zone NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text,
  approver_id uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  actor_user_id uuid,
  actor_employee_id uuid,
  actor_name_snapshot text,
  actor_email_snapshot text,
  target_user_id uuid,
  target_employee_id uuid,
  target_name_snapshot text,
  module text NOT NULL,
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'info'::text,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text,
  old_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'app'::text,
  request_id text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_policy_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  capture_ip_mode text NOT NULL DEFAULT 'sensitive_only'::text,
  retention_days integer,
  optional_modules jsonb NOT NULL DEFAULT jsonb_build_object('employees', true, 'org_chart', true, 'attendance', true, 'leave', true, 'overtime', true, 'expenses', true, 'roster', true, 'calendar', true, 'documents', true, 'tasks', true, 'settings', true, 'imports', true, 'exports', true, 'system', true),
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  address text,
  city text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  manager_employee_id uuid
);
CREATE TABLE public.break_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  clock_event_id uuid,
  break_start timestamp with time zone NOT NULL DEFAULT now(),
  break_end timestamp with time zone,
  break_type text DEFAULT 'break'::text,
  duration_minutes integer,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  created_by uuid NOT NULL,
  event_type text DEFAULT 'meeting'::text,
  target_type text NOT NULL,
  target_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  all_day boolean DEFAULT false,
  event_scope text NOT NULL DEFAULT 'organization'::text,
  branch_id uuid,
  department_id uuid,
  secondary_branch_id uuid,
  secondary_department_id uuid,
  team_member_ids uuid[] DEFAULT ARRAY[]::uuid[],
  meeting_provider text,
  meeting_url text,
  meeting_id text,
  requires_rsvp boolean NOT NULL DEFAULT false,
  reminder_minutes integer NOT NULL DEFAULT 30,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'confirmed'::text,
  original_start_time timestamp with time zone,
  original_end_time timestamp with time zone,
  reschedule_reason text,
  rescheduled_from_event_id uuid,
  location text
);
CREATE TABLE public.clock_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  event_type text NOT NULL,
  "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
  latitude numeric(10,7),
  longitude numeric(10,7),
  location_verified boolean DEFAULT false,
  selfie_url text,
  device_info text,
  method text DEFAULT 'mobile_app'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  gps_accuracy numeric(10,2),
  synced_at timestamp with time zone,
  location_samples jsonb,
  location_variance numeric(10,4),
  device_fingerprint jsonb,
  timezone_offset integer,
  suspicious_flags text[],
  admin_review_status text DEFAULT 'none'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  work_type text DEFAULT 'office'::text,
  branch_id uuid,
  client_ip inet,
  ip_country text,
  ip_city text,
  ip_lat numeric(10,7),
  ip_lng numeric(10,7),
  ip_distance_km numeric(10,2),
  ip_proxy_detected boolean DEFAULT false,
  ip_check_status text DEFAULT 'pending'::text
);
CREATE TABLE public.comp_off_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  worked_date date NOT NULL,
  holiday_id uuid,
  status text DEFAULT 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  used_date date,
  expiry_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.conflict_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  conflict_type text NOT NULL,
  severity text NOT NULL DEFAULT 'high'::text,
  employee_id uuid,
  conflict_date date,
  source_table text NOT NULL,
  source_id uuid,
  conflicting_source_id uuid,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'::text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  branch_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  manager_employee_id uuid,
  parent_department_id uuid
);
CREATE TABLE public.document_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  description text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  is_available boolean NOT NULL DEFAULT true,
  is_recurring boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  document_type text DEFAULT 'Other'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_emergency_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text,
  organization_id uuid
);
CREATE TABLE public.employee_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  kpi_metric text,
  target_value numeric(12,2),
  current_value numeric(12,2) DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  event_type text NOT NULL,
  event_date timestamp with time zone NOT NULL DEFAULT now(),
  description text NOT NULL,
  changed_by uuid,
  changed_by_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  details jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE public.employee_matrix_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  matrix_manager_id uuid NOT NULL,
  relationship_type text DEFAULT 'project'::text
);
CREATE TABLE public.employee_salary_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  component_id uuid NOT NULL,
  override_amount numeric(12,2),
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_salary_structure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  component_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  days_of_week integer[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid
);
CREATE TABLE public.employee_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  skill_name text NOT NULL,
  category text,
  proficiency_level integer,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employee_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  assigned_by uuid,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'work'::text,
  due_date timestamp with time zone,
  reminder_minutes integer,
  reminder_at timestamp with time zone,
  reminder_snoozed_until timestamp with time zone,
  last_reminded_at timestamp with time zone,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  status text NOT NULL DEFAULT 'pending'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.employee_training (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  training_name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  employee_number text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  nic text,
  date_of_birth date,
  hire_date date,
  employment_status text DEFAULT 'active'::text,
  job_title text,
  department text,
  basic_salary numeric(10,2),
  bank_account_number text,
  bank_name text,
  bank_branch text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  annual_leave_balance numeric(4,1) DEFAULT 21,
  casual_leave_balance numeric(4,1) DEFAULT 7,
  sick_leave_balance numeric(4,1) DEFAULT 7,
  comp_off_balance numeric(4,1) DEFAULT 0,
  leave_year_start date,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  termination_date date,
  termination_reason text,
  last_working_day date,
  terminated_by uuid,
  photo_url text,
  branch_id uuid,
  department_id uuid,
  manager_id uuid
);
CREATE TABLE public.event_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  rsvp_at timestamp with time zone,
  reschedule_requested boolean NOT NULL DEFAULT false,
  proposed_new_start timestamp with time zone,
  proposed_new_end timestamp with time zone,
  reschedule_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.expense_approval_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  auto_approve_below numeric(12,2) DEFAULT 0,
  level1_min_amount numeric(12,2) DEFAULT 0,
  level2_min_amount numeric(12,2) DEFAULT 0,
  level3_min_amount numeric(12,2) DEFAULT 999999999,
  parallel_approval boolean DEFAULT false,
  skip_if_no_manager boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  max_claim_amount numeric(12,2),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.expense_claim_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL,
  level integer NOT NULL,
  approver_role text NOT NULL,
  approver_user_id uuid,
  status text DEFAULT 'pending'::text,
  notes text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.expense_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  category_id uuid,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'LKR'::text,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  receipt_url text,
  status text DEFAULT 'pending'::text,
  admin_notes text,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  payment_reference text,
  payment_method text
);
CREATE TABLE public.expense_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category_id uuid NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid NOT NULL,
  limit_per_claim numeric(12,2),
  limit_per_month numeric(12,2),
  receipt_required boolean DEFAULT false,
  auto_approve_below numeric(12,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.geofences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  radius_meters integer DEFAULT 200,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL,
  recurring boolean DEFAULT false,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  branch_id uuid
);
CREATE TABLE public.ip_geo_cache (
  ip inet NOT NULL,
  country text,
  city text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_proxy boolean DEFAULT false,
  fetched_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.leave_approval_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  auto_approve_below_days numeric(4,1) DEFAULT 0,
  level1_min_days numeric(4,1) DEFAULT 0,
  level2_min_days numeric(4,1) DEFAULT 0,
  level3_min_days numeric(4,1) DEFAULT 999,
  parallel_approval boolean DEFAULT false,
  skip_if_no_manager boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.leave_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  leave_type text NOT NULL,
  entitled_days numeric(4,1),
  used_days numeric(4,1) DEFAULT 0,
  remaining_days numeric(4,1)
);
CREATE TABLE public.leave_encashment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  year integer NOT NULL,
  days_requested numeric(4,2) NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text DEFAULT 'pending'::text,
  reason text,
  admin_notes text,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.leave_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day boolean DEFAULT false,
  days_count numeric(3,1) NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text,
  approver_id uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  medical_certificate_url text,
  cancellation_requested boolean DEFAULT false,
  cancellation_reason text
);
CREATE TABLE public.leave_request_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  level integer NOT NULL,
  approver_role text NOT NULL,
  approver_user_id uuid,
  status text DEFAULT 'pending'::text,
  notes text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.notification_event_types (
  type text NOT NULL,
  description text NOT NULL,
  default_email_enabled boolean NOT NULL DEFAULT true,
  default_push_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  email_enabled boolean DEFAULT true,
  push_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  data_json jsonb,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.org_chart_presence_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  clock_event_id uuid,
  event_type text NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.org_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  department_id uuid,
  manager_id uuid,
  title text,
  level text,
  is_filled boolean DEFAULT false,
  filled_by_employee_id uuid
);
CREATE TABLE public.organization_meeting_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider text NOT NULL,
  auth_type text NOT NULL DEFAULT 'api_key'::text,
  encrypted_credentials text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'disconnected'::text,
  error_message text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  timezone text DEFAULT 'Asia/Colombo'::text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  settings jsonb DEFAULT '{"require_gps": true, "require_selfie": true, "grace_period_minutes": 15, "allow_offline_clockin": true}'::jsonb,
  strict_location_mode boolean DEFAULT false,
  expected_timezone_offset integer,
  timezone_tolerance_minutes integer DEFAULT 60,
  carry_forward_limit integer DEFAULT 5,
  carry_forward_enabled boolean DEFAULT true,
  encashment_allowed boolean DEFAULT false,
  encashment_max_days integer DEFAULT 10,
  comp_off_expiry_months integer DEFAULT 3,
  work_hours_start text DEFAULT '09:00'::text,
  work_hours_end text DEFAULT '17:00'::text,
  grace_period_minutes integer DEFAULT 15,
  late_threshold_minutes integer DEFAULT 15,
  require_selfie boolean DEFAULT false,
  require_geofence boolean DEFAULT true,
  annual_leave_days integer DEFAULT 14,
  casual_leave_days integer DEFAULT 7,
  sick_leave_days integer DEFAULT 7,
  block_on_ip_mismatch boolean DEFAULT false
);
CREATE TABLE public.overtime_approval_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  auto_approve_below_hours numeric(4,1) DEFAULT 0,
  level1_min_hours numeric(4,1) DEFAULT 0,
  level2_min_hours numeric(4,1) DEFAULT 0,
  level3_min_hours numeric(4,1) DEFAULT 999,
  parallel_approval boolean DEFAULT false,
  skip_if_no_manager boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.overtime_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  max_daily_hours numeric(4,2) DEFAULT 4.0,
  max_weekly_hours numeric(5,2) DEFAULT 12.0,
  weekday_rate numeric(3,2) DEFAULT 1.5,
  weekend_rate numeric(3,2) DEFAULT 2.0,
  holiday_rate numeric(3,2) DEFAULT 2.5,
  requires_approval boolean DEFAULT true,
  auto_detect boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.overtime_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  date date NOT NULL,
  hours numeric(4,2) NOT NULL,
  rate numeric(3,2) NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text,
  approver_id uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  start_time time without time zone,
  end_time time without time zone
);
CREATE TABLE public.overtime_request_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL,
  level integer NOT NULL,
  approver_role text NOT NULL,
  approver_user_id uuid,
  status text DEFAULT 'pending'::text,
  notes text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.payroll_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  basic_salary numeric(12,2) NOT NULL,
  earnings_json jsonb DEFAULT '[]'::jsonb,
  deductions_json jsonb DEFAULT '[]'::jsonb,
  total_days_in_month integer,
  days_worked numeric(5,2),
  days_on_leave numeric(5,2),
  days_absent numeric(5,2),
  late_deduction numeric(12,2) DEFAULT 0,
  overtime_hours numeric(6,2) DEFAULT 0,
  overtime_amount numeric(12,2) DEFAULT 0,
  epf_employee numeric(12,2) DEFAULT 0,
  epf_employer numeric(12,2) DEFAULT 0,
  etf numeric(12,2) DEFAULT 0,
  paye_tax numeric(12,2) DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL,
  total_deductions numeric(12,2) NOT NULL,
  net_salary numeric(12,2) NOT NULL,
  bank_name text,
  bank_account text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.payroll_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  status text DEFAULT 'draft'::text,
  total_employees integer DEFAULT 0,
  total_gross numeric(12,2) DEFAULT 0,
  total_net numeric(12,2) DEFAULT 0,
  total_epf_employee numeric(12,2) DEFAULT 0,
  total_epf_employer numeric(12,2) DEFAULT 0,
  total_etf numeric(12,2) DEFAULT 0,
  total_paye numeric(12,2) DEFAULT 0,
  run_by uuid,
  finalized_at timestamp with time zone,
  finalized_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.performance_review_cycles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.performance_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  manager_id uuid,
  self_rating integer,
  manager_rating integer,
  final_rating integer,
  self_comments text,
  manager_comments text,
  improvement_plan text,
  status text DEFAULT 'pending_self'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.permission_group_permissions (
  group_id uuid NOT NULL,
  permission_key text NOT NULL
);
CREATE TABLE public.permission_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.permissions (
  key text NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  description text,
  is_owner_only boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.public_calendar_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token_hash text NOT NULL,
  name text NOT NULL DEFAULT 'Public calendar share'::text,
  created_by uuid,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  allowed_start_date date,
  allowed_end_date date,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.roster_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  shift_id uuid,
  date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  acknowledgment_status text NOT NULL DEFAULT 'pending'::text,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  conflict_reason text,
  conflict_flagged_at timestamp with time zone,
  conflict_resolved_at timestamp with time zone,
  conflict_resolved_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.roster_week_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  published_at timestamp with time zone,
  published_by uuid,
  locked_at timestamp with time zone,
  locked_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  notes text,
  published_message text,
  employee_ack_required boolean NOT NULL DEFAULT false,
  last_notified_at timestamp with time zone,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.salary_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  calculation_type text NOT NULL,
  default_amount numeric(12,2),
  is_statutory boolean DEFAULT false,
  is_taxable boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.salary_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  old_basic_salary numeric(12,2),
  new_basic_salary numeric(12,2) NOT NULL,
  effective_date date NOT NULL,
  reason text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  actor_user_id uuid,
  target_user_id uuid,
  target_employee_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.sent_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  template_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  sender_id uuid,
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'pending'::text,
  signature_url text,
  signed_at timestamp with time zone,
  signed_ip text,
  signed_latitude numeric(10,7),
  signed_longitude numeric(10,7),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.shift_swap_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  requester_employee_id uuid NOT NULL,
  target_employee_id uuid,
  requester_date date NOT NULL,
  target_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  reason text,
  claimed_by uuid,
  claimed_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.shift_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_minutes integer DEFAULT 0,
  department_id uuid,
  branch_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  grace_period_minutes integer DEFAULT 15,
  color text DEFAULT '#8B5CF6'::text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  break_minutes integer DEFAULT 0,
  department_id uuid,
  branch_id uuid
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  status text DEFAULT 'trial'::text,
  tier text NOT NULL DEFAULT 'starter'::text,
  employee_count integer DEFAULT 0,
  per_employee_fee numeric(10,2) DEFAULT 300.00,
  minimum_monthly numeric(10,2) DEFAULT 5000.00,
  total_monthly numeric(10,2),
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  payhere_subscription_id text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.training_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  program_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  status text DEFAULT 'assigned'::text,
  assigned_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  score integer,
  certificate_url text,
  notes text,
  start_date date,
  end_date date,
  reschedule_requested boolean DEFAULT false,
  reschedule_reason text,
  reschedule_new_start_date date,
  reschedule_new_end_date date,
  cancel_requested boolean DEFAULT false,
  cancel_reason text,
  start_time time without time zone,
  end_time time without time zone
);
CREATE TABLE public.training_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  total_hours numeric(5,2),
  is_mandatory boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.user_dashboard_layouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  layout_lg jsonb NOT NULL DEFAULT '[]'::jsonb,
  layout_md jsonb NOT NULL DEFAULT '[]'::jsonb,
  layout_sm jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.user_meeting_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  auth_type text NOT NULL DEFAULT 'oauth'::text,
  encrypted_credentials text,
  is_active boolean NOT NULL DEFAULT true,
  connection_status text NOT NULL DEFAULT 'disconnected'::text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public.user_permission_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  scope_type text NOT NULL DEFAULT 'organization'::text,
  scope_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.user_permission_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission_key text NOT NULL,
  effect text NOT NULL,
  scope_type text NOT NULL DEFAULT 'organization'::text,
  scope_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.user_security_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  system_role text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  first_name text,
  last_name text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.asset_assignments ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.asset_categories ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.branches ADD CONSTRAINT branches_pkey PRIMARY KEY (id);
ALTER TABLE public.break_events ADD CONSTRAINT break_events_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_pkey PRIMARY KEY (id);
ALTER TABLE public.comp_off_records ADD CONSTRAINT comp_off_records_pkey PRIMARY KEY (id);
ALTER TABLE public.conflict_log ADD CONSTRAINT conflict_log_pkey PRIMARY KEY (id);
ALTER TABLE public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_emergency_contacts ADD CONSTRAINT employee_emergency_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_goals ADD CONSTRAINT employee_goals_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_matrix_reports ADD CONSTRAINT employee_matrix_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_salary_components ADD CONSTRAINT employee_salary_components_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_salary_structure ADD CONSTRAINT employee_salary_structure_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_shifts ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_training ADD CONSTRAINT employee_training_pkey PRIMARY KEY (id);
ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_approval_config ADD CONSTRAINT expense_approval_config_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_pkey PRIMARY KEY (id);
ALTER TABLE public.expense_policies ADD CONSTRAINT expense_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.geofences ADD CONSTRAINT geofences_pkey PRIMARY KEY (id);
ALTER TABLE public.holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE public.ip_geo_cache ADD CONSTRAINT ip_geo_cache_pkey PRIMARY KEY (ip);
ALTER TABLE public.leave_approval_config ADD CONSTRAINT leave_approval_config_pkey PRIMARY KEY (id);
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
ALTER TABLE public.leave_encashment_requests ADD CONSTRAINT leave_encashment_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.leave_records ADD CONSTRAINT leave_records_pkey PRIMARY KEY (id);
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_event_types ADD CONSTRAINT notification_event_types_pkey PRIMARY KEY (type);
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.org_chart_presence_events ADD CONSTRAINT org_chart_presence_events_pkey PRIMARY KEY (id);
ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_pkey PRIMARY KEY (id);
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.overtime_approval_config ADD CONSTRAINT overtime_approval_config_pkey PRIMARY KEY (id);
ALTER TABLE public.overtime_policies ADD CONSTRAINT overtime_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_pkey PRIMARY KEY (id);
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.performance_review_cycles ADD CONSTRAINT performance_review_cycles_pkey PRIMARY KEY (id);
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_pkey PRIMARY KEY (id);
ALTER TABLE public.permission_group_permissions ADD CONSTRAINT permission_group_permissions_pkey PRIMARY KEY (group_id, permission_key);
ALTER TABLE public.permission_groups ADD CONSTRAINT permission_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.permissions ADD CONSTRAINT permissions_pkey PRIMARY KEY (key);
ALTER TABLE public.public_calendar_tokens ADD CONSTRAINT public_calendar_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_pkey PRIMARY KEY (id);
ALTER TABLE public.salary_components ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);
ALTER TABLE public.salary_revisions ADD CONSTRAINT salary_revisions_pkey PRIMARY KEY (id);
ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.sent_documents ADD CONSTRAINT sent_documents_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.shifts ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.training_programs ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);
ALTER TABLE public.user_dashboard_layouts ADD CONSTRAINT user_dashboard_layouts_pkey PRIMARY KEY (id);
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_pkey PRIMARY KEY (id);
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.announcements ADD CONSTRAINT announcements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.asset_assignments ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
ALTER TABLE public.asset_assignments ADD CONSTRAINT asset_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.asset_assignments ADD CONSTRAINT asset_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.asset_categories ADD CONSTRAINT asset_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.assets ADD CONSTRAINT assets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD CONSTRAINT assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.employees(id);
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_original_event_id_fkey FOREIGN KEY (original_event_id) REFERENCES public.clock_events(id) ON DELETE SET NULL;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES public.employees(id);
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_target_employee_id_fkey FOREIGN KEY (target_employee_id) REFERENCES public.employees(id);
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE public.branches ADD CONSTRAINT branches_manager_employee_id_fkey FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.branches ADD CONSTRAINT branches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.break_events ADD CONSTRAINT break_events_clock_event_id_fkey FOREIGN KEY (clock_event_id) REFERENCES public.clock_events(id) ON DELETE CASCADE;
ALTER TABLE public.break_events ADD CONSTRAINT break_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.break_events ADD CONSTRAINT break_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_rescheduled_from_event_id_fkey FOREIGN KEY (rescheduled_from_event_id) REFERENCES public.calendar_events(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_secondary_branch_id_fkey FOREIGN KEY (secondary_branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_secondary_department_id_fkey FOREIGN KEY (secondary_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.comp_off_records ADD CONSTRAINT comp_off_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.comp_off_records ADD CONSTRAINT comp_off_records_holiday_id_fkey FOREIGN KEY (holiday_id) REFERENCES public.holidays(id) ON DELETE SET NULL;
ALTER TABLE public.comp_off_records ADD CONSTRAINT comp_off_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.conflict_log ADD CONSTRAINT conflict_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.conflict_log ADD CONSTRAINT conflict_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.conflict_log ADD CONSTRAINT conflict_log_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD CONSTRAINT departments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD CONSTRAINT departments_manager_employee_id_fkey FOREIGN KEY (manager_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD CONSTRAINT departments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD CONSTRAINT departments_parent_department_id_fkey FOREIGN KEY (parent_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_emergency_contacts ADD CONSTRAINT employee_emergency_contacts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_emergency_contacts ADD CONSTRAINT employee_emergency_contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_goals ADD CONSTRAINT employee_goals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_goals ADD CONSTRAINT employee_goals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_matrix_reports ADD CONSTRAINT employee_matrix_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_matrix_reports ADD CONSTRAINT employee_matrix_reports_matrix_manager_id_fkey FOREIGN KEY (matrix_manager_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_matrix_reports ADD CONSTRAINT employee_matrix_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_salary_components ADD CONSTRAINT employee_salary_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.salary_components(id) ON DELETE CASCADE;
ALTER TABLE public.employee_salary_components ADD CONSTRAINT employee_salary_components_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_salary_components ADD CONSTRAINT employee_salary_components_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.employee_salary_structure ADD CONSTRAINT employee_salary_structure_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.salary_components(id) ON DELETE CASCADE;
ALTER TABLE public.employee_salary_structure ADD CONSTRAINT employee_salary_structure_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_salary_structure ADD CONSTRAINT employee_salary_structure_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_shifts ADD CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_shifts ADD CONSTRAINT employee_shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_shifts ADD CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE CASCADE;
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_training ADD CONSTRAINT employee_training_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.employee_training ADD CONSTRAINT employee_training_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;
ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.event_attachments ADD CONSTRAINT event_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expense_approval_config ADD CONSTRAINT expense_approval_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id) ON DELETE CASCADE;
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE public.expense_policies ADD CONSTRAINT expense_policies_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE CASCADE;
ALTER TABLE public.expense_policies ADD CONSTRAINT expense_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.geofences ADD CONSTRAINT geofences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leave_approval_config ADD CONSTRAINT leave_approval_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.leave_encashment_requests ADD CONSTRAINT leave_encashment_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.leave_encashment_requests ADD CONSTRAINT leave_encashment_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leave_encashment_requests ADD CONSTRAINT leave_encashment_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE public.leave_records ADD CONSTRAINT leave_records_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);
ALTER TABLE public.leave_records ADD CONSTRAINT leave_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.leave_records ADD CONSTRAINT leave_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.leave_records(id) ON DELETE CASCADE;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.org_chart_presence_events ADD CONSTRAINT org_chart_presence_events_clock_event_id_fkey FOREIGN KEY (clock_event_id) REFERENCES public.clock_events(id) ON DELETE SET NULL;
ALTER TABLE public.org_chart_presence_events ADD CONSTRAINT org_chart_presence_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.org_chart_presence_events ADD CONSTRAINT org_chart_presence_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_filled_by_employee_id_fkey FOREIGN KEY (filled_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.org_positions ADD CONSTRAINT org_positions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.overtime_approval_config ADD CONSTRAINT overtime_approval_config_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.overtime_policies ADD CONSTRAINT overtime_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.employees(id);
ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_approver_user_id_fkey FOREIGN KEY (approver_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.overtime_records(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_items ADD CONSTRAINT payroll_items_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.performance_review_cycles ADD CONSTRAINT performance_review_cycles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.performance_review_cycles(id) ON DELETE CASCADE;
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.permission_group_permissions ADD CONSTRAINT permission_group_permissions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;
ALTER TABLE public.permission_group_permissions ADD CONSTRAINT permission_group_permissions_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE;
ALTER TABLE public.permission_groups ADD CONSTRAINT permission_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.permission_groups ADD CONSTRAINT permission_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.public_calendar_tokens ADD CONSTRAINT public_calendar_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.public_calendar_tokens ADD CONSTRAINT public_calendar_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_conflict_resolved_by_fkey FOREIGN KEY (conflict_resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.salary_components ADD CONSTRAINT salary_components_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.salary_revisions ADD CONSTRAINT salary_revisions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.salary_revisions ADD CONSTRAINT salary_revisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);
ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_target_employee_id_fkey FOREIGN KEY (target_employee_id) REFERENCES public.employees(id);
ALTER TABLE public.security_audit_log ADD CONSTRAINT security_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);
ALTER TABLE public.sent_documents ADD CONSTRAINT sent_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);
ALTER TABLE public.sent_documents ADD CONSTRAINT sent_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sent_documents ADD CONSTRAINT sent_documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_requester_employee_id_fkey FOREIGN KEY (requester_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_target_employee_id_fkey FOREIGN KEY (target_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.shift_templates ADD CONSTRAINT shift_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id) ON DELETE CASCADE;
ALTER TABLE public.training_programs ADD CONSTRAINT training_programs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_dashboard_layouts ADD CONSTRAINT user_dashboard_layouts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON DELETE CASCADE;
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.asset_categories ADD CONSTRAINT asset_categories_organization_id_name_key UNIQUE (organization_id, name);
ALTER TABLE public.assets ADD CONSTRAINT assets_organization_id_serial_number_key UNIQUE (organization_id, serial_number);
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.branches ADD CONSTRAINT branches_organization_id_code_key UNIQUE (organization_id, code);
ALTER TABLE public.employee_matrix_reports ADD CONSTRAINT employee_matrix_reports_organization_id_employee_id_matrix__key UNIQUE (organization_id, employee_id, matrix_manager_id, relationship_type);
ALTER TABLE public.employee_salary_components ADD CONSTRAINT employee_salary_components_employee_id_component_id_key UNIQUE (employee_id, component_id);
ALTER TABLE public.employee_shifts ADD CONSTRAINT employee_shifts_employee_id_shift_id_effective_from_key UNIQUE (employee_id, shift_id, effective_from);
ALTER TABLE public.employees ADD CONSTRAINT employees_organization_id_employee_number_key UNIQUE (organization_id, employee_number);
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_event_id_employee_id_key UNIQUE (event_id, employee_id);
ALTER TABLE public.expense_approval_config ADD CONSTRAINT expense_approval_config_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_organization_id_name_key UNIQUE (organization_id, name);
ALTER TABLE public.leave_approval_config ADD CONSTRAINT leave_approval_config_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_organization_id_employee_id_year_leave_type_key UNIQUE (organization_id, employee_id, year, leave_type);
ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_notification_type_key UNIQUE (user_id, notification_type);
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_organization_id_provider_key UNIQUE (organization_id, provider);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE public.overtime_approval_config ADD CONSTRAINT overtime_approval_config_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.overtime_policies ADD CONSTRAINT overtime_policies_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_organization_id_month_year_key UNIQUE (organization_id, month, year);
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_cycle_id_employee_id_key UNIQUE (cycle_id, employee_id);
ALTER TABLE public.public_calendar_tokens ADD CONSTRAINT public_calendar_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_employee_id_date_key UNIQUE (employee_id, date);
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_organization_id_week_start_key UNIQUE (organization_id, week_start);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_program_id_employee_id_key UNIQUE (program_id, employee_id);
ALTER TABLE public.user_dashboard_layouts ADD CONSTRAINT user_dashboard_layouts_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_user_id_provider_key UNIQUE (user_id, provider);
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_organization_id_user_id_key UNIQUE (organization_id, user_id);
ALTER TABLE public.asset_assignments ADD CONSTRAINT asset_assignments_status_check CHECK (status = ANY (ARRAY['active'::text, 'returned'::text]));
ALTER TABLE public.assets ADD CONSTRAINT assets_status_check CHECK (status = ANY (ARRAY['available'::text, 'assigned'::text, 'maintenance'::text, 'retired'::text]));
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_correction_type_check CHECK (correction_type = ANY (ARRAY['forgot_in'::text, 'forgot_out'::text, 'wrong_time'::text, 'other'::text]));
ALTER TABLE public.attendance_corrections ADD CONSTRAINT attendance_corrections_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_severity_check CHECK (severity = ANY (ARRAY['info'::text, 'notice'::text, 'sensitive'::text, 'critical'::text]));
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_source_check CHECK (source = ANY (ARRAY['admin_app'::text, 'employee_app'::text, 'api'::text, 'rpc'::text, 'trigger'::text, 'system_job'::text, 'import'::text, 'app'::text]));
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_capture_ip_mode_check CHECK (capture_ip_mode = ANY (ARRAY['sensitive_only'::text, 'all'::text, 'security_only'::text, 'off'::text]));
ALTER TABLE public.audit_policy_settings ADD CONSTRAINT audit_policy_settings_retention_days_check CHECK (retention_days IS NULL OR retention_days >= 30);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_event_scope_check CHECK (event_scope = ANY (ARRAY['organization'::text, 'branch'::text, 'department'::text, 'branch_to_branch'::text, 'dept_to_dept'::text, 'one_on_one'::text, 'team'::text]));
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_meeting_provider_check CHECK (meeting_provider IS NULL OR (meeting_provider = ANY (ARRAY['google_meet'::text, 'zoom'::text, 'microsoft_teams'::text, 'manual'::text])));
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_reminder_minutes_check CHECK (reminder_minutes >= 0);
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_status_check CHECK (status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'cancelled'::text, 'rescheduled'::text]));
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_event_type_check CHECK (event_type = ANY (ARRAY['clock_in'::text, 'clock_out'::text]));
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_method_check CHECK (method = ANY (ARRAY['mobile_app'::text, 'tablet_kiosk'::text, 'manual_admin'::text]));
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_work_type_check CHECK (work_type = ANY (ARRAY['office'::text, 'wfh'::text, 'field'::text]));
ALTER TABLE public.conflict_log ADD CONSTRAINT conflict_log_status_check CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'dismissed'::text]));
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_check CHECK (effective_until IS NULL OR effective_until >= effective_from);
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_check1 CHECK (start_time IS NULL AND end_time IS NULL OR start_time IS NOT NULL AND end_time IS NOT NULL);
ALTER TABLE public.employee_availability ADD CONSTRAINT employee_availability_day_of_week_check CHECK (day_of_week >= 0 AND day_of_week <= 6);
ALTER TABLE public.employee_goals ADD CONSTRAINT employee_goals_status_check CHECK (status = ANY (ARRAY['active'::text, 'achieved'::text, 'at_risk'::text, 'missed'::text, 'cancelled'::text]));
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_category_check CHECK (category = ANY (ARRAY['technical'::text, 'soft_skill'::text, 'language'::text, 'certification'::text]));
ALTER TABLE public.employee_skills ADD CONSTRAINT employee_skills_proficiency_level_check CHECK (proficiency_level >= 1 AND proficiency_level <= 5);
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_category_check CHECK (category = ANY (ARRAY['work'::text, 'personal'::text, 'training'::text, 'compliance'::text]));
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_reminder_minutes_check CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);
ALTER TABLE public.employee_tasks ADD CONSTRAINT employee_tasks_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text]));
ALTER TABLE public.employees ADD CONSTRAINT employees_employment_status_check CHECK (employment_status = ANY (ARRAY['active'::text, 'on_leave'::text, 'suspended'::text, 'terminated'::text]));
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'tentative'::text]));
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_approver_role_check CHECK (approver_role = ANY (ARRAY['dept_manager'::text, 'branch_manager'::text, 'hr_admin'::text, 'owner'::text]));
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_level_check CHECK (level = ANY (ARRAY[1, 2, 3]));
ALTER TABLE public.expense_claim_approvals ADD CONSTRAINT expense_claim_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.expense_claims ADD CONSTRAINT expense_claims_status_check CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_level1'::text, 'awaiting_level2'::text, 'awaiting_level3'::text, 'awaiting_finance'::text, 'approved'::text, 'rejected'::text, 'reimbursed'::text]));
ALTER TABLE public.expense_policies ADD CONSTRAINT expense_policies_scope_type_check CHECK (scope_type = ANY (ARRAY['organization'::text, 'branch'::text, 'department'::text, 'employee'::text]));
ALTER TABLE public.geofences ADD CONSTRAINT geofences_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
ALTER TABLE public.leave_encashment_requests ADD CONSTRAINT leave_encashment_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paid'::text]));
ALTER TABLE public.leave_records ADD CONSTRAINT leave_records_status_check CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_level1'::text, 'awaiting_level2'::text, 'awaiting_level3'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]));
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_approver_role_check CHECK (approver_role = ANY (ARRAY['dept_manager'::text, 'branch_manager'::text, 'hr_admin'::text, 'owner'::text]));
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_level_check CHECK (level = ANY (ARRAY[1, 2, 3]));
ALTER TABLE public.leave_request_approvals ADD CONSTRAINT leave_request_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.org_chart_presence_events ADD CONSTRAINT org_chart_presence_events_event_type_check CHECK (event_type = ANY (ARRAY['clock_in'::text, 'clock_out'::text]));
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_auth_type_check CHECK (auth_type = ANY (ARRAY['oauth'::text, 'api_key'::text, 'service_account'::text]));
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_connection_status_check CHECK (connection_status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text]));
ALTER TABLE public.organization_meeting_providers ADD CONSTRAINT organization_meeting_providers_provider_check CHECK (provider = ANY (ARRAY['google_meet'::text, 'zoom'::text, 'microsoft_teams'::text]));
ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text]));
ALTER TABLE public.overtime_records ADD CONSTRAINT overtime_records_status_check CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_level1'::text, 'awaiting_level2'::text, 'awaiting_level3'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_approver_role_check CHECK (approver_role = ANY (ARRAY['dept_manager'::text, 'branch_manager'::text, 'hr_admin'::text, 'owner'::text]));
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_level_check CHECK (level = ANY (ARRAY[1, 2, 3]));
ALTER TABLE public.overtime_request_approvals ADD CONSTRAINT overtime_request_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_month_check CHECK (month >= 1 AND month <= 12);
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'finalized'::text, 'paid'::text]));
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_year_check CHECK (year >= 2020 AND year <= 2100);
ALTER TABLE public.performance_review_cycles ADD CONSTRAINT performance_review_cycles_status_check CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text]));
ALTER TABLE public.performance_reviews ADD CONSTRAINT performance_reviews_status_check CHECK (status = ANY (ARRAY['pending_self'::text, 'pending_manager'::text, 'under_review'::text, 'completed'::text]));
ALTER TABLE public.public_calendar_tokens ADD CONSTRAINT public_calendar_tokens_check CHECK (allowed_end_date IS NULL OR allowed_start_date IS NULL OR allowed_end_date >= allowed_start_date);
ALTER TABLE public.roster_assignments ADD CONSTRAINT roster_assignments_acknowledgment_status_check CHECK (acknowledgment_status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'conflict'::text]));
ALTER TABLE public.roster_week_status ADD CONSTRAINT roster_week_status_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'locked'::text]));
ALTER TABLE public.salary_components ADD CONSTRAINT salary_components_calculation_type_check CHECK (calculation_type = ANY (ARRAY['fixed'::text, 'percentage'::text, 'formula'::text]));
ALTER TABLE public.salary_components ADD CONSTRAINT salary_components_type_check CHECK (type = ANY (ARRAY['earning'::text, 'deduction'::text]));
ALTER TABLE public.shift_swap_requests ADD CONSTRAINT shift_swap_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['trial'::text, 'active'::text, 'past_due'::text, 'cancelled'::text]));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier = ANY (ARRAY['starter'::text, 'growth'::text, 'pro'::text]));
ALTER TABLE public.training_assignments ADD CONSTRAINT training_assignments_status_check CHECK (status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'completed'::text, 'expired'::text, 'cancelled'::text]));
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_auth_type_check CHECK (auth_type = ANY (ARRAY['oauth'::text, 'api_key'::text, 'service_account'::text]));
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_connection_status_check CHECK (connection_status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text]));
ALTER TABLE public.user_meeting_providers ADD CONSTRAINT user_meeting_providers_provider_check CHECK (provider = ANY (ARRAY['google_meet'::text, 'zoom'::text, 'microsoft_teams'::text]));
ALTER TABLE public.user_permission_groups ADD CONSTRAINT user_permission_groups_scope_type_check CHECK (scope_type = ANY (ARRAY['organization'::text, 'branch'::text, 'department'::text, 'team'::text, 'self'::text]));
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_effect_check CHECK (effect = ANY (ARRAY['allow'::text, 'deny'::text]));
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_scope_type_check CHECK (scope_type = ANY (ARRAY['organization'::text, 'branch'::text, 'department'::text, 'team'::text, 'self'::text]));
ALTER TABLE public.user_security_roles ADD CONSTRAINT user_security_roles_system_role_check CHECK (system_role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text, 'manager'::text, 'employee'::text]));
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text, 'manager'::text, 'hr_admin'::text, 'employee'::text, 'finance'::text, 'dept_manager'::text, 'branch_manager'::text]));
CREATE INDEX idx_announcements_created ON public.announcements USING btree (created_at DESC);
CREATE INDEX idx_announcements_org ON public.announcements USING btree (organization_id);
CREATE INDEX idx_asset_assignments_employee ON public.asset_assignments USING btree (employee_id, status);
CREATE INDEX idx_assets_org ON public.assets USING btree (organization_id, status);
CREATE INDEX idx_attendance_corrections_employee ON public.attendance_corrections USING btree (employee_id);
CREATE INDEX idx_attendance_corrections_org ON public.attendance_corrections USING btree (organization_id);
CREATE INDEX idx_attendance_corrections_status ON public.attendance_corrections USING btree (status);
CREATE INDEX idx_audit_events_org_action ON public.audit_events USING btree (organization_id, action, created_at DESC);
CREATE INDEX idx_audit_events_org_actor ON public.audit_events USING btree (organization_id, actor_user_id, created_at DESC);
CREATE INDEX idx_audit_events_org_created ON public.audit_events USING btree (organization_id, created_at DESC);
CREATE INDEX idx_audit_events_org_entity ON public.audit_events USING btree (organization_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_events_org_module ON public.audit_events USING btree (organization_id, module, created_at DESC);
CREATE INDEX idx_audit_events_org_severity ON public.audit_events USING btree (organization_id, severity, created_at DESC);
CREATE INDEX idx_audit_events_org_target_employee ON public.audit_events USING btree (organization_id, target_employee_id, created_at DESC);
CREATE INDEX idx_audit_events_org_target_user ON public.audit_events USING btree (organization_id, target_user_id, created_at DESC);
CREATE INDEX idx_audit_policy_settings_org ON public.audit_policy_settings USING btree (organization_id);
CREATE INDEX idx_calendar_events_branch ON public.calendar_events USING btree (branch_id);
CREATE INDEX idx_calendar_events_date ON public.calendar_events USING btree (event_date);
CREATE INDEX idx_calendar_events_department ON public.calendar_events USING btree (department_id);
CREATE INDEX idx_calendar_events_end_at ON public.calendar_events USING btree (end_at);
CREATE INDEX idx_calendar_events_org ON public.calendar_events USING btree (organization_id);
CREATE INDEX idx_calendar_events_scope ON public.calendar_events USING btree (event_scope);
CREATE INDEX idx_calendar_events_start_at ON public.calendar_events USING btree (start_at);
CREATE INDEX idx_calendar_events_status ON public.calendar_events USING btree (status);
CREATE INDEX idx_calendar_events_target ON public.calendar_events USING btree (target_type, target_id);
CREATE INDEX idx_calendar_events_team_members ON public.calendar_events USING gin (team_member_ids);
CREATE INDEX idx_clock_events_employee ON public.clock_events USING btree (employee_id);
CREATE INDEX idx_clock_events_employee_timestamp ON public.clock_events USING btree (employee_id, "timestamp" DESC);
CREATE INDEX idx_clock_events_flags ON public.clock_events USING gin (suspicious_flags) WHERE ((suspicious_flags IS NOT NULL) AND (array_length(suspicious_flags, 1) > 0));
CREATE INDEX idx_clock_events_location_verified ON public.clock_events USING btree (organization_id, location_verified);
CREATE INDEX idx_clock_events_org ON public.clock_events USING btree (organization_id);
CREATE INDEX idx_clock_events_org_timestamp ON public.clock_events USING btree (organization_id, "timestamp" DESC);
CREATE INDEX idx_clock_events_suspicious ON public.clock_events USING btree (admin_review_status) WHERE (admin_review_status <> 'none'::text);
CREATE INDEX idx_clock_events_timestamp ON public.clock_events USING btree ("timestamp" DESC);
CREATE INDEX idx_clock_events_type ON public.clock_events USING btree (event_type);
CREATE INDEX idx_compoff_employee ON public.comp_off_records USING btree (employee_id, status);
CREATE INDEX idx_compoff_org ON public.comp_off_records USING btree (organization_id);
CREATE INDEX idx_conflict_log_employee_date ON public.conflict_log USING btree (employee_id, conflict_date);
CREATE INDEX idx_conflict_log_org_date ON public.conflict_log USING btree (organization_id, conflict_date);
CREATE INDEX idx_conflict_log_sources ON public.conflict_log USING btree (source_table, source_id, conflicting_source_id);
CREATE INDEX idx_conflict_log_status ON public.conflict_log USING btree (status);
CREATE INDEX idx_departments_branch ON public.departments USING btree (branch_id);
CREATE INDEX idx_departments_org_parent_department ON public.departments USING btree (organization_id, parent_department_id);
CREATE INDEX idx_departments_organization ON public.departments USING btree (organization_id);
CREATE INDEX idx_departments_parent_department ON public.departments USING btree (parent_department_id);
CREATE INDEX idx_document_templates_org ON public.document_templates USING btree (organization_id);
CREATE INDEX idx_employee_availability_day ON public.employee_availability USING btree (day_of_week);
CREATE INDEX idx_employee_availability_effective ON public.employee_availability USING btree (effective_from, effective_until);
CREATE INDEX idx_employee_availability_employee ON public.employee_availability USING btree (employee_id);
CREATE INDEX idx_employee_availability_org ON public.employee_availability USING btree (organization_id);
CREATE INDEX idx_employee_history_employee_event_date ON public.employee_history USING btree (employee_id, event_date DESC);
CREATE INDEX idx_employee_history_employee_id ON public.employee_history USING btree (employee_id);
CREATE INDEX idx_employee_history_event_date ON public.employee_history USING btree (event_date DESC);
CREATE INDEX idx_employee_matrix_reports_org_employee ON public.employee_matrix_reports USING btree (organization_id, employee_id);
CREATE INDEX idx_employee_matrix_reports_org_manager ON public.employee_matrix_reports USING btree (organization_id, matrix_manager_id);
CREATE INDEX idx_employee_salary_structure_effective ON public.employee_salary_structure USING btree (employee_id, effective_from, effective_to);
CREATE INDEX idx_employee_salary_structure_employee ON public.employee_salary_structure USING btree (employee_id);
CREATE INDEX idx_employee_shifts_dates ON public.employee_shifts USING btree (effective_from, effective_to);
CREATE INDEX idx_employee_shifts_employee ON public.employee_shifts USING btree (employee_id);
CREATE INDEX idx_employee_shifts_shift ON public.employee_shifts USING btree (shift_id);
CREATE INDEX idx_employee_tasks_assigned_by ON public.employee_tasks USING btree (assigned_by);
CREATE INDEX idx_employee_tasks_due_date ON public.employee_tasks USING btree (due_date);
CREATE INDEX idx_employee_tasks_employee ON public.employee_tasks USING btree (employee_id);
CREATE INDEX idx_employee_tasks_org ON public.employee_tasks USING btree (organization_id);
CREATE INDEX idx_employee_tasks_reminder_at ON public.employee_tasks USING btree (reminder_at);
CREATE INDEX idx_employee_tasks_snoozed_until ON public.employee_tasks USING btree (reminder_snoozed_until);
CREATE INDEX idx_employee_tasks_status ON public.employee_tasks USING btree (status);
CREATE INDEX idx_employee_training_dates ON public.employee_training USING btree (start_date, end_date);
CREATE INDEX idx_employee_training_employee ON public.employee_training USING btree (employee_id);
CREATE INDEX idx_employee_training_org ON public.employee_training USING btree (organization_id);
CREATE INDEX idx_employees_department ON public.employees USING btree (department_id);
CREATE INDEX idx_employees_manager ON public.employees USING btree (manager_id);
CREATE INDEX idx_employees_org_id ON public.employees USING btree (organization_id);
CREATE INDEX idx_employees_org_manager ON public.employees USING btree (organization_id, manager_id);
CREATE INDEX idx_employees_status ON public.employees USING btree (employment_status);
CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);
CREATE INDEX idx_event_attachments_event ON public.event_attachments USING btree (event_id);
CREATE INDEX idx_event_attachments_org ON public.event_attachments USING btree (organization_id);
CREATE INDEX idx_event_attendees_employee ON public.event_attendees USING btree (employee_id);
CREATE INDEX idx_event_attendees_event ON public.event_attendees USING btree (event_id);
CREATE INDEX idx_event_attendees_org ON public.event_attendees USING btree (organization_id);
CREATE INDEX idx_expense_employee ON public.expense_claims USING btree (employee_id);
CREATE INDEX idx_expense_org ON public.expense_claims USING btree (organization_id, status);
CREATE INDEX idx_geofences_org ON public.geofences USING btree (organization_id);
CREATE INDEX idx_geofences_org_status ON public.geofences USING btree (organization_id, status);
CREATE INDEX idx_geofences_status ON public.geofences USING btree (status);
CREATE INDEX idx_holidays_org_branch_date ON public.holidays USING btree (organization_id, branch_id, date);
CREATE INDEX idx_holidays_org_branch_date_name ON public.holidays USING btree (organization_id, branch_id, date, name);
CREATE INDEX idx_holidays_org_date ON public.holidays USING btree (organization_id, date);
CREATE INDEX idx_ip_geo_cache_fetched_at ON public.ip_geo_cache USING btree (fetched_at);
CREATE INDEX idx_leave_balances_employee ON public.leave_balances USING btree (employee_id, year);
CREATE INDEX idx_leave_records_cancellation ON public.leave_records USING btree (cancellation_requested) WHERE (cancellation_requested = true);
CREATE INDEX idx_leave_records_dates ON public.leave_records USING btree (start_date, end_date);
CREATE INDEX idx_leave_records_employee ON public.leave_records USING btree (employee_id);
CREATE INDEX idx_leave_records_medical_cert ON public.leave_records USING btree (medical_certificate_url) WHERE (medical_certificate_url IS NOT NULL);
CREATE INDEX idx_leave_records_org ON public.leave_records USING btree (organization_id);
CREATE INDEX idx_leave_records_status ON public.leave_records USING btree (status);
CREATE INDEX idx_notifications_org ON public.notifications USING btree (organization_id);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read, created_at DESC);
CREATE INDEX idx_notifications_user_unread_created ON public.notifications USING btree (user_id, created_at DESC) WHERE (read = false);
CREATE INDEX idx_org_chart_presence_events_employee_occurred ON public.org_chart_presence_events USING btree (employee_id, occurred_at DESC);
CREATE INDEX idx_org_chart_presence_events_org_created ON public.org_chart_presence_events USING btree (organization_id, created_at DESC);
CREATE INDEX idx_org_meeting_providers_default ON public.organization_meeting_providers USING btree (organization_id, is_default);
CREATE INDEX idx_org_meeting_providers_org ON public.organization_meeting_providers USING btree (organization_id);
CREATE INDEX idx_org_positions_open ON public.org_positions USING btree (organization_id, is_filled) WHERE (is_filled = false);
CREATE INDEX idx_org_positions_org_department ON public.org_positions USING btree (organization_id, department_id);
CREATE INDEX idx_org_positions_org_manager ON public.org_positions USING btree (organization_id, manager_id);
CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);
CREATE INDEX idx_overtime_policies_org ON public.overtime_policies USING btree (organization_id);
CREATE INDEX idx_overtime_records_date ON public.overtime_records USING btree (date);
CREATE INDEX idx_overtime_records_employee ON public.overtime_records USING btree (employee_id);
CREATE INDEX idx_overtime_records_org ON public.overtime_records USING btree (organization_id);
CREATE INDEX idx_overtime_records_status ON public.overtime_records USING btree (status);
CREATE INDEX idx_payroll_items_employee ON public.payroll_items USING btree (employee_id);
CREATE INDEX idx_payroll_items_run ON public.payroll_items USING btree (payroll_run_id);
CREATE INDEX idx_payroll_runs_month_year ON public.payroll_runs USING btree (organization_id, year, month);
CREATE INDEX idx_payroll_runs_org ON public.payroll_runs USING btree (organization_id);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs USING btree (status);
CREATE INDEX idx_public_calendar_tokens_active ON public.public_calendar_tokens USING btree (organization_id, revoked_at, expires_at);
CREATE INDEX idx_public_calendar_tokens_hash ON public.public_calendar_tokens USING btree (token_hash);
CREATE INDEX idx_public_calendar_tokens_org ON public.public_calendar_tokens USING btree (organization_id);
CREATE INDEX idx_roster_assignments_ack_status ON public.roster_assignments USING btree (acknowledgment_status);
CREATE INDEX idx_roster_assignments_conflict_flagged ON public.roster_assignments USING btree (conflict_flagged_at);
CREATE INDEX idx_roster_week_status_status ON public.roster_week_status USING btree (status);
CREATE INDEX idx_roster_week_status_updated_at ON public.roster_week_status USING btree (updated_at);
CREATE INDEX idx_salary_components_org ON public.salary_components USING btree (organization_id);
CREATE INDEX idx_salary_revisions_employee ON public.salary_revisions USING btree (employee_id);
CREATE INDEX idx_sent_documents_employee ON public.sent_documents USING btree (employee_id);
CREATE INDEX idx_sent_documents_org ON public.sent_documents USING btree (organization_id);
CREATE INDEX idx_sent_documents_status ON public.sent_documents USING btree (status);
CREATE INDEX idx_shift_swap_requests_requester ON public.shift_swap_requests USING btree (requester_employee_id);
CREATE INDEX idx_shift_swap_requests_status ON public.shift_swap_requests USING btree (status);
CREATE INDEX idx_shift_swap_requests_target ON public.shift_swap_requests USING btree (target_employee_id);
CREATE INDEX idx_shifts_org ON public.shifts USING btree (organization_id);
CREATE INDEX idx_shifts_status ON public.shifts USING btree (status);
CREATE INDEX idx_subscriptions_org_id ON public.subscriptions USING btree (organization_id);
CREATE INDEX idx_training_assignments_cancel ON public.training_assignments USING btree (cancel_requested) WHERE (cancel_requested = true);
CREATE INDEX idx_training_assignments_dates ON public.training_assignments USING btree (start_date, end_date);
CREATE INDEX idx_training_assignments_reschedule ON public.training_assignments USING btree (reschedule_requested) WHERE (reschedule_requested = true);
CREATE INDEX idx_user_meeting_providers_org ON public.user_meeting_providers USING btree (organization_id);
CREATE INDEX idx_user_meeting_providers_user ON public.user_meeting_providers USING btree (user_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_org_id ON public.users USING btree (organization_id);
CREATE UNIQUE INDEX idx_expense_policies_unique ON public.expense_policies USING btree (organization_id, category_id, scope_type, scope_id);
CREATE UNIQUE INDEX idx_org_chart_presence_events_clock_event ON public.org_chart_presence_events USING btree (clock_event_id);
CREATE OR REPLACE FUNCTION public.advance_expense_claim(p_claim_id uuid, p_level integer, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim expense_claims%ROWTYPE;
  v_config expense_approval_config%ROWTYPE;
  v_new_status TEXT;
  v_next_level INTEGER;
  v_rows_updated INTEGER;
BEGIN
  IF current_setting('touchorbit.current_user_id', true)::uuid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_level NOT IN (1, 2, 3) OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_claim FROM expense_claims WHERE id = p_claim_id;

  IF NOT FOUND OR v_claim.organization_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Expense claim not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_permission_for_employee('expenses.approve', v_claim.employee_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_config FROM expense_approval_config WHERE organization_id = v_claim.organization_id;

  UPDATE expense_claim_approvals
  SET status = p_status, notes = p_notes, decided_at = now()
  WHERE claim_id = p_claim_id AND level = p_level AND status = 'pending';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Approval step is not pending' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE expense_claims SET status = 'rejected', admin_notes = p_notes WHERE id = p_claim_id;
    v_new_status := 'rejected';
  ELSIF NOT COALESCE(v_config.parallel_approval, false) THEN
    SELECT level INTO v_next_level
    FROM expense_claim_approvals
    WHERE claim_id = p_claim_id AND status = 'pending' AND level > p_level
    ORDER BY level LIMIT 1;

    IF v_next_level IS NOT NULL THEN
      v_new_status := 'awaiting_level' || v_next_level;
    ELSE
      v_new_status := 'awaiting_finance';
    END IF;
    UPDATE expense_claims SET status = v_new_status WHERE id = p_claim_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM expense_claim_approvals WHERE claim_id = p_claim_id AND status = 'pending') THEN
      v_new_status := 'awaiting_finance';
      UPDATE expense_claims SET status = v_new_status WHERE id = p_claim_id;
    ELSE
      v_new_status := v_claim.status;
    END IF;
  END IF;

  INSERT INTO security_audit_log (organization_id, actor_user_id, target_employee_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_claim.organization_id, current_setting('touchorbit.current_user_id', true)::uuid, v_claim.employee_id, 'expenses.approve', 'expense_claim', p_claim_id, jsonb_build_object('status', v_claim.status), jsonb_build_object('status', v_new_status, 'decision', p_status, 'level', p_level));

  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.advance_leave_request(p_request_id uuid, p_level integer, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request leave_records%ROWTYPE;
  v_config leave_approval_config%ROWTYPE;
  v_new_status TEXT;
  v_next_level INTEGER;
  v_rows_updated INTEGER;
BEGIN
  IF current_setting('touchorbit.current_user_id', true)::uuid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_level NOT IN (1, 2, 3) OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM leave_records WHERE id = p_request_id;

  IF NOT FOUND OR v_request.organization_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Leave request not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_permission_for_employee('leave.approve', v_request.employee_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_config FROM leave_approval_config WHERE organization_id = v_request.organization_id;

  UPDATE leave_request_approvals
  SET status = p_status, notes = p_notes, decided_at = now()
  WHERE request_id = p_request_id AND level = p_level AND status = 'pending';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Approval step is not pending' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE leave_records SET status = 'rejected', rejection_reason = p_notes WHERE id = p_request_id;
    v_new_status := 'rejected';
  ELSIF NOT COALESCE(v_config.parallel_approval, false) THEN
    SELECT level INTO v_next_level
    FROM leave_request_approvals
    WHERE request_id = p_request_id AND status = 'pending' AND level > p_level
    ORDER BY level LIMIT 1;

    IF v_next_level IS NOT NULL THEN
      v_new_status := 'awaiting_level' || v_next_level;
    ELSE
      v_new_status := 'approved';
      UPDATE leave_records SET approved_at = now() WHERE id = p_request_id;
    END IF;
    UPDATE leave_records SET status = v_new_status WHERE id = p_request_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM leave_request_approvals WHERE request_id = p_request_id AND status = 'pending') THEN
      v_new_status := 'approved';
      UPDATE leave_records SET status = v_new_status, approved_at = now() WHERE id = p_request_id;
    ELSE
      v_new_status := v_request.status;
    END IF;
  END IF;

  INSERT INTO security_audit_log (organization_id, actor_user_id, target_employee_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_request.organization_id, current_setting('touchorbit.current_user_id', true)::uuid, v_request.employee_id, 'leave.approve', 'leave_record', p_request_id, jsonb_build_object('status', v_request.status), jsonb_build_object('status', v_new_status, 'decision', p_status, 'level', p_level));

  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.advance_overtime_record(p_record_id uuid, p_level integer, p_status text, p_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_record overtime_records%ROWTYPE;
  v_config overtime_approval_config%ROWTYPE;
  v_new_status TEXT;
  v_next_level INTEGER;
  v_rows_updated INTEGER;
BEGIN
  IF current_setting('touchorbit.current_user_id', true)::uuid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_level NOT IN (1, 2, 3) OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_record FROM overtime_records WHERE id = p_record_id;

  IF NOT FOUND OR v_record.organization_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Overtime record not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_permission_for_employee('overtime.approve', v_record.employee_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_config FROM overtime_approval_config WHERE organization_id = v_record.organization_id;

  UPDATE overtime_request_approvals
  SET status = p_status, notes = p_notes, decided_at = now()
  WHERE record_id = p_record_id AND level = p_level AND status = 'pending';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Approval step is not pending' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE overtime_records SET status = 'rejected', rejection_reason = p_notes WHERE id = p_record_id;
    v_new_status := 'rejected';
  ELSIF NOT COALESCE(v_config.parallel_approval, false) THEN
    SELECT level INTO v_next_level
    FROM overtime_request_approvals
    WHERE record_id = p_record_id AND status = 'pending' AND level > p_level
    ORDER BY level LIMIT 1;

    IF v_next_level IS NOT NULL THEN
      v_new_status := 'awaiting_level' || v_next_level;
    ELSE
      v_new_status := 'approved';
      UPDATE overtime_records SET approved_at = now() WHERE id = p_record_id;
    END IF;
    UPDATE overtime_records SET status = v_new_status WHERE id = p_record_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM overtime_request_approvals WHERE record_id = p_record_id AND status = 'pending') THEN
      v_new_status := 'approved';
      UPDATE overtime_records SET status = v_new_status, approved_at = now() WHERE id = p_record_id;
    ELSE
      v_new_status := v_record.status;
    END IF;
  END IF;

  INSERT INTO security_audit_log (organization_id, actor_user_id, target_employee_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_record.organization_id, current_setting('touchorbit.current_user_id', true)::uuid, v_record.employee_id, 'overtime.approve', 'overtime_record', p_record_id, jsonb_build_object('status', v_record.status), jsonb_build_object('status', v_new_status, 'decision', p_status, 'level', p_level));

  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.approve_shift_swap(p_swap_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_swap shift_swap_requests%ROWTYPE;
  v_req_shift_id UUID;
  v_req_notes TEXT;
  v_target_shift_id UUID;
  v_target_notes TEXT;
BEGIN
  SELECT * INTO v_swap
  FROM shift_swap_requests
  WHERE id = p_swap_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift swap not found';
  END IF;

  IF v_swap.status NOT IN ('pending', 'claimed') THEN
    RAISE EXCEPTION 'Request is already processed';
  END IF;

  IF v_swap.target_employee_id IS NULL THEN
    RAISE EXCEPTION 'Open shift must be claimed before approval';
  END IF;

  IF NOT has_permission_for_employee('roster.approve_swap', v_swap.requester_employee_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT shift_id, notes INTO v_req_shift_id, v_req_notes
  FROM roster_assignments
  WHERE organization_id = v_swap.organization_id
    AND employee_id = v_swap.requester_employee_id
    AND date = v_swap.requester_date;

  IF v_req_shift_id IS NULL THEN
    RAISE EXCEPTION 'Requester shift not found';
  END IF;

  IF v_swap.target_date IS NOT NULL THEN
    SELECT shift_id, notes INTO v_target_shift_id, v_target_notes
    FROM roster_assignments
    WHERE organization_id = v_swap.organization_id
      AND employee_id = v_swap.target_employee_id
      AND date = v_swap.target_date;

    INSERT INTO roster_assignments (organization_id, employee_id, date, shift_id, notes, created_by)
    VALUES (v_swap.organization_id, v_swap.requester_employee_id, v_swap.target_date, v_target_shift_id, v_target_notes, current_setting('touchorbit.current_user_id', true)::uuid)
    ON CONFLICT (employee_id, date) DO UPDATE
    SET shift_id = EXCLUDED.shift_id, notes = EXCLUDED.notes, created_by = current_setting('touchorbit.current_user_id', true)::uuid, acknowledgment_status = 'pending';
  ELSE
    DELETE FROM roster_assignments
    WHERE organization_id = v_swap.organization_id
      AND employee_id = v_swap.requester_employee_id
      AND date = v_swap.requester_date;
  END IF;

  INSERT INTO roster_assignments (organization_id, employee_id, date, shift_id, notes, created_by)
  VALUES (v_swap.organization_id, v_swap.target_employee_id, v_swap.requester_date, v_req_shift_id, v_req_notes, current_setting('touchorbit.current_user_id', true)::uuid)
  ON CONFLICT (employee_id, date) DO UPDATE
  SET shift_id = EXCLUDED.shift_id, notes = EXCLUDED.notes, created_by = current_setting('touchorbit.current_user_id', true)::uuid, acknowledgment_status = 'pending';

  UPDATE shift_swap_requests
  SET status = 'approved', reviewed_by = current_setting('touchorbit.current_user_id', true)::uuid, reviewed_at = now()
  WHERE id = p_swap_id;

  RETURN 'approved';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_employee_history_action(p_event_type text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_event_type IN ('created', 'employee_created') THEN
    RETURN 'created';
  END IF;

  IF p_event_type = 'terminated' THEN
    RETURN 'terminated';
  END IF;

  IF p_event_type = 'imported' THEN
    RETURN 'imported';
  END IF;

  IF p_event_type LIKE '%manager%' THEN
    RETURN 'reassigned';
  END IF;

  RETURN 'updated';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_employee_history_module(p_event_type text, p_details jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_event_type IN ('salary_revised') OR p_details ? 'basic_salary' OR p_details ? 'old_salary' OR p_details ? 'new_salary' THEN
    RETURN 'salary';
  END IF;

  IF p_event_type IN ('department_changed', 'manager_changed', 'matrix_report_added', 'matrix_report_removed', 'matrix_report_updated') THEN
    RETURN 'org_chart';
  END IF;

  IF p_event_type IN ('terminated', 'status_changed') THEN
    RETURN 'employees';
  END IF;

  RETURN 'employees';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_employee_history_new_value(p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_details ? 'new_value' THEN
    RETURN jsonb_build_object(COALESCE(p_details ->> 'field', 'value'), p_details -> 'new_value');
  END IF;

  IF p_details ? 'new_salary' THEN
    RETURN jsonb_build_object('salary', p_details -> 'new_salary');
  END IF;

  IF p_details ? 'new_status' THEN
    RETURN jsonb_build_object('employment_status', p_details -> 'new_status');
  END IF;

  RETURN COALESCE(p_details, '{}'::JSONB);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_employee_history_old_value(p_details jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_details ? 'old_value' THEN
    RETURN jsonb_build_object(COALESCE(p_details ->> 'field', 'value'), p_details -> 'old_value');
  END IF;

  IF p_details ? 'old_salary' THEN
    RETURN jsonb_build_object('salary', p_details -> 'old_salary');
  END IF;

  IF p_details ? 'old_status' THEN
    RETURN jsonb_build_object('employment_status', p_details -> 'old_status');
  END IF;

  RETURN '{}'::JSONB;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_employee_history_severity(p_event_type text, p_details jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_event_type IN ('salary_revised') OR p_details ? 'basic_salary' OR p_details ? 'old_salary' OR p_details ? 'new_salary' THEN
    RETURN 'sensitive';
  END IF;

  IF p_event_type IN ('terminated', 'status_changed', 'manager_changed', 'department_changed') THEN
    RETURN 'notice';
  END IF;

  RETURN 'info';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_event_is_required(p_module text, p_action text, p_severity text, p_entity_type text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module TEXT := lower(COALESCE(p_module, 'system'));
  v_action TEXT := lower(COALESCE(p_action, 'updated'));
  v_severity TEXT := lower(COALESCE(p_severity, 'info'));
  v_entity_type TEXT := lower(COALESCE(p_entity_type, ''));
BEGIN
  RETURN v_severity IN ('sensitive', 'critical')
    OR v_module IN ('salary', 'payroll', 'security', 'access')
    OR v_action IN ('terminated', 'exported', 'downloaded', 'finalized', 'revoked')
    OR (v_module = 'attendance' AND v_action IN ('reviewed', 'approved', 'rejected', 'corrected'))
    OR v_entity_type IN ('permission', 'role', 'security', 'payroll_run', 'salary_revision');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_is_sensitive(p_module text, p_action text, p_severity text, p_entity_type text, p_old_value jsonb DEFAULT '{}'::jsonb, p_new_value jsonb DEFAULT '{}'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_text TEXT;
BEGIN
  v_text := lower(concat_ws(
    ' ',
    COALESCE(p_module, ''),
    COALESCE(p_action, ''),
    COALESCE(p_severity, ''),
    COALESCE(p_entity_type, ''),
    COALESCE(p_old_value::TEXT, ''),
    COALESCE(p_new_value::TEXT, ''),
    COALESCE(p_metadata::TEXT, '')
  ));

  RETURN COALESCE(p_severity, 'info') IN ('sensitive', 'critical')
    OR COALESCE(p_module, '') IN ('salary', 'payroll', 'security', 'access', 'documents')
    OR v_text LIKE '%salary%'
    OR v_text LIKE '%payroll%'
    OR v_text LIKE '%bank%'
    OR v_text LIKE '%token%'
    OR v_text LIKE '%password%'
    OR v_text LIKE '%permission%'
    OR v_text LIKE '%role%'
    OR v_text LIKE '%national_id%'
    OR v_text LIKE '%document%';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_payroll_run_insert_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
  v_action TEXT;
  v_severity TEXT;
  v_audit_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_severity := 'notice';
  ELSIF NEW.status = 'finalized' THEN
    v_action := 'finalized';
    v_severity := 'critical';
  ELSIF NEW.status = 'paid' THEN
    v_action := 'paid';
    v_severity := 'critical';
  ELSE
    v_action := 'updated';
    v_severity := 'sensitive';
  END IF;

  v_actor_user_id := COALESCE(NEW.finalized_by, NEW.run_by, current_setting('touchorbit.current_user_id', true)::uuid);

  IF EXISTS (
    SELECT 1
    FROM audit_events ae
    WHERE ae.organization_id = NEW.organization_id
      AND ae.metadata ->> 'source_table' = 'payroll_runs'
      AND ae.metadata ->> 'source_id' = NEW.id::TEXT
      AND ae.metadata ->> 'operation' = TG_OP
      AND COALESCE(ae.new_value ->> 'status', '') = COALESCE(NEW.status, '')
  ) THEN
    RETURN NEW;
  END IF;

  v_audit_id := record_audit_event(
    NEW.organization_id,
    v_actor_user_id,
    NULL,
    NULL,
    'payroll',
    v_action,
    v_severity,
    'payroll_run',
    NEW.id,
    concat_ws(' ', 'Payroll', NEW.month::TEXT, NEW.year::TEXT),
    CASE
      WHEN TG_OP = 'INSERT' THEN '{}'::JSONB
      ELSE jsonb_build_object(
        'status', OLD.status,
        'total_employees', OLD.total_employees,
        'total_gross', OLD.total_gross,
        'total_net', OLD.total_net
      )
    END,
    jsonb_build_object(
      'status', NEW.status,
      'total_employees', NEW.total_employees,
      'total_gross', NEW.total_gross,
      'total_net', NEW.total_net,
      'finalized_at', NEW.finalized_at
    ),
    CASE WHEN TG_OP = 'INSERT' THEN '[]'::JSONB ELSE jsonb_build_array('status') END,
    jsonb_build_object(
      'source_table', 'payroll_runs',
      'source_id', NEW.id,
      'operation', TG_OP,
      'month', NEW.month,
      'year', NEW.year
    ),
    'trigger',
    NULL,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_policy_allows_event(p_organization_id uuid, p_module text, p_action text, p_severity text, p_entity_type text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_module TEXT := lower(COALESCE(p_module, 'system'));
  v_policy audit_policy_settings%ROWTYPE;
BEGIN
  IF audit_event_is_required(p_module, p_action, p_severity, p_entity_type) THEN
    RETURN true;
  END IF;

  SELECT *
  INTO v_policy
  FROM audit_policy_settings aps
  WHERE aps.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  RETURN COALESCE((v_policy.optional_modules ->> v_module)::BOOLEAN, true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_policy_capture_request_context(p_organization_id uuid, p_module text, p_action text, p_severity text, p_entity_type text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mode TEXT := 'sensitive_only';
  v_is_sensitive BOOLEAN;
BEGIN
  SELECT COALESCE(aps.capture_ip_mode, 'sensitive_only')
  INTO v_mode
  FROM audit_policy_settings aps
  WHERE aps.organization_id = p_organization_id;

  v_mode := COALESCE(v_mode, 'sensitive_only');
  v_is_sensitive := audit_event_is_required(p_module, p_action, p_severity, p_entity_type)
    OR COALESCE(p_severity, 'info') IN ('sensitive', 'critical');

  IF v_mode = 'all' THEN
    RETURN true;
  END IF;

  IF v_mode = 'off' THEN
    RETURN false;
  END IF;

  IF v_mode = 'security_only' THEN
    RETURN lower(COALESCE(p_module, '')) IN ('security', 'access')
      OR lower(COALESCE(p_entity_type, '')) IN ('security', 'permission', 'role');
  END IF;

  RETURN v_is_sensitive;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_redact_jsonb(p_value jsonb, p_should_redact boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT COALESCE(p_should_redact, false) THEN
    RETURN COALESCE(p_value, '{}'::JSONB);
  END IF;

  IF p_value IS NULL OR p_value = '{}'::JSONB THEN
    RETURN '{}'::JSONB;
  END IF;

  RETURN jsonb_build_object('redacted', true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.audit_salary_revision_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee employees%ROWTYPE;
  v_audit_id UUID;
BEGIN
  SELECT *
  INTO v_employee
  FROM employees
  WHERE id = NEW.employee_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit_events ae
    WHERE ae.organization_id = NEW.organization_id
      AND ae.metadata ->> 'source_table' = 'salary_revisions'
      AND ae.metadata ->> 'source_id' = NEW.id::TEXT
  ) THEN
    RETURN NEW;
  END IF;

  v_audit_id := record_audit_event(
    NEW.organization_id,
    NEW.approved_by,
    v_employee.user_id,
    NEW.employee_id,
    'salary',
    'updated',
    'sensitive',
    'salary_revision',
    NEW.id,
    COALESCE(NULLIF(concat_ws(' ', v_employee.first_name, v_employee.last_name), ''), v_employee.email, v_employee.employee_number, v_employee.id::TEXT),
    jsonb_build_object('basic_salary', NEW.old_basic_salary),
    jsonb_build_object('basic_salary', NEW.new_basic_salary),
    jsonb_build_array('basic_salary'),
    jsonb_build_object(
      'source_table', 'salary_revisions',
      'source_id', NEW.id,
      'effective_date', NEW.effective_date,
      'reason', NEW.reason,
      'approved_at', NEW.approved_at
    ),
    'trigger',
    NULL,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_attendance_based_salary(p_employee_id uuid, p_basic_salary numeric, p_month integer, p_year integer)
 RETURNS TABLE(total_days integer, days_worked numeric, days_on_leave numeric, days_absent numeric, prorated_salary numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_total_days INTEGER;
  v_days_worked NUMERIC := 0;
  v_days_on_leave NUMERIC := 0;
  v_days_absent NUMERIC := 0;
  v_prorated NUMERIC;
BEGIN
  -- Get total days in the month
  v_total_days := DATE_PART('days',
    DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1)) + INTERVAL '1 month - 1 day'
  )::INTEGER;

  -- Count working days (days with clock-in)
  SELECT COUNT(DISTINCT DATE(timestamp))::NUMERIC INTO v_days_worked
  FROM clock_events
  WHERE employee_id = p_employee_id
    AND event_type = 'clock_in'
    AND EXTRACT(MONTH FROM timestamp) = p_month
    AND EXTRACT(YEAR FROM timestamp) = p_year;

  -- Count leave days
  SELECT COALESCE(SUM(days_count), 0) INTO v_days_on_leave
  FROM leave_records
  WHERE employee_id = p_employee_id
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year
    AND EXTRACT(MONTH FROM start_date) = p_month;

  -- Absent days = total - (worked + leave)
  v_days_absent := v_total_days - v_days_worked - v_days_on_leave;
  IF v_days_absent < 0 THEN v_days_absent := 0; END IF;

  -- Pro-rate salary based on (worked + leave) / total days
  v_prorated := ROUND((p_basic_salary / v_total_days) * (v_days_worked + v_days_on_leave), 2);

  RETURN QUERY SELECT
    v_total_days,
    v_days_worked,
    v_days_on_leave,
    v_days_absent,
    v_prorated;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  R FLOAT := 6371000; -- Earth radius in meters
  phi1 FLOAT := lat1 * PI() / 180;
  phi2 FLOAT := lat2 * PI() / 180;
  dphi FLOAT := (lat2 - lat1) * PI() / 180;
  dlambda FLOAT := (lon2 - lon1) * PI() / 180;
  a FLOAT;
  c FLOAT;
BEGIN
  a := sin(dphi/2) * sin(dphi/2) + cos(phi1) * cos(phi2) * sin(dlambda/2) * sin(dlambda/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  R CONSTANT NUMERIC := 6371000; -- Earth radius in meters
  phi1 NUMERIC;
  phi2 NUMERIC;
  delta_phi NUMERIC;
  delta_lambda NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  phi1 := RADIANS(lat1);
  phi2 := RADIANS(lat2);
  delta_phi := RADIANS(lat2 - lat1);
  delta_lambda := RADIANS(lon2 - lon1);

  a := SIN(delta_phi / 2) * SIN(delta_phi / 2) +
       COS(phi1) * COS(phi2) *
       SIN(delta_lambda / 2) * SIN(delta_lambda / 2);

  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));

  RETURN R * c;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_overtime(p_employee_id uuid, p_clock_in timestamp with time zone, p_clock_out timestamp with time zone)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_shift RECORD;
  v_shift_hours NUMERIC;
  v_actual_hours NUMERIC;
  v_overtime NUMERIC;
BEGIN
  -- Get employee's shift
  SELECT * INTO v_shift
  FROM get_employee_shift(p_employee_id, p_clock_in);

  -- Calculate actual hours worked
  v_actual_hours := EXTRACT(EPOCH FROM (p_clock_out - p_clock_in)) / 3600.0;

  -- No shift = use 8 hour standard
  IF v_shift IS NULL THEN
    v_shift_hours := 8.0;
  ELSE
    -- Calculate shift duration
    v_shift_hours := EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time)) / 3600.0;

    -- Handle overnight shifts (end_time < start_time)
    IF v_shift.end_time < v_shift.start_time THEN
      v_shift_hours := v_shift_hours + 24.0;
    END IF;
  END IF;

  -- Overtime = hours beyond shift duration
  v_overtime := GREATEST(0, v_actual_hours - v_shift_hours);

  RETURN ROUND(v_overtime, 2);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_statutory_deductions(p_basic_salary numeric, p_gross_salary numeric)
 RETURNS TABLE(epf_employee numeric, epf_employer numeric, etf numeric, paye_tax numeric)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_epf_employee NUMERIC;
  v_epf_employer NUMERIC;
  v_etf NUMERIC;
  v_paye NUMERIC;
  v_monthly_income NUMERIC;
  v_band NUMERIC := 41667; -- LKR 500,000 / 12 months
BEGIN
  -- EPF on gross salary (basic + all allowances) per EPF Act
  v_epf_employee := ROUND(p_gross_salary * 0.08, 2);
  v_epf_employer := ROUND(p_gross_salary * 0.12, 2);
  v_etf          := ROUND(p_gross_salary * 0.03, 2);

  -- PAYE taxable income = gross - EPF employee contribution
  v_monthly_income := p_gross_salary - v_epf_employee;
  v_paye := 0;

  IF v_monthly_income > 100000 THEN
    IF v_monthly_income <= 141667 THEN
      v_paye := (v_monthly_income - 100000) * 0.06;

    ELSIF v_monthly_income <= 183333 THEN
      v_paye := v_band * 0.06
              + (v_monthly_income - 141667) * 0.12;

    ELSIF v_monthly_income <= 225000 THEN
      v_paye := v_band * 0.06
              + v_band * 0.12
              + (v_monthly_income - 183333) * 0.18;

    ELSIF v_monthly_income <= 266667 THEN
      v_paye := v_band * 0.06
              + v_band * 0.12
              + v_band * 0.18
              + (v_monthly_income - 225000) * 0.24;

    ELSIF v_monthly_income <= 308333 THEN
      v_paye := v_band * 0.06
              + v_band * 0.12
              + v_band * 0.18
              + v_band * 0.24
              + (v_monthly_income - 266667) * 0.30;

    ELSE
      v_paye := v_band * 0.06
              + v_band * 0.12
              + v_band * 0.18
              + v_band * 0.24
              + v_band * 0.30
              + (v_monthly_income - 308333) * 0.36;
    END IF;
  END IF;

  v_paye := ROUND(v_paye, 2);

  RETURN QUERY SELECT v_epf_employee, v_epf_employer, v_etf, v_paye;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calendar_event_target_type(p_scope text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN CASE p_scope
    WHEN 'department' THEN 'department'
    WHEN 'dept_to_dept' THEN 'department'
    WHEN 'branch' THEN 'branch'
    WHEN 'branch_to_branch' THEN 'branch'
    WHEN 'one_on_one' THEN 'employee'
    WHEN 'team' THEN 'employee'
    ELSE 'all'
  END;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_my_org_id UUID;
  v_my_role TEXT;
  v_target_org_id UUID;
  v_target_dept_id UUID;
  v_target_branch_id UUID;
BEGIN
  SELECT organization_id, role INTO v_my_org_id, v_my_role
  FROM users
  WHERE id = current_setting('touchorbit.current_user_id', true)::uuid;

  SELECT organization_id, department_id, branch_id
  INTO v_target_org_id, v_target_dept_id, v_target_branch_id
  FROM employees
  WHERE id = p_employee_id;

  IF v_my_org_id IS NULL OR v_my_org_id IS DISTINCT FROM v_target_org_id THEN
    RETURN false;
  END IF;

  IF v_my_role IN ('owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'finance') THEN
    RETURN true;
  END IF;

  IF v_my_role = 'dept_manager' THEN
    RETURN v_target_dept_id = get_my_managed_dept_id();
  END IF;

  IF v_my_role = 'branch_manager' THEN
    RETURN v_target_branch_id = get_my_managed_branch_id();
  END IF;

  RETURN false;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_employee(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_my_org_id UUID;
  v_my_role TEXT;
  v_target_org_id UUID;
  v_target_dept_id UUID;
  v_target_branch_id UUID;
  v_target_user_id UUID;
BEGIN
  SELECT organization_id, role INTO v_my_org_id, v_my_role
  FROM users
  WHERE id = current_setting('touchorbit.current_user_id', true)::uuid;

  SELECT organization_id, department_id, branch_id, user_id
  INTO v_target_org_id, v_target_dept_id, v_target_branch_id, v_target_user_id
  FROM employees
  WHERE id = p_employee_id;

  IF v_my_org_id IS NULL OR v_my_org_id IS DISTINCT FROM v_target_org_id THEN
    RETURN false;
  END IF;

  IF v_target_user_id = current_setting('touchorbit.current_user_id', true)::uuid THEN
    RETURN true;
  END IF;

  IF v_my_role IN ('owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'finance') THEN
    RETURN true;
  END IF;

  IF v_my_role = 'dept_manager' THEN
    RETURN v_target_dept_id = get_my_managed_dept_id();
  END IF;

  IF v_my_role = 'branch_manager' THEN
    RETURN v_target_branch_id = get_my_managed_branch_id();
  END IF;

  RETURN false;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_geofence(p_organization_id uuid, p_latitude numeric, p_longitude numeric)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  geofence RECORD;
  distance NUMERIC;
BEGIN
  FOR geofence IN
    SELECT latitude, longitude, radius_meters
    FROM geofences
    WHERE organization_id = p_organization_id
      AND status = 'active'
  LOOP
    distance := calculate_distance(
      p_latitude,
      p_longitude,
      geofence.latitude,
      geofence.longitude
    );

    IF distance <= geofence.radius_meters THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_scheduling_conflict(p_employee_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee employees%ROWTYPE;
  v_start_date DATE;
  v_end_date DATE;
  v_day_of_week INTEGER;
  v_start_time TIME;
  v_end_time TIME;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'Invalid scheduling window';
  END IF;

  SELECT * INTO v_employee
  FROM employees
  WHERE id = p_employee_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found or outside organization';
  END IF;

  IF NOT is_admin() AND v_employee.user_id IS DISTINCT FROM current_setting('touchorbit.current_user_id', true)::uuid THEN
    RAISE EXCEPTION 'Not authorized to check this employee schedule';
  END IF;

  v_start_date := p_start::DATE;
  v_end_date := p_end::DATE;
  v_day_of_week := EXTRACT(DOW FROM p_start)::INTEGER;
  v_start_time := p_start::TIME;
  v_end_time := p_end::TIME;

  RETURN EXISTS (
    SELECT 1
    FROM calendar_events ce
    WHERE ce.organization_id = v_employee.organization_id
      AND ce.status IN ('draft', 'confirmed', 'rescheduled')
      AND COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) < p_end
      AND COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) > p_start
      AND (
        p_employee_id = ANY(COALESCE(ce.team_member_ids, ARRAY[]::UUID[]))
        OR ce.branch_id = v_employee.branch_id
        OR ce.secondary_branch_id = v_employee.branch_id
        OR ce.department_id = v_employee.department_id
        OR ce.secondary_department_id = v_employee.department_id
        OR EXISTS (
          SELECT 1
          FROM event_attendees ea
          WHERE ea.event_id = ce.id
            AND ea.employee_id = p_employee_id
            AND ea.status <> 'declined'
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM leave_records lr
    WHERE lr.organization_id = v_employee.organization_id
      AND lr.employee_id = p_employee_id
      AND lr.status = 'approved'
      AND lr.start_date <= v_end_date
      AND lr.end_date >= v_start_date
  )
  OR EXISTS (
    SELECT 1
    FROM roster_assignments ra
    JOIN shifts s ON s.id = ra.shift_id
    WHERE ra.organization_id = v_employee.organization_id
      AND ra.employee_id = p_employee_id
      AND ra.date = v_start_date
      AND (ra.date + s.start_time)::TIMESTAMPTZ < p_end
      AND (
        (ra.date + s.end_time)::TIMESTAMPTZ
        + CASE
            WHEN s.end_time < s.start_time THEN INTERVAL '1 day'
            ELSE INTERVAL '0 days'
          END
      ) > p_start
  )
  OR EXISTS (
    SELECT 1
    FROM employee_availability av
    WHERE av.organization_id = v_employee.organization_id
      AND av.employee_id = p_employee_id
      AND av.is_available = false
      AND av.day_of_week = v_day_of_week
      AND av.effective_from <= v_start_date
      AND (av.effective_until IS NULL OR av.effective_until >= v_start_date)
      AND (
        av.start_time IS NULL
        OR (
          av.start_time < v_end_time
          AND av.end_time > v_start_time
        )
      )
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_teleportation(p_employee_id uuid, p_latitude numeric, p_longitude numeric, p_timestamp timestamp with time zone)
 RETURNS TABLE(is_suspicious boolean, reason text, speed_kmh numeric, distance_meters numeric, time_minutes numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_last_event RECORD;
  v_distance NUMERIC;
  v_time_diff_seconds NUMERIC;
  v_speed_kmh NUMERIC;
  v_max_speed_kmh CONSTANT NUMERIC := 200; -- Maximum plausible speed in Sri Lanka (km/h)
BEGIN
  -- Get the most recent clock event for this employee (before current timestamp)
  SELECT latitude, longitude, timestamp
  INTO v_last_event
  FROM clock_events
  WHERE employee_id = p_employee_id
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND timestamp < p_timestamp
  ORDER BY timestamp DESC
  LIMIT 1;

  -- If no previous event, not suspicious
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Calculate distance between events
  v_distance := calculate_distance(
    v_last_event.latitude,
    v_last_event.longitude,
    p_latitude,
    p_longitude
  );

  -- Calculate time difference in seconds
  v_time_diff_seconds := EXTRACT(EPOCH FROM (p_timestamp - v_last_event.timestamp));

  -- Avoid division by zero (if events are at exact same time, it's suspicious)
  IF v_time_diff_seconds <= 0 THEN
    RETURN QUERY SELECT
      true,
      'Events at identical timestamps',
      NULL::NUMERIC,
      v_distance,
      0::NUMERIC;
    RETURN;
  END IF;

  -- Calculate speed in km/h
  v_speed_kmh := (v_distance / 1000) / (v_time_diff_seconds / 3600);

  -- Check if speed exceeds maximum plausible speed
  IF v_speed_kmh > v_max_speed_kmh THEN
    RETURN QUERY SELECT
      true,
      format('Speed %.0f km/h exceeds maximum plausible speed', v_speed_kmh),
      v_speed_kmh,
      v_distance,
      (v_time_diff_seconds / 60)::NUMERIC;
    RETURN;
  END IF;

  -- Not suspicious
  RETURN QUERY SELECT
    false,
    NULL::TEXT,
    v_speed_kmh,
    v_distance,
    (v_time_diff_seconds / 60)::NUMERIC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_open_shift(p_swap_id uuid, p_claimer_id uuid, p_target_date date DEFAULT NULL::date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_swap shift_swap_requests%ROWTYPE;
  v_claimer_user UUID;
BEGIN
  SELECT * INTO v_swap
  FROM shift_swap_requests
  WHERE id = p_swap_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift swap not found';
  END IF;

  IF v_swap.status <> 'pending' OR v_swap.target_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Shift swap is not open for claims';
  END IF;

  SELECT user_id INTO v_claimer_user
  FROM employees
  WHERE id = p_claimer_id
    AND organization_id = v_swap.organization_id
    AND termination_date IS NULL;

  IF v_claimer_user IS NULL THEN
    RAISE EXCEPTION 'Claimer not found';
  END IF;

  IF current_setting('touchorbit.current_user_id', true)::uuid IS DISTINCT FROM v_claimer_user AND NOT has_permission_for_employee('roster.edit', p_claimer_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_claimer_id = v_swap.requester_employee_id THEN
    RAISE EXCEPTION 'Requester cannot claim their own swap';
  END IF;

  UPDATE shift_swap_requests
  SET target_employee_id = p_claimer_id,
      target_date = COALESCE(p_target_date, v_swap.target_date),
      status = 'claimed',
      claimed_by = p_claimer_id,
      claimed_at = now()
  WHERE id = p_swap_id;

  RETURN 'claimed';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.copy_roster_week(p_source_week_start date, p_target_week_start date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  v_result := copy_roster_week_with_conflicts(p_source_week_start, p_target_week_start);
  RETURN COALESCE((v_result->>'copied')::INT, 0);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.copy_roster_week_with_conflicts(p_source_week_start date, p_target_week_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_assignment RECORD;
  v_target_date DATE;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
  v_copied INT := 0;
  v_conflicts INT := 0;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL OR NOT has_permission('roster.edit') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR v_assignment IN
    SELECT ra.employee_id, ra.date, ra.shift_id, ra.notes, s.start_time, s.end_time
    FROM roster_assignments ra
    LEFT JOIN shifts s ON s.id = ra.shift_id
    WHERE ra.organization_id = v_org_id
      AND ra.date >= p_source_week_start
      AND ra.date < p_source_week_start + INTERVAL '7 days'
      AND has_permission_for_employee('roster.edit', ra.employee_id)
  LOOP
    v_target_date := p_target_week_start + (v_assignment.date - p_source_week_start);
    v_has_conflict := false;

    IF v_assignment.shift_id IS NOT NULL AND v_assignment.start_time IS NOT NULL AND v_assignment.end_time IS NOT NULL THEN
      v_shift_start := (v_target_date + v_assignment.start_time)::TIMESTAMPTZ;
      v_shift_end := (v_target_date + v_assignment.end_time)::TIMESTAMPTZ
        + CASE WHEN v_assignment.end_time < v_assignment.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END;
      v_has_conflict := check_scheduling_conflict(v_assignment.employee_id, v_shift_start, v_shift_end);
    END IF;

    INSERT INTO roster_assignments (
      organization_id,
      employee_id,
      date,
      shift_id,
      notes,
      created_by,
      acknowledgment_status,
      conflict_reason,
      conflict_flagged_at
    )
    VALUES (
      v_org_id,
      v_assignment.employee_id,
      v_target_date,
      v_assignment.shift_id,
      v_assignment.notes,
      current_setting('touchorbit.current_user_id', true)::uuid,
      CASE WHEN v_has_conflict THEN 'conflict' ELSE 'pending' END,
      CASE WHEN v_has_conflict THEN 'Copied shift overlaps with leave, availability, event, or existing roster item' ELSE NULL END,
      CASE WHEN v_has_conflict THEN now() ELSE NULL END
    )
    ON CONFLICT (employee_id, date) DO NOTHING;

    IF FOUND THEN
      v_copied := v_copied + 1;
      IF v_has_conflict THEN
        v_conflicts := v_conflicts + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'copied', v_copied,
    'conflicts', v_conflicts,
    'source_week_start', p_source_week_start,
    'target_week_start', p_target_week_start
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_calendar_event(p_title text, p_description text DEFAULT NULL::text, p_event_type text DEFAULT 'meeting'::text, p_event_scope text DEFAULT 'organization'::text, p_start_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_all_day boolean DEFAULT false, p_branch_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_secondary_branch_id uuid DEFAULT NULL::uuid, p_secondary_department_id uuid DEFAULT NULL::uuid, p_team_member_ids uuid[] DEFAULT ARRAY[]::uuid[], p_meeting_provider text DEFAULT NULL::text, p_meeting_url text DEFAULT NULL::text, p_meeting_id text DEFAULT NULL::text, p_requires_rsvp boolean DEFAULT false, p_reminder_minutes integer DEFAULT 30, p_attachments jsonb DEFAULT '[]'::jsonb, p_status text DEFAULT 'confirmed'::text, p_location text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_org_id UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  v_org_id := get_my_org_id();

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required to create calendar events';
  END IF;

  IF COALESCE(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'Event title is required';
  END IF;

  v_start := p_start_time;
  v_end := COALESCE(p_end_time, p_start_time);

  IF v_start IS NULL OR v_end IS NULL OR v_end < v_start THEN
    RAISE EXCEPTION 'Invalid event schedule';
  END IF;

  IF p_event_scope IN ('branch', 'branch_to_branch') AND p_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for branch-scoped events';
  END IF;

  IF p_event_scope IN ('department', 'dept_to_dept') AND p_department_id IS NULL THEN
    RAISE EXCEPTION 'department_id is required for department-scoped events';
  END IF;

  IF p_event_scope IN ('team', 'one_on_one') AND COALESCE(array_length(p_team_member_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'team_member_ids is required for team and one_on_one events';
  END IF;

  INSERT INTO calendar_events (
    organization_id,
    title,
    description,
    event_date,
    start_time,
    end_time,
    created_by,
    event_type,
    target_type,
    target_id,
    start_at,
    end_at,
    all_day,
    event_scope,
    branch_id,
    department_id,
    secondary_branch_id,
    secondary_department_id,
    team_member_ids,
    meeting_provider,
    meeting_url,
    meeting_id,
    requires_rsvp,
    reminder_minutes,
    attachments,
    status,
    location
  )
  VALUES (
    v_org_id,
    trim(p_title),
    p_description,
    v_start::DATE,
    CASE WHEN p_all_day THEN NULL ELSE v_start::TIME END,
    CASE WHEN p_all_day THEN NULL ELSE v_end::TIME END,
    current_setting('touchorbit.current_user_id', true)::uuid,
    p_event_type,
    calendar_event_target_type(p_event_scope),
    COALESCE(p_department_id::TEXT, p_branch_id::TEXT, p_team_member_ids[1]::TEXT),
    v_start,
    v_end,
    COALESCE(p_all_day, false),
    p_event_scope,
    p_branch_id,
    p_department_id,
    p_secondary_branch_id,
    p_secondary_department_id,
    COALESCE(p_team_member_ids, ARRAY[]::UUID[]),
    p_meeting_provider,
    p_meeting_url,
    p_meeting_id,
    COALESCE(p_requires_rsvp, false),
    COALESCE(p_reminder_minutes, 30),
    COALESCE(p_attachments, '[]'::JSONB),
    COALESCE(p_status, 'confirmed'),
    p_location
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_due_task_reminder_notifications(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_count INT := 0;
BEGIN
  FOR v_task IN
    SELECT
      t.id,
      t.organization_id,
      t.employee_id,
      t.title,
      t.due_date,
      e.user_id
    FROM employee_tasks t
    JOIN employees e ON e.id = t.employee_id
    WHERE t.status <> 'completed'
      AND t.reminder_at IS NOT NULL
      AND t.reminder_at <= now()
      AND (t.reminder_snoozed_until IS NULL OR t.reminder_snoozed_until <= now())
      AND (t.last_reminded_at IS NULL OR t.last_reminded_at < t.reminder_at)
      AND e.user_id IS NOT NULL
    ORDER BY t.reminder_at
    LIMIT GREATEST(p_limit, 1)
  LOOP
    BEGIN
      PERFORM create_notification(
        v_task.organization_id,
        v_task.user_id,
        'task_reminder',
        'Task Reminder',
        v_task.title || COALESCE(' is due ' || to_char(v_task.due_date, 'Mon DD, YYYY HH12:MI AM'), ''),
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date)
      );

      UPDATE employee_tasks
      SET last_reminded_at = now(),
          updated_at = now()
      WHERE id = v_task.id;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'create_due_task_reminder_notifications failed for task %: %', v_task.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_meeting_with_provider(p_event_id uuid, p_provider text, p_org_id uuid, p_user_id uuid, p_meeting_url text, p_meeting_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE calendar_events
  SET meeting_provider = p_provider,
      meeting_url = p_meeting_url,
      meeting_id = p_meeting_id,
      updated_at = now()
  WHERE id = p_event_id
    AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar event not found';
  END IF;

  RETURN jsonb_build_object(
    'meeting_url', p_meeting_url,
    'meeting_id', p_meeting_id,
    'provider', p_provider
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.create_notification(p_organization_id uuid, p_user_id uuid, p_type text, p_title text, p_message text, p_data_json jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (organization_id, user_id, type, title, message, data_json)
  VALUES (p_organization_id, p_user_id, p_type, p_title, p_message, p_data_json)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.detect_and_create_overtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_policy RECORD;
  v_org RECORD;
  v_clock_in RECORD;
  v_break_minutes NUMERIC := 0;
  v_hours_worked NUMERIC;
  v_shift_hours NUMERIC;
  v_overtime_hours NUMERIC;
  v_rate NUMERIC;
  v_is_weekend BOOLEAN;
  v_is_holiday BOOLEAN := false;
  v_status TEXT;
BEGIN
  -- Only process clock-out events
  IF NEW.event_type != 'clock_out' THEN
    RETURN NEW;
  END IF;

  -- Get overtime policy for this organization
  BEGIN
    SELECT * INTO v_policy
    FROM overtime_policies
    WHERE organization_id = NEW.organization_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to fetch overtime policy: %', SQLERRM;
    RETURN NEW;
  END;

  -- If no policy or auto_detect is disabled, skip
  IF v_policy IS NULL OR v_policy.auto_detect = false THEN
    RETURN NEW;
  END IF;

  -- Get organization work hours
  BEGIN
    SELECT * INTO v_org
    FROM organizations
    WHERE id = NEW.organization_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to fetch organization: %', SQLERRM;
    RETURN NEW;
  END;

  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the corresponding clock-in event
  BEGIN
    SELECT * INTO v_clock_in
    FROM clock_events
    WHERE employee_id = NEW.employee_id
      AND event_type = 'clock_in'
      AND timestamp < NEW.timestamp
      AND timestamp::date = NEW.timestamp::date
    ORDER BY timestamp DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to fetch clock-in event: %', SQLERRM;
    RETURN NEW;
  END;

  -- If no clock-in found, can't calculate hours
  IF v_clock_in IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total break time for this work session
  -- Wrap in try-catch in case break_events table has issues
  BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0) INTO v_break_minutes
    FROM break_events
    WHERE employee_id = NEW.employee_id
      AND clock_event_id = v_clock_in.id
      AND break_end IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- If break_events query fails, just use 0 break time
    RAISE WARNING 'Failed to calculate break time: %', SQLERRM;
    v_break_minutes := 0;
  END;

  -- Calculate hours worked (excluding breaks)
  v_hours_worked := (EXTRACT(EPOCH FROM (NEW.timestamp - v_clock_in.timestamp)) / 3600) - (v_break_minutes / 60.0);

  -- Calculate shift hours from organization settings
  BEGIN
    v_shift_hours := EXTRACT(EPOCH FROM (v_org.work_hours_end::time - v_org.work_hours_start::time)) / 3600;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to calculate shift hours: %', SQLERRM;
    RETURN NEW;
  END;

  -- If hours worked exceeds shift hours, create overtime record
  IF v_hours_worked > v_shift_hours THEN
    v_overtime_hours := v_hours_worked - v_shift_hours;

    -- Determine if it's a weekend
    v_is_weekend := EXTRACT(DOW FROM NEW.timestamp) IN (0, 6);

    -- Check if it's a holiday (holidays table might not exist yet)
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM holidays
        WHERE organization_id = NEW.organization_id
          AND date = NEW.timestamp::date
          AND type IN ('public', 'company')
      ) INTO v_is_holiday;
    EXCEPTION WHEN OTHERS THEN
      -- Holidays table doesn't exist yet, treat as non-holiday
      v_is_holiday := false;
    END;

    -- Determine overtime rate
    IF v_is_holiday THEN
      v_rate := v_policy.holiday_rate;
    ELSIF v_is_weekend THEN
      v_rate := v_policy.weekend_rate;
    ELSE
      v_rate := v_policy.weekday_rate;
    END IF;

    -- Determine status
    IF v_policy.requires_approval THEN
      v_status := 'pending';
    ELSE
      v_status := 'approved';
    END IF;

    -- Check if overtime record already exists for this date
    BEGIN
      IF NOT EXISTS(
        SELECT 1 FROM overtime_records
        WHERE employee_id = NEW.employee_id
          AND date = NEW.timestamp::date
      ) THEN
        -- Create overtime record
        INSERT INTO overtime_records (
          organization_id,
          employee_id,
          date,
          hours,
          rate,
          reason,
          status
        ) VALUES (
          NEW.organization_id,
          NEW.employee_id,
          NEW.timestamp::date,
          v_overtime_hours,
          v_rate,
          'Auto-detected: exceeded shift hours',
          v_status
        );

        RAISE NOTICE 'Overtime detected: % hours for employee % on %', v_overtime_hours, NEW.employee_id, NEW.timestamp::date;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If overtime record creation fails, log but don't block clock-out
      RAISE WARNING 'Failed to create overtime record: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- If anything else goes wrong, don't block the clock-out
  RAISE WARNING 'Overtime detection failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_org_position_references()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_department_org_id UUID;
  v_manager_org_id UUID;
  v_filled_by_org_id UUID;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.department_id IS NOT NULL THEN
    SELECT organization_id
    INTO v_department_org_id
    FROM departments
    WHERE id = NEW.department_id;

    IF v_department_org_id IS NULL THEN
      RAISE EXCEPTION 'Department % does not exist', NEW.department_id USING ERRCODE = '22023';
    END IF;

    IF v_department_org_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Position department must belong to the same organization' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.manager_id IS NOT NULL THEN
    SELECT organization_id
    INTO v_manager_org_id
    FROM employees
    WHERE id = NEW.manager_id;

    IF v_manager_org_id IS NULL THEN
      RAISE EXCEPTION 'Manager % does not exist', NEW.manager_id USING ERRCODE = '22023';
    END IF;

    IF v_manager_org_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Position manager must belong to the same organization' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.filled_by_employee_id IS NOT NULL THEN
    SELECT organization_id
    INTO v_filled_by_org_id
    FROM employees
    WHERE id = NEW.filled_by_employee_id;

    IF v_filled_by_org_id IS NULL THEN
      RAISE EXCEPTION 'Filled employee % does not exist', NEW.filled_by_employee_id USING ERRCODE = '22023';
    END IF;

    IF v_filled_by_org_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Filled employee must belong to the same organization' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_single_default_meeting_provider()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default THEN
    UPDATE organization_meeting_providers
    SET is_default = false
    WHERE organization_id = NEW.organization_id
      AND id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_correction_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_name TEXT;
    v_admin_id UUID;
BEGIN
    IF (NEW.status = 'pending') THEN
        BEGIN
            SELECT e.first_name || ' ' || e.last_name INTO v_name
            FROM employees e WHERE e.id = NEW.employee_id;

            FOR v_admin_id IN
                SELECT id FROM users
                WHERE organization_id = NEW.organization_id
                  AND role IN ('owner', 'manager', 'hr_admin')
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_admin_id, 'correction_submitted',
                    'New Correction Request',
                    v_name || ' submitted an attendance correction request'
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_correction_submitted: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_correction_submitted unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_expense_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_name TEXT;
    v_user_id UUID;
    v_admin_id UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        BEGIN
            SELECT e.first_name || ' ' || e.last_name INTO v_name
            FROM employees e WHERE e.id = NEW.employee_id;

            FOR v_admin_id IN
                SELECT id FROM users
                WHERE organization_id = NEW.organization_id
                  AND role IN ('owner', 'manager', 'hr_admin')
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_admin_id, 'expense_submitted',
                    'New Expense Claim',
                    v_name || ' submitted an expense claim for LKR ' || NEW.amount
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_expense_event insert: %', SQLERRM;
        END;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')) THEN
        BEGIN
            SELECT e.user_id INTO v_user_id FROM employees e WHERE e.id = NEW.employee_id;
            IF v_user_id IS NOT NULL THEN
                PERFORM create_notification(
                    NEW.organization_id, v_user_id, 'expense_' || NEW.status,
                    'Expense Claim ' || INITCAP(NEW.status),
                    'Your expense claim of LKR ' || NEW.amount || ' has been ' || NEW.status
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_expense_event update: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_expense_event unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_leave_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_name TEXT;
    v_user_id UUID;
    v_admin_id UUID;
BEGIN
    BEGIN
        SELECT e.first_name || ' ' || e.last_name, e.user_id
        INTO v_name, v_user_id
        FROM employees e WHERE e.id = NEW.employee_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_notify_leave_event: failed to get employee: %', SQLERRM;
        RETURN NEW;
    END;

    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        BEGIN
            FOR v_admin_id IN
                SELECT id FROM users
                WHERE organization_id = NEW.organization_id
                  AND role IN ('owner', 'manager', 'hr_admin')
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_admin_id, 'leave_submitted',
                    'New Leave Request',
                    v_name || ' submitted a ' || NEW.leave_type || ' leave request'
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_leave_event submit: %', SQLERRM;
        END;
    END IF;

    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')) THEN
        BEGIN
            IF v_user_id IS NOT NULL THEN
                PERFORM create_notification(
                    NEW.organization_id, v_user_id, 'leave_' || NEW.status,
                    'Leave Request ' || INITCAP(NEW.status),
                    'Your ' || NEW.leave_type || ' leave request has been ' || NEW.status
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_leave_event status: %', SQLERRM;
        END;
    END IF;

    IF (TG_OP = 'UPDATE' AND NEW.cancellation_requested = true AND (OLD.cancellation_requested IS DISTINCT FROM true)) THEN
        BEGIN
            FOR v_admin_id IN
                SELECT id FROM users
                WHERE organization_id = NEW.organization_id
                  AND role IN ('owner', 'manager', 'hr_admin')
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_admin_id, 'leave_cancellation_requested',
                    'Leave Cancellation Requested',
                    v_name || ' requested to cancel their approved leave'
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_leave_event cancellation: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_leave_event unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_low_coverage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_week_start DATE;
  v_week_end DATE;
  v_active_employees INT := 0;
  v_assigned_days INT := 0;
  v_potential_days INT := 0;
  v_rate NUMERIC := 100;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  v_week_start := date_trunc('week', COALESCE(NEW.date, OLD.date))::DATE;
  v_week_end := v_week_start + 6;

  SELECT COUNT(*)
  INTO v_active_employees
  FROM employees
  WHERE organization_id = v_org_id
    AND termination_date IS NULL
    AND COALESCE(employment_status, 'active') = 'active';

  v_potential_days := v_active_employees * 7;

  SELECT COUNT(DISTINCT (employee_id, date))
  INTO v_assigned_days
  FROM roster_assignments
  WHERE organization_id = v_org_id
    AND date >= v_week_start
    AND date <= v_week_end
    AND shift_id IS NOT NULL;

  IF v_potential_days > 0 THEN
    v_rate := ROUND((v_assigned_days::NUMERIC / v_potential_days::NUMERIC) * 100, 2);
  END IF;

  IF v_potential_days > 0 AND v_rate < 70 THEN
    PERFORM notify_admins_for_calendar_hub(
      v_org_id,
      'coverage_low',
      'Low Roster Coverage',
      'Roster coverage is below 70% for the week starting ' || to_char(v_week_start, 'Mon DD, YYYY') || '.',
      jsonb_build_object(
        'week_start', v_week_start,
        'week_end', v_week_end,
        'coverage_rate', v_rate,
        'assigned_shift_days', v_assigned_days,
        'potential_shift_days', v_potential_days
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_overtime_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_policy overtime_policies%ROWTYPE;
BEGIN
  SELECT *
  INTO v_policy
  FROM overtime_policies
  WHERE organization_id = NEW.organization_id;

  IF NEW.status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3')
     OR NEW.hours >= COALESCE(v_policy.max_daily_hours, 4.0) THEN
    PERFORM notify_admins_for_calendar_hub(
      NEW.organization_id,
      'overtime_alert',
      'Overtime Alert',
      'An overtime record needs review.',
      jsonb_build_object(
        'overtime_id', NEW.id,
        'employee_id', NEW.employee_id,
        'date', NEW.date,
        'hours', NEW.hours,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_overtime_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_name TEXT;
    v_admin_id UUID;
BEGIN
    IF (NEW.status = 'pending') THEN
        BEGIN
            SELECT e.first_name || ' ' || e.last_name INTO v_name
            FROM employees e WHERE e.id = NEW.employee_id;

            FOR v_admin_id IN
                SELECT id FROM users
                WHERE organization_id = NEW.organization_id
                  AND role IN ('owner', 'manager', 'hr_admin')
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_admin_id, 'overtime_submitted',
                    'New Overtime Request',
                    v_name || ' submitted an overtime request for ' || NEW.hours || 'h on ' || NEW.date
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_overtime_submitted: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_overtime_submitted unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_payroll_finalized()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    IF (NEW.status = 'finalized' AND OLD.status != 'finalized') THEN
        BEGIN
            FOR v_user_id IN
                SELECT e.user_id FROM employees e
                WHERE e.organization_id = NEW.organization_id
                  AND e.user_id IS NOT NULL
                  AND e.employment_status = 'active'
            LOOP
                PERFORM create_notification(
                    NEW.organization_id, v_user_id, 'payroll_finalized',
                    'Payslip Ready',
                    'Your payslip for ' || TO_CHAR(make_date(NEW.year, NEW.month, 1), 'Month YYYY') || ' is now available'
                );
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_notify_payroll_finalized: %', SQLERRM;
        END;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_payroll_finalized unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_salary_revised()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        SELECT e.user_id INTO v_user_id FROM employees e WHERE e.id = NEW.employee_id;
        IF v_user_id IS NOT NULL THEN
            PERFORM create_notification(
                NEW.organization_id, v_user_id, 'salary_revised',
                'Salary Revision Recorded',
                'Your salary has been updated to LKR ' || NEW.new_basic_salary || ', effective ' || NEW.effective_date
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_notify_salary_revised: %', SQLERRM;
    END;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_salary_revised unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_shift_conflict()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'open' AND NEW.conflict_type IN ('roster_shift_overlap', 'roster_conflict') THEN
    PERFORM notify_admins_for_calendar_hub(
      NEW.organization_id,
      'shift_conflict',
      'Shift Conflict Detected',
      COALESCE(NEW.message, 'A roster conflict was detected.'),
      jsonb_build_object(
        'conflict_id', NEW.id,
        'employee_id', NEW.employee_id,
        'conflict_date', NEW.conflict_date,
        'source_id', NEW.source_id,
        'conflicting_source_id', NEW.conflicting_source_id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_notify_training_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        SELECT e.user_id INTO v_user_id FROM employees e WHERE e.id = NEW.employee_id;
        IF v_user_id IS NOT NULL THEN
            PERFORM create_notification(
                NEW.organization_id, v_user_id, 'training_assigned',
                'Training Assigned',
                'You have been enrolled in: ' || NEW.training_name || ' (starts ' || NEW.start_date || ')'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_notify_training_assigned: %', SQLERRM;
    END;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_notify_training_assigned unexpected: %', SQLERRM;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_adherence_summary(p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, total_scheduled integer, on_time_count integer, late_count integer, early_departure_count integer, absent_count integer, late_early_count integer, adherence_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  RETURN QUERY
  WITH date_range AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS day
  ),
  active_employees AS (
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS name,
      d.name AS dept_name
    FROM  employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = v_org_id
      AND e.termination_date IS NULL
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_employee_ids  IS NULL OR e.id = ANY(p_employee_ids))
  ),
  assignments AS (
    SELECT
      ae.id           AS employee_id,
      ae.name         AS employee_name,
      ae.dept_name    AS department_name,
      dr.day          AS assignment_date,
      ra.shift_id,
      s.start_time,
      s.end_time
    FROM  active_employees ae
    CROSS JOIN date_range dr
    LEFT JOIN roster_assignments ra ON ae.id = ra.employee_id AND ra.date = dr.day
    LEFT JOIN shifts             s  ON s.id = ra.shift_id
  ),
  daily_clocks AS (
    SELECT
      ce.employee_id,
      ce.timestamp::date AS clock_date,
      MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in')  AS first_in,
      MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
    FROM  clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.timestamp >= p_start_date::timestamptz
      AND ce.timestamp <  (p_end_date + interval '1 day')::timestamptz
    GROUP BY ce.employee_id, ce.timestamp::date
  ),
  adherence_base AS (
    SELECT
      a.employee_id,
      a.employee_name,
      a.department_name,
      CASE
        WHEN a.shift_id IS NULL THEN 'day_off'
        WHEN dc.first_in IS NULL         THEN 'absent'
        WHEN dc.first_in::time  > (a.start_time + interval '5 minutes')
         AND dc.last_out IS NOT NULL
         AND dc.last_out::time < (a.end_time   - interval '5 minutes') THEN 'late_early'
        WHEN dc.first_in::time  > (a.start_time + interval '5 minutes') THEN 'late'
        WHEN dc.last_out IS NOT NULL
         AND dc.last_out::time < (a.end_time   - interval '5 minutes') THEN 'early_departure'
        ELSE 'on_time'
      END AS status
    FROM  assignments a
    LEFT JOIN daily_clocks dc ON dc.employee_id = a.employee_id AND dc.clock_date = a.assignment_date
    WHERE a.shift_id IS NOT NULL
  )
  SELECT
    ab.employee_id,
    ab.employee_name,
    ab.department_name,
    COUNT(*)::INT                                                         AS total_scheduled,
    COUNT(*) FILTER (WHERE ab.status = 'on_time')::INT                   AS on_time_count,
    COUNT(*) FILTER (WHERE ab.status = 'late')::INT                      AS late_count,
    COUNT(*) FILTER (WHERE ab.status = 'early_departure')::INT           AS early_departure_count,
    COUNT(*) FILTER (WHERE ab.status = 'absent')::INT                    AS absent_count,
    COUNT(*) FILTER (WHERE ab.status = 'late_early')::INT                AS late_early_count,
    CASE
      WHEN COUNT(*) > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE ab.status = 'on_time')::NUMERIC / COUNT(*) * 100, 1
        )
      ELSE 0
    END                                                                   AS adherence_rate
  FROM adherence_base ab
  GROUP BY ab.employee_id, ab.employee_name, ab.department_name
  ORDER BY absent_count DESC, late_count DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_admin_org_chart(p_root_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, manager_id uuid, employee_number text, first_name text, last_name text, full_name text, photo_url text, job_title text, date_of_birth date, department_id uuid, department_name text, department_code text, parent_department_id uuid, branch_id uuid, branch_name text, employment_status text, hire_date date, termination_date date, basic_salary numeric, depth integer, path_ids uuid[], path_names text[], sort_path text, direct_reports_count integer, total_reports_count integer, subtree_headcount integer, direct_reports_salary_total numeric, subtree_salary_total numeric, has_children boolean, is_current_user boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to view admin org chart';
  END IF;

  IF p_root_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM employees root_check
    WHERE root_check.id = p_root_id
      AND root_check.organization_id = v_org_id
      AND root_check.termination_date IS NULL
      AND COALESCE(root_check.employment_status, 'active') <> 'terminated'
      AND (p_branch_id IS NULL OR root_check.branch_id = p_branch_id)
  ) THEN
    RAISE EXCEPTION 'Org chart root is not available for this organization or branch';
  END IF;

  RETURN QUERY
  WITH RECURSIVE eligible_employees AS (
    SELECT
      emp.id,
      emp.manager_id,
      emp.employee_number,
      emp.first_name,
      emp.last_name,
      concat_ws(' ', emp.first_name, emp.last_name) AS full_name,
      emp.photo_url,
      emp.job_title,
      emp.date_of_birth,
      emp.department,
      emp.department_id,
      emp.branch_id,
      emp.user_id,
      emp.employment_status,
      emp.hire_date,
      emp.termination_date,
      emp.basic_salary
    FROM employees emp
    WHERE emp.organization_id = v_org_id
      AND emp.termination_date IS NULL
      AND COALESCE(emp.employment_status, 'active') <> 'terminated'
      AND (p_branch_id IS NULL OR emp.branch_id = p_branch_id)
  ),
  org_tree AS (
    SELECT
      root.*,
      0::INTEGER AS depth,
      ARRAY[root.id]::UUID[] AS path_ids,
      ARRAY[root.full_name]::TEXT[] AS path_names,
      lower(COALESCE(root.employee_number, '') || ':' || root.full_name || ':' || root.id::TEXT) AS sort_path
    FROM eligible_employees root
    WHERE (
      p_root_id IS NOT NULL
      AND root.id = p_root_id
    )
    OR (
      p_root_id IS NULL
      AND (
        root.manager_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM eligible_employees manager
          WHERE manager.id = root.manager_id
        )
      )
    )

    UNION ALL

    SELECT
      child.*,
      parent.depth + 1,
      parent.path_ids || child.id,
      parent.path_names || child.full_name,
      parent.sort_path || '>' || lower(COALESCE(child.employee_number, '') || ':' || child.full_name || ':' || child.id::TEXT)
    FROM eligible_employees child
    JOIN org_tree parent ON child.manager_id = parent.id
    WHERE child.id <> ALL(parent.path_ids)
  ),
  direct_rollups AS (
    SELECT
      child.manager_id,
      count(*)::INTEGER AS direct_reports_count,
      COALESCE(sum(child.basic_salary), 0)::NUMERIC AS direct_reports_salary_total
    FROM eligible_employees child
    WHERE child.manager_id IS NOT NULL
    GROUP BY child.manager_id
  ),
  subtree_edges AS (
    SELECT emp.id AS ancestor_id, emp.id AS descendant_id, ARRAY[emp.id]::UUID[] AS path_ids
    FROM eligible_employees emp

    UNION ALL

    SELECT se.ancestor_id, child.id, se.path_ids || child.id
    FROM subtree_edges se
    JOIN eligible_employees child ON child.manager_id = se.descendant_id
    WHERE child.id <> ALL(se.path_ids)
  ),
  subtree_rollups AS (
    SELECT
      se.ancestor_id,
      (count(*) - 1)::INTEGER AS total_reports_count,
      count(*)::INTEGER AS subtree_headcount,
      COALESCE(sum(descendant.basic_salary), 0)::NUMERIC AS subtree_salary_total
    FROM subtree_edges se
    JOIN eligible_employees descendant ON descendant.id = se.descendant_id
    GROUP BY se.ancestor_id
  )
  SELECT
    tree.id AS employee_id,
    tree.manager_id,
    tree.employee_number,
    tree.first_name,
    tree.last_name,
    tree.full_name,
    tree.photo_url,
    tree.job_title,
    tree.date_of_birth,
    tree.department_id,
    COALESCE(dept.name, tree.department) AS department_name,
    dept.code AS department_code,
    dept.parent_department_id,
    tree.branch_id,
    branch.name AS branch_name,
    tree.employment_status,
    tree.hire_date,
    tree.termination_date,
    tree.basic_salary,
    tree.depth,
    tree.path_ids,
    tree.path_names,
    tree.sort_path,
    COALESCE(dr.direct_reports_count, 0) AS direct_reports_count,
    COALESCE(sr.total_reports_count, 0) AS total_reports_count,
    COALESCE(sr.subtree_headcount, 1) AS subtree_headcount,
    COALESCE(dr.direct_reports_salary_total, 0)::NUMERIC AS direct_reports_salary_total,
    COALESCE(sr.subtree_salary_total, COALESCE(tree.basic_salary, 0))::NUMERIC AS subtree_salary_total,
    COALESCE(dr.direct_reports_count, 0) > 0 AS has_children,
    COALESCE(tree.user_id = current_setting('touchorbit.current_user_id', true)::uuid, false) AS is_current_user
  FROM org_tree tree
  LEFT JOIN departments dept
    ON dept.id = tree.department_id
   AND dept.organization_id = v_org_id
  LEFT JOIN branches branch
    ON branch.id = tree.branch_id
   AND branch.organization_id = v_org_id
  LEFT JOIN direct_rollups dr
    ON dr.manager_id = tree.id
  LEFT JOIN subtree_rollups sr
    ON sr.ancestor_id = tree.id
  ORDER BY tree.sort_path;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_attendance_detail(p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, work_date date, status text, shift_name text, clock_in timestamp with time zone, clock_out timestamp with time zone, hours_worked numeric, minutes_late integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_grace  INT;
BEGIN
  v_org_id := get_my_org_id();

  SELECT COALESCE(late_threshold_minutes, 5)
  INTO   v_grace
  FROM   organizations
  WHERE  id = v_org_id;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS work_date
  ),
  org_employees AS (
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS full_name,
      d.name AS dept_name
    FROM  employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = v_org_id
      AND e.termination_date IS NULL
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_employee_ids  IS NULL OR e.id = ANY(p_employee_ids))
  ),
  daily_clocks AS (
    SELECT
      ce.employee_id,
      ce.timestamp::date AS clock_date,
      MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in')  AS first_in,
      MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
    FROM  clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.timestamp::date BETWEEN p_start_date AND p_end_date
    GROUP BY ce.employee_id, ce.timestamp::date
  ),
  approved_leave AS (
    SELECT DISTINCT lr.employee_id, ds.work_date
    FROM  leave_records lr
    CROSS JOIN date_series ds
    WHERE lr.organization_id = v_org_id
      AND lr.status = 'approved'
      AND ds.work_date BETWEEN lr.start_date AND lr.end_date
  )
  SELECT
    oe.id                    AS employee_id,
    oe.full_name             AS employee_name,
    oe.dept_name             AS department_name,
    ds.work_date,
    CASE
      WHEN al.employee_id IS NOT NULL
        THEN 'on_leave'
      WHEN dc.first_in IS NULL AND ra.employee_id IS NULL
        THEN 'day_off'
      WHEN dc.first_in IS NULL
        THEN 'absent'
      WHEN s.start_time IS NOT NULL
        AND EXTRACT(EPOCH FROM (dc.first_in::time - s.start_time)) / 60 > v_grace
        THEN 'late'
      ELSE 'present'
    END                      AS status,
    s.name                   AS shift_name,
    dc.first_in              AS clock_in,
    dc.last_out              AS clock_out,
    CASE
      WHEN dc.first_in IS NOT NULL AND dc.last_out IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (dc.last_out - dc.first_in)) / 3600, 2)
      ELSE NULL
    END                      AS hours_worked,
    CASE
      WHEN dc.first_in IS NOT NULL AND al.employee_id IS NULL AND s.start_time IS NOT NULL
        THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (dc.first_in::time - s.start_time)) / 60)::INT)
      ELSE NULL
    END                      AS minutes_late
  FROM  org_employees oe
  CROSS JOIN date_series ds
  LEFT JOIN roster_assignments ra ON ra.employee_id = oe.id AND ra.date = ds.work_date
  LEFT JOIN shifts             s  ON s.id = ra.shift_id
  LEFT JOIN daily_clocks       dc ON dc.employee_id = oe.id AND dc.clock_date = ds.work_date
  LEFT JOIN approved_leave     al ON al.employee_id = oe.id AND al.work_date = ds.work_date
  -- exclude pure day-offs (no clock-in, no roster, no leave)
  WHERE dc.first_in IS NOT NULL
     OR ra.employee_id IS NOT NULL
     OR al.employee_id IS NOT NULL
  ORDER BY ds.work_date DESC, oe.full_name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_attendance_summary(p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, total_scheduled integer, present_count integer, late_count integer, absent_count integer, on_leave_count integer, avg_hours_worked numeric, attendance_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_grace  INT;
BEGIN
  v_org_id := get_my_org_id();

  SELECT COALESCE(late_threshold_minutes, 5)
  INTO   v_grace
  FROM   organizations
  WHERE  id = v_org_id;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS work_date
  ),
  org_employees AS (
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS full_name,
      d.name AS dept_name
    FROM  employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = v_org_id
      AND e.termination_date IS NULL
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_employee_ids  IS NULL OR e.id = ANY(p_employee_ids))
  ),
  daily_clocks AS (
    SELECT
      ce.employee_id,
      ce.timestamp::date AS clock_date,
      MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in')  AS first_in,
      MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
    FROM  clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.timestamp::date BETWEEN p_start_date AND p_end_date
    GROUP BY ce.employee_id, ce.timestamp::date
  ),
  approved_leave AS (
    SELECT DISTINCT lr.employee_id, ds.work_date
    FROM  leave_records lr
    CROSS JOIN date_series ds
    WHERE lr.organization_id = v_org_id
      AND lr.status = 'approved'
      AND ds.work_date BETWEEN lr.start_date AND lr.end_date
  ),
  day_statuses AS (
    SELECT
      oe.id        AS employee_id,
      oe.full_name AS employee_name,
      oe.dept_name AS department_name,
      ds.work_date,
      CASE
        WHEN al.employee_id IS NOT NULL
          THEN 'on_leave'
        WHEN dc.first_in IS NULL AND ra.employee_id IS NULL
          THEN 'day_off'
        WHEN dc.first_in IS NULL
          THEN 'absent'
        WHEN s.start_time IS NOT NULL
          AND EXTRACT(EPOCH FROM (dc.first_in::time - s.start_time)) / 60 > v_grace
          THEN 'late'
        ELSE 'present'
      END AS status,
      CASE
        WHEN dc.first_in IS NOT NULL AND dc.last_out IS NOT NULL
          THEN EXTRACT(EPOCH FROM (dc.last_out - dc.first_in)) / 3600
        ELSE NULL
      END AS hours_worked
    FROM  org_employees oe
    CROSS JOIN date_series ds
    LEFT JOIN roster_assignments ra ON ra.employee_id = oe.id AND ra.date = ds.work_date
    LEFT JOIN shifts             s  ON s.id = ra.shift_id
    LEFT JOIN daily_clocks       dc ON dc.employee_id = oe.id AND dc.clock_date = ds.work_date
    LEFT JOIN approved_leave     al ON al.employee_id = oe.id AND al.work_date = ds.work_date
    -- exclude pure day-offs (no clock-in, no roster, no leave)
    WHERE dc.first_in IS NOT NULL
       OR ra.employee_id IS NOT NULL
       OR al.employee_id IS NOT NULL
  )
  SELECT
    ds.employee_id,
    ds.employee_name,
    ds.department_name,
    COUNT(*) FILTER (WHERE ds.status != 'day_off')::INT              AS total_scheduled,
    COUNT(*) FILTER (WHERE ds.status = 'present')::INT               AS present_count,
    COUNT(*) FILTER (WHERE ds.status = 'late')::INT                  AS late_count,
    COUNT(*) FILTER (WHERE ds.status = 'absent')::INT                AS absent_count,
    COUNT(*) FILTER (WHERE ds.status = 'on_leave')::INT              AS on_leave_count,
    ROUND(AVG(ds.hours_worked) FILTER (WHERE ds.hours_worked IS NOT NULL), 1) AS avg_hours_worked,
    CASE
      WHEN COUNT(*) FILTER (WHERE ds.status != 'day_off') > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE ds.status IN ('present', 'late'))::NUMERIC
          / NULLIF(COUNT(*) FILTER (WHERE ds.status != 'day_off'), 0) * 100, 1
        )
      ELSE 0
    END                                                               AS attendance_rate
  FROM day_statuses ds
  GROUP BY ds.employee_id, ds.employee_name, ds.department_name
  HAVING COUNT(*) FILTER (WHERE ds.status != 'day_off') > 0
  ORDER BY attendance_rate ASC, ds.employee_name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_audit_events(p_start_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_actor_user_id uuid DEFAULT NULL::uuid, p_target_employee_id uuid DEFAULT NULL::uuid, p_target_user_id uuid DEFAULT NULL::uuid, p_module text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_severity text DEFAULT NULL::text, p_entity_type text DEFAULT NULL::text, p_entity_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_require_audit_permission boolean DEFAULT true)
 RETURNS TABLE(id uuid, organization_id uuid, source_table text, actor_user_id uuid, actor_name text, actor_email text, target_user_id uuid, target_employee_id uuid, target_name text, module text, action text, severity text, entity_type text, entity_id uuid, entity_label text, old_value jsonb, new_value jsonb, changed_fields jsonb, metadata jsonb, source text, ip_address text, user_agent text, created_at timestamp with time zone, is_sensitive boolean, is_redacted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_can_sensitive BOOLEAN;
  v_limit INT;
  v_offset INT;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_require_audit_permission, true) AND NOT has_permission('audit.read') THEN
    RAISE EXCEPTION 'Not authorized to read audit events' USING ERRCODE = '42501';
  END IF;

  v_can_sensitive := has_permission('audit.read_sensitive');
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH raw_events AS (
    SELECT
      ae.id,
      ae.organization_id,
      'audit_events'::TEXT AS source_table,
      ae.actor_user_id,
      ae.actor_name_snapshot AS actor_name,
      ae.actor_email_snapshot AS actor_email,
      ae.target_user_id,
      ae.target_employee_id,
      ae.target_name_snapshot AS target_name,
      ae.module,
      ae.action,
      ae.severity,
      ae.entity_type,
      ae.entity_id,
      ae.entity_label,
      ae.old_value,
      ae.new_value,
      ae.changed_fields,
      ae.metadata,
      ae.source,
      ae.ip_address,
      ae.user_agent,
      ae.created_at
    FROM audit_events ae
    WHERE ae.organization_id = v_org_id

    UNION ALL

    SELECT
      eh.id,
      e.organization_id,
      'employee_history'::TEXT AS source_table,
      eh.changed_by AS actor_user_id,
      COALESCE(eh.changed_by_name, NULLIF(concat_ws(' ', u.first_name, u.last_name), ''), u.email, 'System') AS actor_name,
      u.email AS actor_email,
      e.user_id AS target_user_id,
      eh.employee_id AS target_employee_id,
      COALESCE(NULLIF(concat_ws(' ', e.first_name, e.last_name), ''), e.email, e.employee_number, e.id::TEXT) AS target_name,
      audit_employee_history_module(eh.event_type, COALESCE(eh.details, '{}'::JSONB)) AS module,
      audit_employee_history_action(eh.event_type) AS action,
      audit_employee_history_severity(eh.event_type, COALESCE(eh.details, '{}'::JSONB)) AS severity,
      'employee'::TEXT AS entity_type,
      eh.employee_id AS entity_id,
      COALESCE(NULLIF(concat_ws(' ', e.first_name, e.last_name), ''), e.email, e.employee_number, e.id::TEXT) AS entity_label,
      audit_employee_history_old_value(COALESCE(eh.details, '{}'::JSONB)) AS old_value,
      audit_employee_history_new_value(COALESCE(eh.details, '{}'::JSONB)) AS new_value,
      CASE
        WHEN COALESCE(eh.details, '{}'::JSONB) ? 'field' THEN jsonb_build_array(eh.details ->> 'field')
        ELSE '[]'::JSONB
      END AS changed_fields,
      jsonb_build_object(
        'legacy_event_type', eh.event_type,
        'description', eh.description,
        'details', COALESCE(eh.details, '{}'::JSONB)
      ) AS metadata,
      'legacy'::TEXT AS source,
      NULL::TEXT AS ip_address,
      NULL::TEXT AS user_agent,
      COALESCE(eh.event_date, eh.created_at) AS created_at
    FROM employee_history eh
    JOIN employees e ON e.id = eh.employee_id
    LEFT JOIN users u ON u.id = eh.changed_by
    WHERE e.organization_id = v_org_id
      AND NOT EXISTS (
        SELECT 1
        FROM audit_events mirrored
        WHERE mirrored.organization_id = e.organization_id
          AND mirrored.metadata ->> 'legacy_source_table' = 'employee_history'
          AND mirrored.metadata ->> 'legacy_source_id' = eh.id::TEXT
      )

    UNION ALL

    SELECT
      sal.id,
      sal.organization_id,
      'security_audit_log'::TEXT AS source_table,
      sal.actor_user_id,
      COALESCE(NULLIF(concat_ws(' ', au.first_name, au.last_name), ''), au.email, 'System') AS actor_name,
      au.email AS actor_email,
      sal.target_user_id,
      sal.target_employee_id,
      COALESCE(
        NULLIF(concat_ws(' ', te.first_name, te.last_name), ''),
        tu.email,
        te.email,
        te.employee_number,
        sal.target_employee_id::TEXT,
        sal.target_user_id::TEXT
      ) AS target_name,
      'security'::TEXT AS module,
      lower(COALESCE(sal.action, 'updated')) AS action,
      'sensitive'::TEXT AS severity,
      COALESCE(sal.entity_type, 'security') AS entity_type,
      sal.entity_id,
      COALESCE(sal.entity_type, 'security') AS entity_label,
      COALESCE(sal.old_value, '{}'::JSONB) AS old_value,
      COALESCE(sal.new_value, '{}'::JSONB) AS new_value,
      '[]'::JSONB AS changed_fields,
      '{}'::JSONB AS metadata,
      'legacy'::TEXT AS source,
      sal.ip_address,
      sal.user_agent,
      sal.created_at
    FROM security_audit_log sal
    LEFT JOIN users au ON au.id = sal.actor_user_id
    LEFT JOIN users tu ON tu.id = sal.target_user_id
    LEFT JOIN employees te ON te.id = sal.target_employee_id
    WHERE sal.organization_id = v_org_id
      AND NOT EXISTS (
        SELECT 1
        FROM audit_events mirrored
        WHERE mirrored.organization_id = sal.organization_id
          AND mirrored.metadata ->> 'legacy_source_table' = 'security_audit_log'
          AND mirrored.metadata ->> 'legacy_source_id' = sal.id::TEXT
      )
  ),
  filtered_events AS (
    SELECT
      re.*,
      audit_is_sensitive(re.module, re.action, re.severity, re.entity_type, re.old_value, re.new_value, re.metadata) AS sensitive
    FROM raw_events re
    WHERE (p_start_at IS NULL OR re.created_at >= p_start_at)
      AND (p_end_at IS NULL OR re.created_at <= p_end_at)
      AND (p_actor_user_id IS NULL OR re.actor_user_id = p_actor_user_id)
      AND (p_target_employee_id IS NULL OR re.target_employee_id = p_target_employee_id)
      AND (p_target_user_id IS NULL OR re.target_user_id = p_target_user_id)
      AND (p_module IS NULL OR re.module = lower(p_module))
      AND (p_action IS NULL OR re.action = lower(p_action))
      AND (p_severity IS NULL OR re.severity = lower(p_severity))
      AND (p_entity_type IS NULL OR re.entity_type = p_entity_type)
      AND (p_entity_id IS NULL OR re.entity_id = p_entity_id)
      AND (
        p_search IS NULL
        OR p_search = ''
        OR re.actor_name ILIKE '%' || p_search || '%'
        OR re.actor_email ILIKE '%' || p_search || '%'
        OR re.target_name ILIKE '%' || p_search || '%'
        OR re.module ILIKE '%' || p_search || '%'
        OR re.action ILIKE '%' || p_search || '%'
        OR re.entity_type ILIKE '%' || p_search || '%'
        OR re.entity_label ILIKE '%' || p_search || '%'
      )
  )
  SELECT
    fe.id,
    fe.organization_id,
    fe.source_table,
    fe.actor_user_id,
    fe.actor_name,
    fe.actor_email,
    fe.target_user_id,
    fe.target_employee_id,
    fe.target_name,
    fe.module,
    fe.action,
    fe.severity,
    fe.entity_type,
    fe.entity_id,
    fe.entity_label,
    audit_redact_jsonb(fe.old_value, fe.sensitive AND NOT v_can_sensitive) AS old_value,
    audit_redact_jsonb(fe.new_value, fe.sensitive AND NOT v_can_sensitive) AS new_value,
    CASE WHEN fe.sensitive AND NOT v_can_sensitive THEN '[]'::JSONB ELSE fe.changed_fields END AS changed_fields,
    CASE
      WHEN fe.sensitive AND NOT v_can_sensitive THEN fe.metadata - 'details'
      ELSE fe.metadata
    END AS metadata,
    fe.source,
    fe.ip_address,
    fe.user_agent,
    fe.created_at,
    fe.sensitive AS is_sensitive,
    (fe.sensitive AND NOT v_can_sensitive) AS is_redacted,
    count(*) OVER () AS total_count
  FROM filtered_events fe
  ORDER BY fe.created_at DESC, fe.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_audit_policy_settings()
 RETURNS TABLE(id uuid, organization_id uuid, capture_ip_mode text, retention_days integer, optional_modules jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    has_permission('audit.read')
    OR has_permission('settings.manage_security')
    OR has_permission('audit.manage_retention')
  ) THEN
    RAISE EXCEPTION 'Not authorized to read audit policy settings' USING ERRCODE = '42501';
  END IF;

  INSERT INTO audit_policy_settings (organization_id, created_by)
  VALUES (v_org_id, current_setting('touchorbit.current_user_id', true)::uuid)
  ON CONFLICT ON CONSTRAINT audit_policy_settings_organization_id_key DO NOTHING;

  RETURN QUERY
  SELECT
    aps.id,
    aps.organization_id,
    aps.capture_ip_mode,
    aps.retention_days,
    aps.optional_modules,
    aps.created_at,
    aps.updated_at
  FROM audit_policy_settings aps
  WHERE aps.organization_id = v_org_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_branch_holidays(p_org_id uuid, p_start_date date, p_end_date date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, date date, type text, recurring boolean, description text, branch_id uuid, branch_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Not authorized to read holidays for this organization';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.date,
    h.type,
    COALESCE(h.recurring, false),
    h.description,
    h.branch_id,
    b.name AS branch_name
  FROM holidays h
  LEFT JOIN branches b ON b.id = h.branch_id
  WHERE h.organization_id = p_org_id
    AND h.date >= p_start_date
    AND h.date <= p_end_date
    AND (h.branch_id IS NULL OR h.branch_id = p_branch_id OR p_branch_id IS NULL)
  ORDER BY h.date, h.branch_id NULLS FIRST, h.name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_calendar_analytics(p_org_id uuid, p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_active_employees INT := 0;
  v_days INT := 0;
  v_potential_shift_days INT := 0;
  v_assigned_shift_days INT := 0;
  v_shift_count INT := 0;
  v_total_events INT := 0;
  v_meeting_events INT := 0;
  v_online_meetings INT := 0;
  v_rsvp_events INT := 0;
  v_invited INT := 0;
  v_accepted INT := 0;
  v_declined INT := 0;
  v_tentative INT := 0;
  v_pending INT := 0;
  v_conflicts INT := 0;
  v_open_swaps INT := 0;
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() OR NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to read calendar analytics';
  END IF;

  v_days := GREATEST((p_end_date - p_start_date + 1), 0);

  SELECT COUNT(*) INTO v_active_employees
  FROM employees e
  WHERE e.organization_id = p_org_id
    AND e.termination_date IS NULL
    AND COALESCE(e.employment_status, 'active') = 'active'
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id);

  v_potential_shift_days := v_active_employees * v_days;

  SELECT COUNT(DISTINCT (ra.employee_id, ra.date)), COUNT(*)
  INTO v_assigned_shift_days, v_shift_count
  FROM roster_assignments ra
  JOIN employees e ON e.id = ra.employee_id
  WHERE ra.organization_id = p_org_id
    AND ra.date >= p_start_date
    AND ra.date <= p_end_date
    AND e.termination_date IS NULL
    AND COALESCE(e.employment_status, 'active') = 'active'
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ce.event_type = 'meeting'),
    COUNT(*) FILTER (WHERE ce.meeting_url IS NOT NULL OR ce.meeting_provider IS NOT NULL),
    COUNT(*) FILTER (WHERE ce.requires_rsvp = true)
  INTO v_total_events, v_meeting_events, v_online_meetings, v_rsvp_events
  FROM calendar_events ce
  WHERE ce.organization_id = p_org_id
    AND COALESCE(ce.status, 'confirmed') <> 'cancelled'
    AND COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ)::DATE <= p_end_date
    AND COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ)::DATE >= p_start_date
    AND (p_department_id IS NULL OR ce.department_id = p_department_id OR ce.secondary_department_id = p_department_id)
    AND (p_branch_id IS NULL OR ce.branch_id = p_branch_id OR ce.secondary_branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ea.status = 'accepted'),
    COUNT(*) FILTER (WHERE ea.status = 'declined'),
    COUNT(*) FILTER (WHERE ea.status = 'tentative'),
    COUNT(*) FILTER (WHERE ea.status = 'pending')
  INTO v_invited, v_accepted, v_declined, v_tentative, v_pending
  FROM event_attendees ea
  JOIN calendar_events ce ON ce.id = ea.event_id
  JOIN employees e ON e.id = ea.employee_id
  WHERE ea.organization_id = p_org_id
    AND ce.organization_id = p_org_id
    AND COALESCE(ce.status, 'confirmed') <> 'cancelled'
    AND COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ)::DATE <= p_end_date
    AND COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ)::DATE >= p_start_date
    AND (p_department_id IS NULL OR e.department_id = p_department_id OR ce.department_id = p_department_id OR ce.secondary_department_id = p_department_id)
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id OR ce.branch_id = p_branch_id OR ce.secondary_branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_conflicts
  FROM get_conflict_report(p_org_id, p_start_date, p_end_date, p_department_id, p_branch_id);

  SELECT COUNT(*) INTO v_open_swaps
  FROM shift_swap_requests ssr
  JOIN employees e ON e.id = ssr.requester_employee_id
  WHERE ssr.organization_id = p_org_id
    AND ssr.requester_date >= p_start_date
    AND ssr.requester_date <= p_end_date
    AND ssr.status IN ('pending', 'claimed')
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'range', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'days', v_days),
    'filters', jsonb_build_object('organization_id', p_org_id, 'department_id', p_department_id, 'branch_id', p_branch_id),
    'events', jsonb_build_object(
      'total', v_total_events,
      'meetings', v_meeting_events,
      'online_meetings', v_online_meetings,
      'requires_rsvp', v_rsvp_events
    ),
    'attendance', jsonb_build_object(
      'invited', v_invited,
      'accepted', v_accepted,
      'declined', v_declined,
      'tentative', v_tentative,
      'pending', v_pending,
      'acceptance_rate', CASE WHEN v_invited = 0 THEN 0 ELSE ROUND((v_accepted::NUMERIC / v_invited::NUMERIC) * 100, 1) END
    ),
    'roster', jsonb_build_object(
      'active_employees', v_active_employees,
      'potential_shift_days', v_potential_shift_days,
      'assigned_shift_days', v_assigned_shift_days,
      'scheduled_shifts', v_shift_count,
      'coverage_rate', CASE WHEN v_potential_shift_days = 0 THEN 0 ELSE ROUND((v_assigned_shift_days::NUMERIC / v_potential_shift_days::NUMERIC) * 100, 1) END,
      'coverage_gap_days', GREATEST(v_potential_shift_days - v_assigned_shift_days, 0)
    ),
    'requests', jsonb_build_object('open_shift_swaps', v_open_swaps),
    'conflicts', jsonb_build_object('total', v_conflicts)
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_calendar_events(p_start_date date, p_end_date date, p_scope text DEFAULT NULL::text, p_department_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, organization_id uuid, title text, description text, event_type text, event_scope text, start_time timestamp with time zone, end_time timestamp with time zone, all_day boolean, branch_id uuid, department_id uuid, secondary_branch_id uuid, secondary_department_id uuid, team_member_ids uuid[], meeting_provider text, meeting_url text, meeting_id text, created_by uuid, requires_rsvp boolean, reminder_minutes integer, attachments jsonb, status text, original_start_time timestamp with time zone, original_end_time timestamp with time zone, reschedule_reason text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.organization_id,
    ce.title,
    ce.description,
    ce.event_type,
    ce.event_scope,
    COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) AS start_time,
    COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) AS end_time,
    ce.all_day,
    ce.branch_id,
    ce.department_id,
    ce.secondary_branch_id,
    ce.secondary_department_id,
    COALESCE(ce.team_member_ids, ARRAY[]::UUID[]) AS team_member_ids,
    ce.meeting_provider,
    ce.meeting_url,
    ce.meeting_id,
    ce.created_by,
    ce.requires_rsvp,
    ce.reminder_minutes,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ea.id,
            'file_name', ea.file_name,
            'file_url', ea.file_url,
            'uploaded_by', ea.uploaded_by,
            'uploaded_at', ea.uploaded_at
          )
          ORDER BY ea.uploaded_at
        )
        FROM event_attachments ea
        WHERE ea.event_id = ce.id
      ),
      ce.attachments,
      '[]'::JSONB
    ) AS attachments,
    ce.status,
    ce.original_start_time,
    ce.original_end_time,
    ce.reschedule_reason,
    ce.created_at,
    ce.updated_at
  FROM calendar_events ce
  WHERE ce.organization_id = get_my_org_id()
    AND COALESCE(ce.start_at::DATE, ce.event_date) <= p_end_date
    AND COALESCE(ce.end_at::DATE, ce.event_date) >= p_start_date
    AND (p_scope IS NULL OR ce.event_scope = p_scope)
    AND (p_department_id IS NULL OR ce.department_id = p_department_id OR ce.secondary_department_id = p_department_id)
    AND (p_branch_id IS NULL OR ce.branch_id = p_branch_id OR ce.secondary_branch_id = p_branch_id)
    AND (
      is_admin()
      OR ce.created_by = current_setting('touchorbit.current_user_id', true)::uuid
      OR ce.event_scope = 'organization'
      OR EXISTS (
        SELECT 1
        FROM employees me
        WHERE me.user_id = current_setting('touchorbit.current_user_id', true)::uuid
          AND me.organization_id = ce.organization_id
          AND (
            me.id = ANY(COALESCE(ce.team_member_ids, ARRAY[]::UUID[]))
            OR me.branch_id = ce.branch_id
            OR me.branch_id = ce.secondary_branch_id
            OR me.department_id = ce.department_id
            OR me.department_id = ce.secondary_department_id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM event_attendees ea
        JOIN employees me ON me.id = ea.employee_id
        WHERE ea.event_id = ce.id
          AND me.user_id = current_setting('touchorbit.current_user_id', true)::uuid
      )
    )
  ORDER BY start_time, ce.title;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_conflict_report(p_org_id uuid, p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(conflict_id text, conflict_type text, severity text, employee_id uuid, employee_name text, department_id uuid, department_name text, branch_id uuid, conflict_date date, start_time timestamp with time zone, end_time timestamp with time zone, source_id uuid, source_title text, details jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() OR NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to read calendar conflict reports';
  END IF;

  RETURN QUERY
  WITH scoped_employees AS (
    SELECT e.id, e.branch_id, e.department_id, concat_ws(' ', e.first_name, e.last_name) AS employee_name, d.name AS department_name
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = p_org_id
      AND e.termination_date IS NULL
      AND COALESCE(e.employment_status, 'active') = 'active'
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
  ),
  roster_windows AS (
    SELECT
      ra.id,
      ra.employee_id,
      ra.date,
      ra.shift_id,
      ra.conflict_reason,
      ra.conflict_flagged_at,
      ra.conflict_resolved_at,
      s.name AS shift_name,
      CASE WHEN s.id IS NULL THEN NULL ELSE (ra.date + s.start_time)::TIMESTAMPTZ END AS shift_start,
      CASE
        WHEN s.id IS NULL THEN NULL
        ELSE (ra.date + s.end_time)::TIMESTAMPTZ + CASE WHEN s.end_time < s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END
      END AS shift_end
    FROM roster_assignments ra
    JOIN scoped_employees se ON se.id = ra.employee_id
    LEFT JOIN shifts s ON s.id = ra.shift_id
    WHERE ra.organization_id = p_org_id
      AND ra.date >= p_start_date
      AND ra.date <= p_end_date
  )
  SELECT
    ('roster-conflict:' || rw.id)::TEXT AS conflict_id,
    'roster_conflict'::TEXT AS conflict_type,
    'high'::TEXT AS severity,
    se.id AS employee_id,
    se.employee_name,
    se.department_id,
    se.department_name,
    se.branch_id,
    rw.date AS conflict_date,
    rw.shift_start AS start_time,
    rw.shift_end AS end_time,
    rw.id AS source_id,
    COALESCE(rw.shift_name, 'Roster assignment') AS source_title,
    jsonb_build_object('reason', rw.conflict_reason, 'flagged_at', rw.conflict_flagged_at, 'shift_id', rw.shift_id) AS details
  FROM roster_windows rw
  JOIN scoped_employees se ON se.id = rw.employee_id
  WHERE rw.conflict_reason IS NOT NULL
    AND rw.conflict_resolved_at IS NULL

  UNION ALL

  SELECT
    ('leave-overlap:' || rw.id || ':' || lr.id)::TEXT AS conflict_id,
    'leave_overlap'::TEXT AS conflict_type,
    'high'::TEXT AS severity,
    se.id AS employee_id,
    se.employee_name,
    se.department_id,
    se.department_name,
    se.branch_id,
    rw.date AS conflict_date,
    rw.shift_start AS start_time,
    rw.shift_end AS end_time,
    lr.id AS source_id,
    (lr.leave_type || ' leave')::TEXT AS source_title,
    jsonb_build_object('roster_assignment_id', rw.id, 'leave_type', lr.leave_type, 'leave_status', lr.status, 'start_date', lr.start_date, 'end_date', lr.end_date) AS details
  FROM roster_windows rw
  JOIN scoped_employees se ON se.id = rw.employee_id
  JOIN leave_records lr ON lr.employee_id = rw.employee_id
    AND lr.organization_id = p_org_id
    AND lr.status = 'approved'
    AND rw.date BETWEEN lr.start_date AND lr.end_date

  UNION ALL

  SELECT
    ('availability-overlap:' || rw.id || ':' || ea.id)::TEXT AS conflict_id,
    'availability_overlap'::TEXT AS conflict_type,
    'medium'::TEXT AS severity,
    se.id AS employee_id,
    se.employee_name,
    se.department_id,
    se.department_name,
    se.branch_id,
    rw.date AS conflict_date,
    rw.shift_start AS start_time,
    rw.shift_end AS end_time,
    ea.id AS source_id,
    'Unavailable during shift'::TEXT AS source_title,
    jsonb_build_object('roster_assignment_id', rw.id, 'availability_reason', ea.reason, 'availability_start', ea.start_time, 'availability_end', ea.end_time) AS details
  FROM roster_windows rw
  JOIN scoped_employees se ON se.id = rw.employee_id
  JOIN employee_availability ea ON ea.employee_id = rw.employee_id
    AND ea.organization_id = p_org_id
    AND ea.is_available = false
    AND ea.effective_from <= rw.date
    AND (ea.effective_until IS NULL OR ea.effective_until >= rw.date)
    AND ea.day_of_week = EXTRACT(DOW FROM rw.date)::INT
    AND (
      ea.start_time IS NULL
      OR rw.shift_start IS NULL
      OR (
        (rw.date + ea.start_time)::TIMESTAMPTZ < rw.shift_end
        AND ((rw.date + ea.end_time)::TIMESTAMPTZ + CASE WHEN ea.end_time < ea.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) > rw.shift_start
      )
    )

  UNION ALL

  SELECT
    ('event-shift-overlap:' || ce.id || ':' || rw.id)::TEXT AS conflict_id,
    'event_shift_overlap'::TEXT AS conflict_type,
    'medium'::TEXT AS severity,
    se.id AS employee_id,
    se.employee_name,
    se.department_id,
    se.department_name,
    se.branch_id,
    COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ)::DATE AS conflict_date,
    COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) AS start_time,
    COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) AS end_time,
    ce.id AS source_id,
    ce.title AS source_title,
    jsonb_build_object('roster_assignment_id', rw.id, 'shift_id', rw.shift_id, 'shift_name', rw.shift_name, 'event_type', ce.event_type) AS details
  FROM calendar_events ce
  JOIN event_attendees attendee ON attendee.event_id = ce.id AND attendee.status <> 'declined'
  JOIN scoped_employees se ON se.id = attendee.employee_id
  JOIN roster_windows rw ON rw.employee_id = se.id
    AND rw.shift_start IS NOT NULL
    AND COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) < rw.shift_end
    AND COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) > rw.shift_start
  WHERE ce.organization_id = p_org_id
    AND COALESCE(ce.status, 'confirmed') <> 'cancelled'
    AND COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ)::DATE <= p_end_date
    AND COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ)::DATE >= p_start_date

  UNION ALL

  SELECT
    ('reschedule-request:' || attendee.id)::TEXT AS conflict_id,
    'reschedule_requested'::TEXT AS conflict_type,
    'low'::TEXT AS severity,
    se.id AS employee_id,
    se.employee_name,
    se.department_id,
    se.department_name,
    se.branch_id,
    COALESCE(attendee.proposed_new_start::DATE, ce.start_at::DATE, ce.event_date) AS conflict_date,
    COALESCE(attendee.proposed_new_start, ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) AS start_time,
    COALESCE(attendee.proposed_new_end, ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) AS end_time,
    ce.id AS source_id,
    ce.title AS source_title,
    jsonb_build_object('attendee_id', attendee.id, 'reason', attendee.reschedule_reason, 'proposed_new_start', attendee.proposed_new_start, 'proposed_new_end', attendee.proposed_new_end) AS details
  FROM event_attendees attendee
  JOIN calendar_events ce ON ce.id = attendee.event_id AND ce.organization_id = p_org_id
  JOIN scoped_employees se ON se.id = attendee.employee_id
  WHERE attendee.organization_id = p_org_id
    AND attendee.reschedule_requested = true
    AND COALESCE(attendee.proposed_new_start::DATE, ce.start_at::DATE, ce.event_date) BETWEEN p_start_date AND p_end_date
  ORDER BY conflict_date, severity, employee_name, conflict_type;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_audit_timeline(p_employee_id uuid, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, organization_id uuid, source_table text, actor_user_id uuid, actor_name text, actor_email text, target_user_id uuid, target_employee_id uuid, target_name text, module text, action text, severity text, entity_type text, entity_id uuid, entity_label text, old_value jsonb, new_value jsonb, changed_fields jsonb, metadata jsonb, source text, ip_address text, user_agent text, created_at timestamp with time zone, is_sensitive boolean, is_redacted boolean, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_employee_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT e.organization_id
  INTO v_employee_org_id
  FROM employees e
  WHERE e.id = p_employee_id;

  IF v_employee_org_id IS NULL OR v_employee_org_id IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Employee is not available in this organization' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    has_permission('audit.read')
    OR has_permission_for_employee('employees.read', p_employee_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to read employee audit timeline' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM get_audit_events(
    NULL,
    NULL,
    NULL,
    p_employee_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_limit,
    p_offset,
    false
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_salary_components(p_employee_id uuid, p_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(component_name text, component_type text, amount numeric, is_taxable boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sc.name,
    sc.type,
    ess.amount,
    sc.is_taxable
  FROM employee_salary_structure ess
  JOIN salary_components sc ON sc.id = ess.component_id
  WHERE ess.employee_id = p_employee_id
    AND ess.effective_from <= p_date
    AND (ess.effective_to IS NULL OR ess.effective_to >= p_date)
  ORDER BY sc.type, sc.name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_shift(p_employee_id uuid, p_datetime timestamp with time zone)
 RETURNS TABLE(shift_id uuid, shift_name text, start_time time without time zone, end_time time without time zone, grace_period_minutes integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.start_time,
    s.end_time,
    s.grace_period_minutes
  FROM employee_shifts es
  JOIN shifts s ON s.id = es.shift_id
  WHERE es.employee_id = p_employee_id
    AND p_datetime::date >= es.effective_from
    AND (es.effective_to IS NULL OR p_datetime::date <= es.effective_to)
    AND EXTRACT(DOW FROM p_datetime) = ANY(es.days_of_week)
    AND s.status = 'active'
  ORDER BY es.effective_from DESC
  LIMIT 1;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_tasks(p_employee_id uuid, p_status text DEFAULT NULL::text, p_due_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_include_completed boolean DEFAULT false)
 RETURNS TABLE(id uuid, organization_id uuid, employee_id uuid, assigned_by uuid, title text, description text, category text, due_date timestamp with time zone, reminder_minutes integer, reminder_at timestamp with time zone, reminder_snoozed_until timestamp with time zone, is_recurring boolean, recurrence_rule text, status text, effective_status text, is_overdue boolean, completed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee employees%ROWTYPE;
BEGIN
  SELECT * INTO v_employee
  FROM employees
  WHERE id = p_employee_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found or outside organization';
  END IF;

  IF NOT is_admin() AND v_employee.user_id IS DISTINCT FROM current_setting('touchorbit.current_user_id', true)::uuid THEN
    RAISE EXCEPTION 'Not authorized to read this employee task list';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.organization_id,
    t.employee_id,
    t.assigned_by,
    t.title,
    t.description,
    t.category,
    t.due_date,
    t.reminder_minutes,
    t.reminder_at,
    t.reminder_snoozed_until,
    t.is_recurring,
    t.recurrence_rule,
    t.status,
    CASE
      WHEN t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < now() THEN 'overdue'
      ELSE t.status
    END AS effective_status,
    (t.status <> 'completed' AND t.due_date IS NOT NULL AND t.due_date < now()) AS is_overdue,
    t.completed_at,
    t.created_at,
    t.updated_at
  FROM employee_tasks t
  WHERE t.organization_id = get_my_org_id()
    AND t.employee_id = p_employee_id
    AND (p_status IS NULL OR t.status = p_status OR (p_status = 'overdue' AND t.status <> 'completed' AND t.due_date < now()))
    AND (p_due_before IS NULL OR t.due_date <= p_due_before)
    AND (p_include_completed OR t.status <> 'completed')
  ORDER BY t.due_date NULLS LAST, t.created_at DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_timeline(p_employee_id uuid)
 RETURNS TABLE(event_date timestamp with time zone, event_type text, description text, changed_by_name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    eh.event_date,
    eh.event_type,
    eh.description,
    eh.changed_by_name
  FROM employee_history eh
  WHERE eh.employee_id = p_employee_id
  ORDER BY eh.event_date DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_employee_weekly_hours(p_employee_id uuid, p_week_start date)
 RETURNS TABLE(employee_id uuid, week_start date, scheduled_hours numeric, overtime_hours numeric, total_hours numeric, assignment_count integer, daily jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM employees e
    WHERE e.id = p_employee_id
      AND e.organization_id = v_org_id
      AND (
        is_admin()
        OR e.user_id = current_setting('touchorbit.current_user_id', true)::uuid
        OR has_permission_for_employee('roster.read', p_employee_id)
      )
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH roster_hours AS (
    SELECT
      ra.employee_id,
      ra.date,
      ra.id AS assignment_id,
      ra.shift_id,
      s.name AS shift_name,
      ROUND(
        GREATEST(
          0,
          (
            EXTRACT(EPOCH FROM (
              ((ra.date + s.end_time)::TIMESTAMPTZ + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END)
              - (ra.date + s.start_time)::TIMESTAMPTZ
            )) / 3600.0
          ) - (COALESCE(s.break_minutes, 0)::NUMERIC / 60.0)
        ),
        2
      ) AS hours
    FROM roster_assignments ra
    JOIN shifts s ON s.id = ra.shift_id
    WHERE ra.organization_id = v_org_id
      AND ra.employee_id = p_employee_id
      AND ra.date >= p_week_start
      AND ra.date < p_week_start + INTERVAL '7 days'
      AND ra.shift_id IS NOT NULL
  ),
  overtime AS (
    SELECT
      COALESCE(SUM(o.hours), 0)::NUMERIC AS hours
    FROM overtime_records o
    WHERE o.organization_id = v_org_id
      AND o.employee_id = p_employee_id
      AND o.date >= p_week_start
      AND o.date < p_week_start + INTERVAL '7 days'
      AND o.status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3', 'approved')
  ),
  totals AS (
    SELECT
      COALESCE(SUM(rh.hours), 0)::NUMERIC AS scheduled,
      COUNT(*)::INTEGER AS assignments,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'date', rh.date,
            'assignment_id', rh.assignment_id,
            'shift_id', rh.shift_id,
            'shift_name', rh.shift_name,
            'hours', rh.hours
          )
          ORDER BY rh.date, rh.shift_name
        ) FILTER (WHERE rh.assignment_id IS NOT NULL),
        '[]'::JSONB
      ) AS daily_rows
    FROM roster_hours rh
  )
  SELECT
    p_employee_id,
    p_week_start,
    ROUND(t.scheduled, 2),
    ROUND(o.hours, 2),
    ROUND(t.scheduled + o.hours, 2),
    t.assignments,
    t.daily_rows
  FROM totals t
  CROSS JOIN overtime o;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_events_for_employee(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(id uuid, organization_id uuid, title text, description text, event_type text, event_scope text, start_time timestamp with time zone, end_time timestamp with time zone, all_day boolean, branch_id uuid, department_id uuid, secondary_branch_id uuid, secondary_department_id uuid, team_member_ids uuid[], meeting_provider text, meeting_url text, meeting_id text, created_by uuid, requires_rsvp boolean, reminder_minutes integer, attachments jsonb, status text, original_start_time timestamp with time zone, original_end_time timestamp with time zone, reschedule_reason text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee employees%ROWTYPE;
BEGIN
  SELECT * INTO v_employee
  FROM employees
  WHERE id = p_employee_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found or outside organization';
  END IF;

  IF NOT is_admin() AND v_employee.user_id IS DISTINCT FROM current_setting('touchorbit.current_user_id', true)::uuid THEN
    RAISE EXCEPTION 'Not authorized to read this employee calendar';
  END IF;

  RETURN QUERY
  SELECT gce.*
  FROM get_calendar_events(p_start_date, p_end_date, NULL, NULL, NULL) gce
  WHERE gce.event_scope = 'organization'
     OR gce.branch_id = v_employee.branch_id
     OR gce.secondary_branch_id = v_employee.branch_id
     OR gce.department_id = v_employee.department_id
     OR gce.secondary_department_id = v_employee.department_id
     OR p_employee_id = ANY(COALESCE(gce.team_member_ids, ARRAY[]::UUID[]))
     OR EXISTS (
       SELECT 1
       FROM event_attendees ea
       WHERE ea.event_id = gce.id
         AND ea.employee_id = p_employee_id
     )
  ORDER BY gce.start_time, gce.title;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_expense_policy(p_org_id uuid, p_category_id uuid, p_employee_id uuid)
 RETURNS TABLE(limit_per_claim numeric, limit_per_month numeric, receipt_required boolean, auto_approve_below numeric, resolved_scope text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_branch_id UUID;
  v_department_id UUID;
BEGIN
  SELECT branch_id, department_id INTO v_branch_id, v_department_id
  FROM employees WHERE id = p_employee_id;

  -- 1. Employee-specific
  RETURN QUERY
    SELECT ep.limit_per_claim, ep.limit_per_month, ep.receipt_required, ep.auto_approve_below, 'employee'::TEXT
    FROM expense_policies ep
    WHERE ep.organization_id = p_org_id AND ep.category_id = p_category_id
      AND ep.scope_type = 'employee' AND ep.scope_id = p_employee_id
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2. Department
  IF v_department_id IS NOT NULL THEN
    RETURN QUERY
      SELECT ep.limit_per_claim, ep.limit_per_month, ep.receipt_required, ep.auto_approve_below, 'department'::TEXT
      FROM expense_policies ep
      WHERE ep.organization_id = p_org_id AND ep.category_id = p_category_id
        AND ep.scope_type = 'department' AND ep.scope_id = v_department_id
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3. Branch
  IF v_branch_id IS NOT NULL THEN
    RETURN QUERY
      SELECT ep.limit_per_claim, ep.limit_per_month, ep.receipt_required, ep.auto_approve_below, 'branch'::TEXT
      FROM expense_policies ep
      WHERE ep.organization_id = p_org_id AND ep.category_id = p_category_id
        AND ep.scope_type = 'branch' AND ep.scope_id = v_branch_id
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 4. Organization default (scope_id = organization_id)
  RETURN QUERY
    SELECT ep.limit_per_claim, ep.limit_per_month, ep.receipt_required, ep.auto_approve_below, 'organization'::TEXT
    FROM expense_policies ep
    WHERE ep.organization_id = p_org_id AND ep.category_id = p_category_id
      AND ep.scope_type = 'organization' AND ep.scope_id = p_org_id
    LIMIT 1;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_hours_worked(p_employee_id uuid, p_date date)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_clock_in TIMESTAMPTZ;
  v_clock_out TIMESTAMPTZ;
  v_hours NUMERIC;
BEGIN
  -- Get first clock_in of the day
  SELECT timestamp INTO v_clock_in
  FROM clock_events
  WHERE employee_id = p_employee_id
    AND event_type = 'clock_in'
    AND DATE(timestamp) = p_date
  ORDER BY timestamp ASC
  LIMIT 1;

  -- Get last clock_out of the day
  SELECT timestamp INTO v_clock_out
  FROM clock_events
  WHERE employee_id = p_employee_id
    AND event_type = 'clock_out'
    AND DATE(timestamp) = p_date
  ORDER BY timestamp DESC
  LIMIT 1;

  -- Calculate hours if both exist
  IF v_clock_in IS NOT NULL AND v_clock_out IS NOT NULL THEN
    v_hours := EXTRACT(EPOCH FROM (v_clock_out - v_clock_in)) / 3600.0;
    RETURN ROUND(v_hours, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_late_arrivals(p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, work_date date, day_of_week text, shift_name text, scheduled_start time without time zone, actual_clock_in timestamp with time zone, minutes_late integer, severity text, repeat_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_grace  INT;
BEGIN
  v_org_id := get_my_org_id();

  SELECT COALESCE(late_threshold_minutes, 5)
  INTO   v_grace
  FROM   organizations
  WHERE  id = v_org_id;

  RETURN QUERY
  WITH org_employees AS (
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS full_name,
      d.name AS dept_name
    FROM  employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = v_org_id
      AND e.termination_date IS NULL
      AND (p_department_id IS NULL OR e.department_id = p_department_id)
      AND (p_employee_ids  IS NULL OR e.id = ANY(p_employee_ids))
  ),
  first_clockins AS (
    SELECT
      ce.employee_id,
      ce.timestamp::date AS clock_date,
      MIN(ce.timestamp)  AS first_in
    FROM  clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.event_type = 'clock_in'
      AND ce.timestamp::date BETWEEN p_start_date AND p_end_date
    GROUP BY ce.employee_id, ce.timestamp::date
  ),
  late_rows AS (
    SELECT
      oe.id                AS employee_id,
      oe.full_name         AS employee_name,
      oe.dept_name         AS department_name,
      fc.clock_date        AS work_date,
      TO_CHAR(fc.clock_date, 'Dy') AS day_of_week,
      s.name               AS shift_name,
      s.start_time         AS scheduled_start,
      fc.first_in          AS actual_clock_in,
      ROUND(EXTRACT(EPOCH FROM (fc.first_in::time - s.start_time)) / 60)::INT AS minutes_late
    FROM  org_employees oe
    JOIN  first_clockins    fc ON fc.employee_id = oe.id
    JOIN  roster_assignments ra ON ra.employee_id = oe.id AND ra.date = fc.clock_date
    JOIN  shifts             s  ON s.id = ra.shift_id
    WHERE EXTRACT(EPOCH FROM (fc.first_in::time - s.start_time)) / 60 > v_grace
  )
  SELECT
    lr.employee_id,
    lr.employee_name,
    lr.department_name,
    lr.work_date,
    lr.day_of_week,
    lr.shift_name,
    lr.scheduled_start,
    lr.actual_clock_in,
    lr.minutes_late,
    CASE
      WHEN lr.minutes_late > 30 THEN 'severe'
      WHEN lr.minutes_late > 15 THEN 'moderate'
      ELSE 'mild'
    END AS severity,
    COUNT(*) OVER (PARTITION BY lr.employee_id)::INT AS repeat_count
  FROM late_rows lr
  ORDER BY lr.work_date DESC, lr.minutes_late DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_leave_balance(p_employee_id uuid, p_leave_type text, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_balance NUMERIC := 0;
  v_used NUMERIC := 0;
BEGIN
  CASE p_leave_type
    WHEN 'annual' THEN v_balance := 21;
    WHEN 'casual' THEN v_balance := 7;
    WHEN 'sick' THEN v_balance := 7;
    ELSE v_balance := 0;
  END CASE;

  SELECT COALESCE(SUM(days_count), 0) INTO v_used
  FROM leave_records
  WHERE employee_id = p_employee_id
    AND leave_type = p_leave_type
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year;

  RETURN v_balance - v_used;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_managed_branch_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.id FROM branches b
  JOIN employees e ON e.id = b.manager_employee_id
  WHERE e.user_id = current_setting('touchorbit.current_user_id', true)::uuid
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_managed_dept_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id FROM departments d
  JOIN employees e ON e.id = d.manager_employee_id
  WHERE e.user_id = current_setting('touchorbit.current_user_id', true)::uuid
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT organization_id FROM public.users WHERE id = current_setting('touchorbit.current_user_id', true)::uuid
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.role FROM users u WHERE u.id = current_setting('touchorbit.current_user_id', true)::uuid
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_system_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(usr.system_role,
    CASE
      WHEN u.role = 'owner' THEN 'owner'
      WHEN u.role = 'super_admin' THEN 'super_admin'
      WHEN u.role IN ('admin', 'hr_admin', 'finance') THEN 'admin'
      WHEN u.role IN ('manager', 'dept_manager', 'branch_manager') THEN 'manager'
      ELSE 'employee'
    END)
  FROM users u
  LEFT JOIN user_security_roles usr
    ON usr.user_id = u.id
   AND usr.organization_id = u.organization_id
  WHERE u.id = current_setting('touchorbit.current_user_id', true)::uuid
$function$
;
CREATE OR REPLACE FUNCTION public.get_no_shows_for_date(p_date date)
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, shift_name text, scheduled_start time without time zone, minutes_late integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_grace INT;
BEGIN
  v_org_id := get_my_org_id();

  SELECT COALESCE(late_threshold_minutes, 5)
  INTO v_grace
  FROM organizations
  WHERE id = v_org_id;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    concat_ws(' ', e.first_name, e.last_name) AS employee_name,
    d.name AS department_name,
    s.name AS shift_name,
    s.start_time AS scheduled_start,
    FLOOR(EXTRACT(EPOCH FROM (now() - (p_date + s.start_time)::TIMESTAMPTZ)) / 60)::INT AS minutes_late
  FROM employees e
  JOIN roster_assignments ra ON ra.employee_id = e.id AND ra.date = p_date
  JOIN shifts s ON s.id = ra.shift_id
  LEFT JOIN departments d ON d.id = e.department_id
  WHERE e.organization_id = v_org_id
    AND e.termination_date IS NULL
    AND now() > ((p_date + s.start_time)::TIMESTAMPTZ + make_interval(mins => v_grace))
    AND NOT EXISTS (
      SELECT 1
      FROM clock_events ce
      WHERE ce.organization_id = v_org_id
        AND ce.employee_id = e.id
        AND ce.event_type = 'clock_in'
        AND ce.timestamp::DATE = p_date
    )
  ORDER BY minutes_late DESC, employee_name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_org_chart(p_root_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, manager_id uuid, first_name text, last_name text, full_name text, photo_url text, job_title text, date_of_birth date, hire_date date, department_id uuid, department_name text, department_code text, parent_department_id uuid, branch_id uuid, branch_name text, depth integer, path_ids uuid[], path_names text[], sort_path text, direct_reports_count integer, has_children boolean, is_current_user boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_root_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM employees root_check
    WHERE root_check.id = p_root_id
      AND root_check.organization_id = v_org_id
      AND root_check.termination_date IS NULL
      AND COALESCE(root_check.employment_status, 'active') <> 'terminated'
      AND (p_branch_id IS NULL OR root_check.branch_id = p_branch_id)
  ) THEN
    RAISE EXCEPTION 'Org chart root is not available for this organization or branch';
  END IF;

  RETURN QUERY
  WITH RECURSIVE eligible_employees AS (
    SELECT
      emp.id,
      emp.manager_id,
      emp.first_name,
      emp.last_name,
      concat_ws(' ', emp.first_name, emp.last_name) AS full_name,
      emp.photo_url,
      emp.job_title,
      emp.date_of_birth,
      emp.hire_date,
      emp.department,
      emp.department_id,
      emp.branch_id,
      emp.user_id,
      emp.employee_number
    FROM employees emp
    WHERE emp.organization_id = v_org_id
      AND emp.termination_date IS NULL
      AND COALESCE(emp.employment_status, 'active') <> 'terminated'
      AND (p_branch_id IS NULL OR emp.branch_id = p_branch_id)
  ),
  org_tree AS (
    SELECT
      root.*,
      0::INTEGER AS depth,
      ARRAY[root.id]::UUID[] AS path_ids,
      ARRAY[root.full_name]::TEXT[] AS path_names,
      lower(COALESCE(root.employee_number, '') || ':' || root.full_name || ':' || root.id::TEXT) AS sort_path
    FROM eligible_employees root
    WHERE (
      p_root_id IS NOT NULL
      AND root.id = p_root_id
    )
    OR (
      p_root_id IS NULL
      AND (
        root.manager_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM eligible_employees manager
          WHERE manager.id = root.manager_id
        )
      )
    )

    UNION ALL

    SELECT
      child.*,
      parent.depth + 1,
      parent.path_ids || child.id,
      parent.path_names || child.full_name,
      parent.sort_path || '>' || lower(COALESCE(child.employee_number, '') || ':' || child.full_name || ':' || child.id::TEXT)
    FROM eligible_employees child
    JOIN org_tree parent ON child.manager_id = parent.id
    WHERE child.id <> ALL(parent.path_ids)
  ),
  direct_counts AS (
    SELECT child.manager_id, count(*)::INTEGER AS direct_reports_count
    FROM eligible_employees child
    WHERE child.manager_id IS NOT NULL
    GROUP BY child.manager_id
  )
  SELECT
    tree.id AS employee_id,
    tree.manager_id,
    tree.first_name,
    tree.last_name,
    tree.full_name,
    tree.photo_url,
    tree.job_title,
    tree.date_of_birth,
    tree.hire_date,
    tree.department_id,
    COALESCE(dept.name, tree.department) AS department_name,
    dept.code AS department_code,
    dept.parent_department_id,
    tree.branch_id,
    branch.name AS branch_name,
    tree.depth,
    tree.path_ids,
    tree.path_names,
    tree.sort_path,
    COALESCE(dc.direct_reports_count, 0) AS direct_reports_count,
    COALESCE(dc.direct_reports_count, 0) > 0 AS has_children,
    COALESCE(tree.user_id = current_setting('touchorbit.current_user_id', true)::uuid, false) AS is_current_user
  FROM org_tree tree
  LEFT JOIN departments dept
    ON dept.id = tree.department_id
   AND dept.organization_id = v_org_id
  LEFT JOIN branches branch
    ON branch.id = tree.branch_id
   AND branch.organization_id = v_org_id
  LEFT JOIN direct_counts dc
    ON dc.manager_id = tree.id
  ORDER BY tree.sort_path;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_org_chart_as_of(p_date date)
 RETURNS TABLE(employee_id uuid, manager_id uuid, employee_number text, first_name text, last_name text, full_name text, photo_url text, job_title text, date_of_birth date, department_id uuid, department_name text, department_code text, parent_department_id uuid, branch_id uuid, branch_name text, employment_status text, hire_date date, termination_date date, basic_salary numeric, depth integer, path_ids uuid[], path_names text[], sort_path text, direct_reports_count integer, total_reports_count integer, subtree_headcount integer, direct_reports_salary_total numeric, subtree_salary_total numeric, has_children boolean, is_current_user boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_as_of_end TIMESTAMPTZ;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to view historical org chart' USING ERRCODE = '42501';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'p_date is required' USING ERRCODE = '22023';
  END IF;

  v_as_of_end := (p_date + 1)::TIMESTAMPTZ;

  RETURN QUERY
  WITH RECURSIVE active_employees AS (
    SELECT
      emp.*
    FROM employees emp
    WHERE emp.organization_id = v_org_id
      AND COALESCE(emp.hire_date, emp.created_at::DATE, DATE '1900-01-01') <= p_date
      AND (emp.termination_date IS NULL OR emp.termination_date > p_date)
  ),
  effective_employees AS (
    SELECT
      emp.id,
      CASE
        WHEN manager_before.found THEN manager_before.manager_id
        WHEN manager_after.found THEN manager_after.manager_id
        ELSE emp.manager_id
      END AS manager_id,
      emp.employee_number,
      emp.first_name,
      emp.last_name,
      concat_ws(' ', emp.first_name, emp.last_name) AS full_name,
      emp.photo_url,
      emp.job_title,
      emp.date_of_birth,
      emp.department,
      CASE
        WHEN department_before.found THEN department_before.department_id
        WHEN department_after.found THEN department_after.department_id
        ELSE emp.department_id
      END AS department_id,
      emp.branch_id,
      emp.user_id,
      CASE
        WHEN emp.termination_date IS NOT NULL AND emp.termination_date <= p_date THEN 'terminated'
        WHEN COALESCE(emp.employment_status, 'active') = 'terminated' THEN 'active'
        ELSE COALESCE(emp.employment_status, 'active')
      END AS employment_status,
      emp.hire_date,
      emp.termination_date,
      emp.basic_salary
    FROM active_employees emp
    LEFT JOIN LATERAL (
      SELECT
        true AS found,
        org_chart_history_uuid_value(h.details, 'manager_id', 'old_manager_id', 'new') AS manager_id
      FROM employee_history h
      WHERE h.employee_id = emp.id
        AND COALESCE(h.event_date, h.created_at) < v_as_of_end
        AND (
          h.event_type = 'manager_changed'
          OR h.details ? 'manager_id'
          OR h.details ? 'new_manager_id'
          OR h.details ? 'old_manager_id'
          OR (h.details ->> 'field') = 'manager_id'
        )
      ORDER BY COALESCE(h.event_date, h.created_at) DESC, h.created_at DESC
      LIMIT 1
    ) manager_before ON true
    LEFT JOIN LATERAL (
      SELECT
        true AS found,
        org_chart_history_uuid_value(h.details, 'manager_id', 'old_manager_id', 'old') AS manager_id
      FROM employee_history h
      WHERE h.employee_id = emp.id
        AND COALESCE(h.event_date, h.created_at) >= v_as_of_end
        AND (
          h.event_type = 'manager_changed'
          OR h.details ? 'manager_id'
          OR h.details ? 'new_manager_id'
          OR h.details ? 'old_manager_id'
          OR (h.details ->> 'field') = 'manager_id'
        )
      ORDER BY COALESCE(h.event_date, h.created_at) ASC, h.created_at ASC
      LIMIT 1
    ) manager_after ON true
    LEFT JOIN LATERAL (
      SELECT
        true AS found,
        COALESCE(
          org_chart_history_uuid_value(h.details, 'department_id', 'old_department_id', 'new'),
          matched_department.id
        ) AS department_id
      FROM employee_history h
      LEFT JOIN departments matched_department
        ON matched_department.organization_id = v_org_id
       AND lower(matched_department.name) = lower(COALESCE(
         h.details ->> 'new_department_name',
         CASE WHEN h.details ->> 'field' = 'department' THEN h.details ->> 'new_value' END
       ))
      WHERE h.employee_id = emp.id
        AND COALESCE(h.event_date, h.created_at) < v_as_of_end
        AND (
          h.event_type = 'department_changed'
          OR h.details ? 'department_id'
          OR h.details ? 'new_department_id'
          OR h.details ? 'old_department_id'
          OR (h.details ->> 'field') IN ('department_id', 'department')
        )
      ORDER BY COALESCE(h.event_date, h.created_at) DESC, h.created_at DESC
      LIMIT 1
    ) department_before ON true
    LEFT JOIN LATERAL (
      SELECT
        true AS found,
        COALESCE(
          org_chart_history_uuid_value(h.details, 'department_id', 'old_department_id', 'old'),
          matched_department.id
        ) AS department_id
      FROM employee_history h
      LEFT JOIN departments matched_department
        ON matched_department.organization_id = v_org_id
       AND lower(matched_department.name) = lower(COALESCE(
         h.details ->> 'old_department_name',
         CASE WHEN h.details ->> 'field' = 'department' THEN h.details ->> 'old_value' END
       ))
      WHERE h.employee_id = emp.id
        AND COALESCE(h.event_date, h.created_at) >= v_as_of_end
        AND (
          h.event_type = 'department_changed'
          OR h.details ? 'department_id'
          OR h.details ? 'new_department_id'
          OR h.details ? 'old_department_id'
          OR (h.details ->> 'field') IN ('department_id', 'department')
        )
      ORDER BY COALESCE(h.event_date, h.created_at) ASC, h.created_at ASC
      LIMIT 1
    ) department_after ON true
  ),
  org_tree AS (
    SELECT
      root.*,
      0::INTEGER AS depth,
      ARRAY[root.id]::UUID[] AS path_ids,
      ARRAY[root.full_name]::TEXT[] AS path_names,
      lower(COALESCE(root.employee_number, '') || ':' || root.full_name || ':' || root.id::TEXT) AS sort_path
    FROM effective_employees root
    WHERE root.manager_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM effective_employees manager
         WHERE manager.id = root.manager_id
       )

    UNION ALL

    SELECT
      child.*,
      parent.depth + 1,
      parent.path_ids || child.id,
      parent.path_names || child.full_name,
      parent.sort_path || '>' || lower(COALESCE(child.employee_number, '') || ':' || child.full_name || ':' || child.id::TEXT)
    FROM effective_employees child
    JOIN org_tree parent ON child.manager_id = parent.id
    WHERE child.id <> ALL(parent.path_ids)
  ),
  direct_rollups AS (
    SELECT
      child.manager_id,
      count(*)::INTEGER AS direct_reports_count,
      COALESCE(sum(child.basic_salary), 0)::NUMERIC AS direct_reports_salary_total
    FROM effective_employees child
    WHERE child.manager_id IS NOT NULL
    GROUP BY child.manager_id
  ),
  subtree_edges AS (
    SELECT emp.id AS ancestor_id, emp.id AS descendant_id, ARRAY[emp.id]::UUID[] AS path_ids
    FROM effective_employees emp

    UNION ALL

    SELECT se.ancestor_id, child.id, se.path_ids || child.id
    FROM subtree_edges se
    JOIN effective_employees child ON child.manager_id = se.descendant_id
    WHERE child.id <> ALL(se.path_ids)
  ),
  subtree_rollups AS (
    SELECT
      se.ancestor_id,
      (count(*) - 1)::INTEGER AS total_reports_count,
      count(*)::INTEGER AS subtree_headcount,
      COALESCE(sum(descendant.basic_salary), 0)::NUMERIC AS subtree_salary_total
    FROM subtree_edges se
    JOIN effective_employees descendant ON descendant.id = se.descendant_id
    GROUP BY se.ancestor_id
  )
  SELECT
    tree.id AS employee_id,
    tree.manager_id,
    tree.employee_number,
    tree.first_name,
    tree.last_name,
    tree.full_name,
    tree.photo_url,
    tree.job_title,
    tree.date_of_birth,
    tree.department_id,
    COALESCE(dept.name, tree.department) AS department_name,
    dept.code AS department_code,
    dept.parent_department_id,
    tree.branch_id,
    branch.name AS branch_name,
    tree.employment_status,
    tree.hire_date,
    tree.termination_date,
    tree.basic_salary,
    tree.depth,
    tree.path_ids,
    tree.path_names,
    tree.sort_path,
    COALESCE(dr.direct_reports_count, 0) AS direct_reports_count,
    COALESCE(sr.total_reports_count, 0) AS total_reports_count,
    COALESCE(sr.subtree_headcount, 1) AS subtree_headcount,
    COALESCE(dr.direct_reports_salary_total, 0)::NUMERIC AS direct_reports_salary_total,
    COALESCE(sr.subtree_salary_total, COALESCE(tree.basic_salary, 0))::NUMERIC AS subtree_salary_total,
    COALESCE(dr.direct_reports_count, 0) > 0 AS has_children,
    COALESCE(tree.user_id = current_setting('touchorbit.current_user_id', true)::uuid, false) AS is_current_user
  FROM org_tree tree
  LEFT JOIN departments dept
    ON dept.id = tree.department_id
   AND dept.organization_id = v_org_id
  LEFT JOIN branches branch
    ON branch.id = tree.branch_id
   AND branch.organization_id = v_org_id
  LEFT JOIN direct_rollups dr
    ON dr.manager_id = tree.id
  LEFT JOIN subtree_rollups sr
    ON sr.ancestor_id = tree.id
  ORDER BY tree.sort_path;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_org_chart_matrix_edges()
 RETURNS TABLE(employee_id uuid, matrix_manager_id uuid, relationship_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    report.employee_id,
    report.matrix_manager_id,
    COALESCE(report.relationship_type, 'project') AS relationship_type
  FROM employee_matrix_reports report
  JOIN employees employee
    ON employee.id = report.employee_id
   AND employee.organization_id = v_org_id
  JOIN employees manager
    ON manager.id = report.matrix_manager_id
   AND manager.organization_id = v_org_id
  WHERE report.organization_id = v_org_id
    AND employee.termination_date IS NULL
    AND COALESCE(employee.employment_status, 'active') <> 'terminated'
    AND manager.termination_date IS NULL
    AND COALESCE(manager.employment_status, 'active') <> 'terminated'
  ORDER BY COALESCE(report.relationship_type, 'project'), report.employee_id, report.matrix_manager_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_org_vacancies()
 RETURNS TABLE(id uuid, department_id uuid, department_name text, manager_id uuid, title text, level text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to view org vacancies' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pos.id,
    pos.department_id,
    department.name AS department_name,
    pos.manager_id,
    pos.title,
    pos.level
  FROM org_positions pos
  LEFT JOIN departments department
    ON department.id = pos.department_id
   AND department.organization_id = v_org_id
  WHERE pos.organization_id = v_org_id
    AND COALESCE(pos.is_filled, false) = false
  ORDER BY
    COALESCE(department.name, ''),
    COALESCE(pos.level, ''),
    COALESCE(pos.title, ''),
    pos.id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_overtime_fraud_report(p_start_date date, p_end_date date, p_department_id uuid DEFAULT NULL::uuid, p_employee_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, overtime_date date, overtime_hours numeric, overtime_status text, had_roster_shift boolean, shift_name text, scheduled_start time without time zone, scheduled_end time without time zone, flag text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  RETURN QUERY
  SELECT
    e.id                                          AS employee_id,
    (e.first_name || ' ' || e.last_name)          AS employee_name,
    d.name                                        AS department_name,
    ot.date                                       AS overtime_date,
    ot.hours                                      AS overtime_hours,
    ot.status                                     AS overtime_status,
    (ra.shift_id IS NOT NULL)                     AS had_roster_shift,
    s.name                                        AS shift_name,
    s.start_time                                  AS scheduled_start,
    s.end_time                                    AS scheduled_end,
    CASE
      WHEN ra.shift_id IS NULL THEN 'unscheduled_day'
      ELSE 'scheduled_day'
    END                                           AS flag
  FROM  overtime_records ot
  JOIN  employees          e  ON e.id = ot.employee_id
  LEFT JOIN departments    d  ON d.id = e.department_id
  LEFT JOIN roster_assignments ra ON ra.employee_id = ot.employee_id AND ra.date = ot.date
  LEFT JOIN shifts             s  ON s.id = ra.shift_id
  WHERE ot.organization_id = v_org_id
    AND ot.date BETWEEN p_start_date AND p_end_date
    AND ot.status != 'rejected'
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (p_employee_ids  IS NULL OR e.id = ANY(p_employee_ids))
  ORDER BY flag DESC, ot.date DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_present_employee_ids(p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, presence_status text, last_event_type text, last_event_at timestamp with time zone, last_clock_event_id uuid, is_clocked_in boolean, is_on_leave boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to view org chart presence';
  END IF;

  RETURN QUERY
  WITH active_employees AS (
    SELECT
      emp.id,
      emp.employment_status
    FROM employees emp
    WHERE emp.organization_id = v_org_id
      AND emp.termination_date IS NULL
      AND COALESCE(emp.employment_status, 'active') <> 'terminated'
      AND (p_branch_id IS NULL OR emp.branch_id = p_branch_id)
  ),
  latest_clock AS (
    SELECT DISTINCT ON (ce.employee_id)
      ce.employee_id,
      ce.id AS clock_event_id,
      ce.event_type,
      ce.timestamp
    FROM clock_events ce
    JOIN active_employees emp ON emp.id = ce.employee_id
    WHERE ce.organization_id = v_org_id
      AND ce.event_type IN ('clock_in', 'clock_out')
    ORDER BY ce.employee_id, ce.timestamp DESC, ce.created_at DESC, ce.id DESC
  )
  SELECT
    emp.id AS employee_id,
    CASE
      WHEN COALESCE(emp.employment_status, 'active') = 'on_leave' THEN 'on_leave'
      WHEN latest.event_type = 'clock_in' THEN 'clocked_in'
      ELSE 'away'
    END AS presence_status,
    latest.event_type AS last_event_type,
    latest.timestamp AS last_event_at,
    latest.clock_event_id AS last_clock_event_id,
    COALESCE(latest.event_type = 'clock_in', false) AS is_clocked_in,
    COALESCE(emp.employment_status, 'active') = 'on_leave' AS is_on_leave
  FROM active_employees emp
  LEFT JOIN latest_clock latest ON latest.employee_id = emp.id
  WHERE COALESCE(emp.employment_status, 'active') = 'on_leave'
     OR latest.event_type = 'clock_in'
  ORDER BY latest.timestamp DESC NULLS LAST, emp.id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_calendar_events(p_token text, p_start_date date, p_end_date date)
 RETURNS TABLE(id uuid, title text, description text, event_type text, event_scope text, start_time timestamp with time zone, end_time timestamp with time zone, all_day boolean, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_share public_calendar_tokens%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 24 THEN
    RAISE EXCEPTION 'Invalid public calendar token' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_share
  FROM public_calendar_tokens
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired public calendar token' USING ERRCODE = '42501';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end date must be on or after start date' USING ERRCODE = '22023';
  END IF;

  IF v_share.allowed_start_date IS NOT NULL AND p_start_date < v_share.allowed_start_date THEN
    p_start_date := v_share.allowed_start_date;
  END IF;

  IF v_share.allowed_end_date IS NOT NULL AND p_end_date > v_share.allowed_end_date THEN
    p_end_date := v_share.allowed_end_date;
  END IF;

  UPDATE public_calendar_tokens
  SET last_used_at = now()
  WHERE id = v_share.id;

  RETURN QUERY
  SELECT
    ce.id,
    ce.title,
    ce.description,
    ce.event_type,
    ce.event_scope,
    COALESCE(ce.start_at, (ce.event_date + COALESCE(ce.start_time, '00:00'::TIME))::TIMESTAMPTZ) AS start_time,
    COALESCE(ce.end_at, (ce.event_date + COALESCE(ce.end_time, ce.start_time, '23:59'::TIME))::TIMESTAMPTZ) AS end_time,
    COALESCE(ce.all_day, false) AS all_day,
    ce.status
  FROM calendar_events ce
  WHERE ce.organization_id = v_share.organization_id
    AND COALESCE(ce.status, 'confirmed') = 'confirmed'
    AND COALESCE(ce.start_at::DATE, ce.event_date) <= p_end_date
    AND COALESCE(ce.end_at::DATE, ce.event_date) >= p_start_date
  ORDER BY start_time, ce.title;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_roster_week(p_week_start date)
 RETURNS TABLE(assignment_id uuid, employee_id uuid, employee_name text, department_id uuid, department_name text, branch_id uuid, date date, shift_template_id uuid, shift_id uuid, shift_name text, start_time time without time zone, end_time time without time zone, break_minutes integer, notes text, acknowledgment_status text, conflict_reason text, conflict_flagged_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ra.id AS assignment_id,
    e.id AS employee_id,
    concat_ws(' ', e.first_name, e.last_name) AS employee_name,
    e.department_id,
    d.name AS department_name,
    e.branch_id,
    ra.date,
    ra.shift_id AS shift_template_id,
    ra.shift_id,
    s.name AS shift_name,
    s.start_time,
    s.end_time,
    s.break_minutes,
    ra.notes,
    COALESCE(ra.acknowledgment_status, 'pending') AS acknowledgment_status,
    ra.conflict_reason,
    ra.conflict_flagged_at
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN roster_assignments ra ON ra.employee_id = e.id
    AND ra.date >= p_week_start
    AND ra.date < p_week_start + INTERVAL '7 days'
  LEFT JOIN shifts s ON s.id = ra.shift_id
  WHERE e.organization_id = get_my_org_id()
    AND e.termination_date IS NULL
  ORDER BY employee_name, ra.date;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_roster_week_status(p_week_start date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM roster_week_status
  WHERE organization_id = get_my_org_id()
    AND week_start = p_week_start;

  RETURN COALESCE(v_status, 'draft');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_shift_adherence(p_week_start date)
 RETURNS TABLE(employee_id uuid, employee_name text, department_id uuid, department_name text, date date, shift_name text, scheduled_start time without time zone, scheduled_end time without time zone, actual_clock_in timestamp with time zone, actual_clock_out timestamp with time zone, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  RETURN QUERY
  WITH week_days AS (
    SELECT (p_week_start + (i || ' days')::interval)::date AS day
    FROM generate_series(0, 6) AS i
  ),
  active_employees AS (
    SELECT
      e.id,
      (e.first_name || ' ' || e.last_name) AS name,
      e.department_id,
      d.name AS dept_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.organization_id = v_org_id
      AND e.termination_date IS NULL
  ),
  assignments AS (
    SELECT
      ae.id AS employee_id,
      ae.name AS employee_name,
      ae.department_id,
      ae.dept_name AS department_name,
      wd.day AS assignment_date,
      ra.shift_template_id,
      st.name AS shift_name,
      st.start_time,
      st.end_time
    FROM active_employees ae
    CROSS JOIN week_days wd
    LEFT JOIN roster_assignments ra ON ae.id = ra.employee_id AND ra.date = wd.day
    LEFT JOIN shift_templates st ON ra.shift_template_id = st.id
  ),
  daily_clocks AS (
    SELECT
      ce.employee_id,
      ce.timestamp::date AS clock_date,
      MIN(CASE WHEN ce.event_type = 'clock_in' THEN ce.timestamp END) AS first_in,
      MAX(CASE WHEN ce.event_type = 'clock_out' THEN ce.timestamp END) AS last_out
    FROM clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.timestamp >= p_week_start::timestamptz
      AND ce.timestamp < (p_week_start + interval '7 days')::timestamptz
    GROUP BY ce.employee_id, ce.timestamp::date
  )
  SELECT
    a.employee_id,
    a.employee_name,
    a.department_id,
    a.department_name,
    a.assignment_date,
    a.shift_name,
    a.start_time,
    a.end_time,
    dc.first_in,
    dc.last_out,
    CASE
      WHEN a.shift_template_id IS NULL THEN 'day_off'
      WHEN dc.first_in IS NULL THEN 'absent'
      ELSE
        CASE
          WHEN dc.first_in::time > (a.start_time + interval '5 minutes') AND (dc.last_out IS NOT NULL AND dc.last_out::time < (a.end_time - interval '5 minutes')) THEN 'late_early'
          WHEN dc.first_in::time > (a.start_time + interval '5 minutes') THEN 'late'
          WHEN (dc.last_out IS NOT NULL AND dc.last_out::time < (a.end_time - interval '5 minutes')) THEN 'early_departure'
          ELSE 'on_time'
        END
    END AS status
  FROM assignments a
  LEFT JOIN daily_clocks dc ON a.employee_id = dc.employee_id AND a.assignment_date = dc.clock_date
  ORDER BY a.employee_name, a.assignment_date;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_shift_adherence_for_date(p_date date)
 RETURNS TABLE(employee_id uuid, employee_name text, department_id uuid, department_name text, branch_id uuid, assignment_id uuid, shift_id uuid, shift_name text, scheduled_start timestamp with time zone, scheduled_end timestamp with time zone, clock_in timestamp with time zone, clock_out timestamp with time zone, status text, minutes_late integer, minutes_early_leave integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_grace INT;
BEGIN
  v_org_id := get_my_org_id();

  SELECT COALESCE(late_threshold_minutes, 5)
  INTO v_grace
  FROM organizations
  WHERE id = v_org_id;

  RETURN QUERY
  WITH daily_clocks AS (
    SELECT
      ce.employee_id,
      MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') AS first_in,
      MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
    FROM clock_events ce
    WHERE ce.organization_id = v_org_id
      AND ce.timestamp::DATE = p_date
    GROUP BY ce.employee_id
  )
  SELECT
    e.id AS employee_id,
    concat_ws(' ', e.first_name, e.last_name) AS employee_name,
    e.department_id,
    d.name AS department_name,
    e.branch_id,
    ra.id AS assignment_id,
    ra.shift_id,
    s.name AS shift_name,
    (p_date + s.start_time)::TIMESTAMPTZ AS scheduled_start,
    (p_date + s.end_time)::TIMESTAMPTZ
      + CASE WHEN s.end_time < s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END AS scheduled_end,
    dc.first_in AS clock_in,
    dc.last_out AS clock_out,
    CASE
      WHEN ra.id IS NULL THEN 'day_off'
      WHEN dc.first_in IS NULL THEN 'absent'
      WHEN dc.first_in > ((p_date + s.start_time)::TIMESTAMPTZ + make_interval(mins => v_grace)) THEN 'late'
      WHEN dc.last_out IS NOT NULL
        AND dc.last_out < ((p_date + s.end_time)::TIMESTAMPTZ + CASE WHEN s.end_time < s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END)
        THEN 'early_leave'
      ELSE 'on_time'
    END AS status,
    CASE
      WHEN dc.first_in IS NOT NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (dc.first_in - (p_date + s.start_time)::TIMESTAMPTZ)) / 60)::INT)
      ELSE NULL
    END AS minutes_late,
    CASE
      WHEN dc.last_out IS NOT NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (((p_date + s.end_time)::TIMESTAMPTZ + CASE WHEN s.end_time < s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) - dc.last_out)) / 60)::INT)
      ELSE NULL
    END AS minutes_early_leave
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN roster_assignments ra ON ra.employee_id = e.id AND ra.date = p_date
  LEFT JOIN shifts s ON s.id = ra.shift_id
  LEFT JOIN daily_clocks dc ON dc.employee_id = e.id
  WHERE e.organization_id = v_org_id
    AND e.termination_date IS NULL
    AND (ra.id IS NOT NULL OR dc.first_in IS NOT NULL)
  ORDER BY employee_name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_suspicious_events_summary(p_organization_id uuid)
 RETURNS TABLE(total_flagged bigint, flagged_this_week bigint, flagged_this_month bigint, top_flags jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE admin_review_status = 'flagged'),
    COUNT(*) FILTER (WHERE admin_review_status = 'flagged' AND timestamp >= now() - interval '7 days'),
    COUNT(*) FILTER (WHERE admin_review_status = 'flagged' AND timestamp >= now() - interval '30 days'),
    (
      SELECT jsonb_agg(flag_data)
      FROM (
        SELECT flag, COUNT(*) as count
        FROM clock_events, unnest(suspicious_flags) as flag
        WHERE organization_id = p_organization_id
          AND admin_review_status = 'flagged'
        GROUP BY flag
        ORDER BY count DESC
        LIMIT 5
      ) flag_data
    ) as top_flags
  FROM clock_events
  WHERE organization_id = p_organization_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_todays_no_shows()
 RETURNS TABLE(employee_id uuid, employee_name text, department_name text, shift_name text, scheduled_start time without time zone, minutes_late integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT * FROM get_no_shows_for_date(CURRENT_DATE);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = p_user_id AND read = false;

  RETURN v_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_upcoming_birthdays(p_org_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(employee_id uuid, employee_name text, date_of_birth date, department text, department_id uuid, branch_id uuid, next_occurrence date, age integer, days_until integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Not authorized to read birthdays for this organization';
  END IF;

  RETURN QUERY
  WITH employee_birthdays AS (
    SELECT
      e.id AS employee_id,
      concat_ws(' ', e.first_name, e.last_name) AS employee_name,
      e.date_of_birth,
      COALESCE(d.name, e.department, '-') AS department,
      e.department_id,
      e.branch_id,
      make_date(
        EXTRACT(YEAR FROM CURRENT_DATE)::INT,
        EXTRACT(MONTH FROM e.date_of_birth)::INT,
        LEAST(
          EXTRACT(DAY FROM e.date_of_birth)::INT,
          EXTRACT(DAY FROM (date_trunc('month', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM e.date_of_birth)::INT, 1)) + INTERVAL '1 month - 1 day'))::INT
        )
      ) AS birthday_this_year
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.organization_id = p_org_id
      AND e.date_of_birth IS NOT NULL
      AND COALESCE(e.employment_status, 'active') = 'active'
  ), upcoming AS (
    SELECT
      eb.*,
      CASE
        WHEN eb.birthday_this_year < CURRENT_DATE THEN
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1,
            EXTRACT(MONTH FROM eb.date_of_birth)::INT,
            LEAST(
              EXTRACT(DAY FROM eb.date_of_birth)::INT,
              EXTRACT(DAY FROM (date_trunc('month', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, EXTRACT(MONTH FROM eb.date_of_birth)::INT, 1)) + INTERVAL '1 month - 1 day'))::INT
            )
          )
        ELSE eb.birthday_this_year
      END AS next_occurrence
    FROM employee_birthdays eb
  )
  SELECT
    u.employee_id,
    u.employee_name,
    u.date_of_birth,
    u.department,
    u.department_id,
    u.branch_id,
    u.next_occurrence,
    EXTRACT(YEAR FROM age(u.next_occurrence, u.date_of_birth))::INT AS age,
    (u.next_occurrence - CURRENT_DATE)::INT AS days_until
  FROM upcoming u
  ORDER BY u.next_occurrence, u.employee_name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_system_role TEXT;
  v_org_id UUID;
  v_is_owner_only BOOLEAN := false;
BEGIN
  SELECT u.role, u.organization_id INTO v_role, v_org_id
  FROM users u
  WHERE u.id = current_setting('touchorbit.current_user_id', true)::uuid;

  IF v_org_id IS NULL THEN
    RETURN false;
  END IF;

  v_system_role := get_my_system_role();

  SELECT COALESCE(p.is_owner_only, false)
  INTO v_is_owner_only
  FROM permissions p
  WHERE p.key = p_permission_key;

  IF v_system_role = 'owner' THEN
    RETURN true;
  END IF;

  IF v_system_role = 'super_admin' AND NOT COALESCE(v_is_owner_only, false) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM user_permission_overrides upo
    WHERE upo.user_id = current_setting('touchorbit.current_user_id', true)::uuid
      AND upo.organization_id = v_org_id
      AND upo.permission_key = p_permission_key
      AND upo.effect = 'deny'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM user_permission_overrides upo
    WHERE upo.user_id = current_setting('touchorbit.current_user_id', true)::uuid
      AND upo.organization_id = v_org_id
      AND upo.permission_key = p_permission_key
      AND upo.effect = 'allow'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM user_permission_groups upg
    JOIN permission_group_permissions pgp ON pgp.group_id = upg.group_id
    WHERE upg.user_id = current_setting('touchorbit.current_user_id', true)::uuid
      AND upg.organization_id = v_org_id
      AND upg.scope_type = 'organization'
      AND pgp.permission_key = p_permission_key
  ) THEN
    RETURN true;
  END IF;

  IF p_permission_key IN ('employees.manage_app_access', 'employees.read_auth_status', 'employees.terminate') THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin');
  END IF;

  IF p_permission_key IN ('payroll.read', 'payroll.process', 'payroll.finalize', 'payroll.delete_run', 'payroll.manage_components', 'payroll.send_payslips') THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin', 'finance');
  END IF;

  IF p_permission_key LIKE 'attendance.%' THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin', 'manager');
  END IF;

  IF p_permission_key LIKE 'leave.%' OR p_permission_key LIKE 'overtime.%' THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin', 'manager');
  END IF;

  IF p_permission_key LIKE 'expenses.%' THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin', 'finance', 'manager');
  END IF;

  IF p_permission_key LIKE 'roster.%' THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin', 'manager');
  END IF;

  IF p_permission_key = 'geofences.manage' THEN
    RETURN v_role IN ('owner', 'super_admin', 'hr_admin');
  END IF;

  IF p_permission_key LIKE 'settings.%' OR p_permission_key LIKE 'security.%' THEN
    RETURN v_role IN ('owner', 'super_admin');
  END IF;

  RETURN false;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_permission_for_employee(p_permission_key text, p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_employee_org_id UUID;
  v_employee_dept_id UUID;
  v_employee_branch_id UUID;
  v_employee_user_id UUID;
BEGIN
  SELECT organization_id, role INTO v_org_id, v_role
  FROM users
  WHERE id = current_setting('touchorbit.current_user_id', true)::uuid;

  SELECT organization_id, department_id, branch_id, user_id
  INTO v_employee_org_id, v_employee_dept_id, v_employee_branch_id, v_employee_user_id
  FROM employees
  WHERE id = p_employee_id;

  IF v_org_id IS NULL OR v_org_id IS DISTINCT FROM v_employee_org_id THEN
    RETURN false;
  END IF;

  IF has_permission(p_permission_key) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM user_permission_groups upg
    JOIN permission_group_permissions pgp ON pgp.group_id = upg.group_id
    WHERE upg.user_id = current_setting('touchorbit.current_user_id', true)::uuid
      AND upg.organization_id = v_org_id
      AND pgp.permission_key = p_permission_key
      AND (
        upg.scope_type = 'organization'
        OR (upg.scope_type = 'department' AND upg.scope_id = v_employee_dept_id)
        OR (upg.scope_type = 'branch' AND upg.scope_id = v_employee_branch_id)
        OR (upg.scope_type = 'self' AND v_employee_user_id = current_setting('touchorbit.current_user_id', true)::uuid)
      )
  ) THEN
    RETURN true;
  END IF;

  IF v_role = 'dept_manager' AND v_employee_dept_id = get_my_managed_dept_id() THEN
    RETURN p_permission_key LIKE 'attendance.%'
        OR p_permission_key LIKE 'leave.%'
        OR p_permission_key LIKE 'overtime.%'
        OR p_permission_key LIKE 'expenses.%'
        OR p_permission_key LIKE 'roster.%';
  END IF;

  IF v_role = 'branch_manager' AND v_employee_branch_id = get_my_managed_branch_id() THEN
    RETURN p_permission_key LIKE 'attendance.%'
        OR p_permission_key LIKE 'leave.%'
        OR p_permission_key LIKE 'overtime.%'
        OR p_permission_key LIKE 'expenses.%'
        OR p_permission_key LIKE 'roster.%';
  END IF;

  RETURN false;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.initialize_employee_leave_balances()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_annual_days INTEGER := 14;  -- Default from organization settings
  v_casual_days INTEGER := 7;
  v_sick_days INTEGER := 7;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  -- Get organization's leave policy (if exists)
  SELECT
    COALESCE(annual_leave_days, 14),
    COALESCE(casual_leave_days, 7),
    COALESCE(sick_leave_days, 7)
  INTO v_annual_days, v_casual_days, v_sick_days
  FROM organizations
  WHERE id = NEW.organization_id;

  -- Create annual leave balance
  INSERT INTO leave_balances (organization_id, employee_id, year, leave_type, entitled_days, used_days)
  VALUES (NEW.organization_id, NEW.id, v_current_year, 'annual', v_annual_days, 0)
  ON CONFLICT (organization_id, employee_id, year, leave_type) DO NOTHING;

  -- Create casual leave balance
  INSERT INTO leave_balances (organization_id, employee_id, year, leave_type, entitled_days, used_days)
  VALUES (NEW.organization_id, NEW.id, v_current_year, 'casual', v_casual_days, 0)
  ON CONFLICT (organization_id, employee_id, year, leave_type) DO NOTHING;

  -- Create sick leave balance
  INSERT INTO leave_balances (organization_id, employee_id, year, leave_type, entitled_days, used_days)
  VALUES (NEW.organization_id, NEW.id, v_current_year, 'sick', v_sick_days, 0)
  ON CONFLICT (organization_id, employee_id, year, leave_type) DO NOTHING;

  -- Create comp-off balance (starts at 0, earned through overtime)
  INSERT INTO leave_balances (organization_id, employee_id, year, leave_type, entitled_days, used_days)
  VALUES (NEW.organization_id, NEW.id, v_current_year, 'comp_off', 0, 0)
  ON CONFLICT (organization_id, employee_id, year, leave_type) DO NOTHING;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.insert_sri_lankan_holidays_2026(p_organization_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM holidays WHERE organization_id = p_organization_id AND EXTRACT(YEAR FROM date) = 2026) THEN
    RETURN 0;
  END IF;

  INSERT INTO holidays (organization_id, name, date, type, recurring, description) VALUES
  (p_organization_id, 'New Year''s Day', '2026-01-01', 'public', true, 'Public Holiday'),
  (p_organization_id, 'Thai Pongal', '2026-01-14', 'public', true, 'Hindu Harvest Festival'),
  (p_organization_id, 'Independence Day', '2026-02-04', 'public', true, 'National Day'),
  (p_organization_id, 'Sinhala & Tamil New Year', '2026-04-14', 'public', true, 'New Year Festival'),
  (p_organization_id, 'Good Friday', '2026-04-03', 'public', false, 'Christian Holiday'),
  (p_organization_id, 'May Day', '2026-05-01', 'public', true, 'International Workers'' Day'),
  (p_organization_id, 'Vesak Full Moon Poya Day', '2026-05-22', 'public', false, 'Buddhist Festival'),
  (p_organization_id, 'Vesak Day Following Day', '2026-05-23', 'public', false, 'Buddhist Festival'),
  (p_organization_id, 'Christmas Day', '2026-12-25', 'public', true, 'Christian Holiday'),
  (p_organization_id, 'Special Bank Holiday', '2026-12-31', 'public', true, 'Year End Holiday');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(get_my_system_role() IN ('owner', 'super_admin', 'admin', 'manager'), false)
$function$
;
CREATE OR REPLACE FUNCTION public.is_clocked_in(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_last_event TEXT;
BEGIN
  SELECT event_type INTO v_last_event
  FROM clock_events
  WHERE employee_id = p_employee_id
  ORDER BY timestamp DESC
  LIMIT 1;

  RETURN v_last_event = 'clock_in';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_late(p_employee_id uuid, p_clock_in_time timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_shift RECORD;
  v_expected_time TIME;
  v_actual_time TIME;
  v_grace_end TIME;
BEGIN
  -- Get employee's shift for this time
  SELECT * INTO v_shift
  FROM get_employee_shift(p_employee_id, p_clock_in_time);

  -- No shift assigned = use default 9 AM
  IF v_shift IS NULL THEN
    v_expected_time := '09:00:00'::TIME;
    v_grace_end := '09:15:00'::TIME;
  ELSE
    v_expected_time := v_shift.start_time;
    v_grace_end := v_shift.start_time + (v_shift.grace_period_minutes || ' minutes')::INTERVAL;
  END IF;

  -- Compare times
  v_actual_time := p_clock_in_time::TIME;

  RETURN v_actual_time > v_grace_end;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_employee_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_by UUID := current_setting('touchorbit.current_user_id', true)::uuid;
  v_changed_by_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(concat_ws(' ', u.first_name, u.last_name), ''), u.email, 'Admin')
  INTO v_changed_by_name
  FROM users u
  WHERE u.id = v_changed_by;

  IF OLD.job_title IS DISTINCT FROM NEW.job_title THEN
    INSERT INTO employee_history (employee_id, event_type, event_date, details, description, changed_by, changed_by_name)
    VALUES (
      NEW.id,
      'updated',
      now(),
      jsonb_build_object('field', 'job_title', 'old_value', OLD.job_title, 'new_value', NEW.job_title),
      'Job title changed.',
      v_changed_by,
      COALESCE(v_changed_by_name, 'Admin')
    );
  END IF;

  IF OLD.department IS DISTINCT FROM NEW.department THEN
    INSERT INTO employee_history (employee_id, event_type, event_date, details, description, changed_by, changed_by_name)
    VALUES (
      NEW.id,
      'updated',
      now(),
      jsonb_build_object('field', 'department', 'old_value', OLD.department, 'new_value', NEW.department),
      'Department text changed.',
      v_changed_by,
      COALESCE(v_changed_by_name, 'Admin')
    );
  END IF;

  IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    INSERT INTO employee_history (employee_id, event_type, event_date, details, description, changed_by, changed_by_name)
    VALUES (
      NEW.id,
      'department_changed',
      now(),
      jsonb_build_object(
        'field', 'department_id',
        'old_value', OLD.department_id,
        'new_value', NEW.department_id,
        'old_department_id', OLD.department_id,
        'new_department_id', NEW.department_id
      ),
      'Department changed for org chart reporting line.',
      v_changed_by,
      COALESCE(v_changed_by_name, 'Admin')
    );
  END IF;

  IF OLD.basic_salary IS DISTINCT FROM NEW.basic_salary THEN
    INSERT INTO employee_history (employee_id, event_type, event_date, details, description, changed_by, changed_by_name)
    VALUES (
      NEW.id,
      'updated',
      now(),
      jsonb_build_object('field', 'basic_salary', 'old_value', OLD.basic_salary, 'new_value', NEW.basic_salary),
      'Salary changed.',
      v_changed_by,
      COALESCE(v_changed_by_name, 'Admin')
    );
  END IF;

  IF OLD.employment_status IS DISTINCT FROM NEW.employment_status THEN
    INSERT INTO employee_history (employee_id, event_type, event_date, details, description, changed_by, changed_by_name)
    VALUES (
      NEW.id,
      'status_changed',
      now(),
      jsonb_build_object(
        'old_status', OLD.employment_status,
        'new_status', NEW.employment_status,
        'termination_reason', NEW.termination_reason,
        'last_working_day', NEW.last_working_day
      ),
      'Employment status changed.',
      v_changed_by,
      COALESCE(v_changed_by_name, 'Admin')
    );
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_employee_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  admin_name TEXT;
BEGIN
  -- Try to get admin name
  BEGIN
    SELECT first_name || ' ' || last_name INTO admin_name
    FROM users
    WHERE id = current_setting('app.current_user_id', true);
  EXCEPTION WHEN OTHERS THEN
    admin_name := 'Admin';
  END;

  INSERT INTO employee_history (
    employee_id,
    event_type,
    event_date,
    description,
    changed_by,
    changed_by_name
  ) VALUES (
    NEW.id,
    'employee_created',
    NOW(),
    'Employee record created.',
    NULL, -- changed_by can be null
    COALESCE(admin_name, 'Admin')
  );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_roster_assignment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_shift shifts%ROWTYPE;
  v_existing RECORD;
  v_new_start TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_existing_start TIMESTAMPTZ;
  v_existing_end TIMESTAMPTZ;
  v_message TEXT;
BEGIN
  IF NEW.shift_id IS NULL OR NEW.employee_id IS NULL OR NEW.date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_new_shift
  FROM shifts
  WHERE id = NEW.shift_id
    AND organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_new_start := (NEW.date + v_new_shift.start_time)::TIMESTAMPTZ;
  v_new_end := (NEW.date + v_new_shift.end_time)::TIMESTAMPTZ
    + CASE WHEN v_new_shift.end_time <= v_new_shift.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END;

  FOR v_existing IN
    SELECT ra.id, ra.shift_id, s.name, s.start_time, s.end_time
    FROM roster_assignments ra
    JOIN shifts s ON s.id = ra.shift_id
    WHERE ra.organization_id = NEW.organization_id
      AND ra.employee_id = NEW.employee_id
      AND ra.date = NEW.date
      AND ra.id IS DISTINCT FROM NEW.id
      AND ra.shift_id IS NOT NULL
  LOOP
    v_existing_start := (NEW.date + v_existing.start_time)::TIMESTAMPTZ;
    v_existing_end := (NEW.date + v_existing.end_time)::TIMESTAMPTZ
      + CASE WHEN v_existing.end_time <= v_existing.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END;

    IF v_new_start < v_existing_end AND v_existing_start < v_new_end THEN
      v_message := 'Employee has overlapping roster assignments on ' || NEW.date::TEXT;

      NEW.conflict_reason := COALESCE(NEW.conflict_reason, v_message);
      NEW.conflict_flagged_at := COALESCE(NEW.conflict_flagged_at, now());

      INSERT INTO conflict_log (
        organization_id,
        conflict_type,
        severity,
        employee_id,
        conflict_date,
        source_table,
        source_id,
        conflicting_source_id,
        message,
        details
      )
      SELECT
        NEW.organization_id,
        'roster_shift_overlap',
        'high',
        NEW.employee_id,
        NEW.date,
        'roster_assignments',
        NEW.id,
        v_existing.id,
        v_message,
        jsonb_build_object(
          'assignment_ids', jsonb_build_array(NEW.id, v_existing.id),
          'new_shift', jsonb_build_object('id', NEW.shift_id, 'name', v_new_shift.name, 'start_time', v_new_shift.start_time, 'end_time', v_new_shift.end_time),
          'existing_shift', jsonb_build_object('id', v_existing.shift_id, 'name', v_existing.name, 'start_time', v_existing.start_time, 'end_time', v_existing.end_time),
          'overlap_start', GREATEST(v_new_start, v_existing_start),
          'overlap_end', LEAST(v_new_end, v_existing_end)
        )
      WHERE NOT EXISTS (
        SELECT 1
        FROM conflict_log cl
        WHERE cl.organization_id = NEW.organization_id
          AND cl.conflict_type = 'roster_shift_overlap'
          AND cl.status = 'open'
          AND cl.source_table = 'roster_assignments'
          AND (
            (cl.source_id = NEW.id AND cl.conflicting_source_id = v_existing.id)
            OR (cl.source_id = v_existing.id AND cl.conflicting_source_id = NEW.id)
          )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = true
  WHERE user_id = p_user_id AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE id = p_notification_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mirror_employee_history_to_audit_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee employees%ROWTYPE;
  v_module TEXT;
  v_action TEXT;
  v_severity TEXT;
  v_audit_id UUID;
BEGIN
  IF NEW.employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_employee
  FROM employees
  WHERE id = NEW.employee_id;

  IF NOT FOUND OR v_employee.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit_events ae
    WHERE ae.organization_id = v_employee.organization_id
      AND ae.metadata ->> 'legacy_source_table' = 'employee_history'
      AND ae.metadata ->> 'legacy_source_id' = NEW.id::TEXT
  ) THEN
    RETURN NEW;
  END IF;

  v_module := audit_employee_history_module(NEW.event_type, COALESCE(NEW.details, '{}'::JSONB));
  v_action := audit_employee_history_action(NEW.event_type);
  v_severity := audit_employee_history_severity(NEW.event_type, COALESCE(NEW.details, '{}'::JSONB));

  v_audit_id := record_audit_event(
    v_employee.organization_id,
    NEW.changed_by,
    v_employee.user_id,
    NEW.employee_id,
    v_module,
    v_action,
    v_severity,
    'employee',
    NEW.employee_id,
    COALESCE(NULLIF(concat_ws(' ', v_employee.first_name, v_employee.last_name), ''), v_employee.email, v_employee.employee_number, v_employee.id::TEXT),
    audit_employee_history_old_value(COALESCE(NEW.details, '{}'::JSONB)),
    audit_employee_history_new_value(COALESCE(NEW.details, '{}'::JSONB)),
    CASE WHEN COALESCE(NEW.details, '{}'::JSONB) ? 'field' THEN jsonb_build_array(NEW.details ->> 'field') ELSE '[]'::JSONB END,
    jsonb_build_object(
      'legacy_source_table', 'employee_history',
      'legacy_source_id', NEW.id,
      'legacy_event_type', NEW.event_type,
      'description', NEW.description,
      'details', COALESCE(NEW.details, '{}'::JSONB)
    ),
    'trigger',
    NULL,
    NULL,
    NULL
  );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mirror_security_audit_log_to_audit_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_action TEXT;
  v_legacy_action TEXT;
  v_module TEXT := 'security';
  v_severity TEXT := 'sensitive';
  v_audit_id UUID;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit_events ae
    WHERE ae.organization_id = NEW.organization_id
      AND ae.metadata ->> 'legacy_source_table' = 'security_audit_log'
      AND ae.metadata ->> 'legacy_source_id' = NEW.id::TEXT
  ) THEN
    RETURN NEW;
  END IF;

  v_legacy_action := lower(COALESCE(NEW.action, 'updated'));

  IF v_legacy_action LIKE 'attendance.%' THEN
    v_module := 'attendance';
  ELSIF v_legacy_action LIKE 'leave.%' THEN
    v_module := 'leave';
  ELSIF v_legacy_action LIKE 'overtime.%' THEN
    v_module := 'overtime';
  ELSIF v_legacy_action LIKE 'expenses.%' THEN
    v_module := 'expenses';
  ELSIF v_legacy_action LIKE 'employees.%' THEN
    v_module := 'employees';
  ELSIF v_legacy_action LIKE 'payroll.%' THEN
    v_module := 'payroll';
  ELSIF v_legacy_action LIKE 'roster.%' THEN
    v_module := 'roster';
  ELSIF v_legacy_action LIKE 'calendar.%' THEN
    v_module := 'calendar';
  ELSIF v_legacy_action LIKE 'security.%' OR v_legacy_action LIKE 'settings.%' THEN
    v_module := 'security';
  END IF;

  v_action := CASE
    WHEN v_legacy_action LIKE 'attendance.review%' THEN 'reviewed'
    WHEN v_legacy_action LIKE 'employees.reassign%' THEN 'reassigned'
    WHEN COALESCE(NEW.new_value ->> 'decision', NEW.new_value ->> 'status') = 'approved' THEN 'approved'
    WHEN COALESCE(NEW.new_value ->> 'decision', NEW.new_value ->> 'status') = 'rejected' THEN 'rejected'
    WHEN v_legacy_action LIKE '%export%' THEN 'exported'
    WHEN v_legacy_action LIKE '%download%' THEN 'downloaded'
    WHEN v_legacy_action LIKE '%enable%' THEN 'enabled'
    WHEN v_legacy_action LIKE '%disable%' OR v_legacy_action LIKE '%suspend%' THEN 'disabled'
    ELSE 'updated'
  END;

  v_audit_id := record_audit_event(
    NEW.organization_id,
    NEW.actor_user_id,
    NEW.target_user_id,
    NEW.target_employee_id,
    v_module,
    v_action,
    v_severity,
    COALESCE(NEW.entity_type, 'security'),
    NEW.entity_id,
    COALESCE(NEW.entity_type, 'security'),
    COALESCE(NEW.old_value, '{}'::JSONB),
    COALESCE(NEW.new_value, '{}'::JSONB),
    '[]'::JSONB,
    jsonb_build_object(
      'legacy_source_table', 'security_audit_log',
      'legacy_source_id', NEW.id,
      'legacy_action', NEW.action
    ),
    'trigger',
    NULL,
    NEW.ip_address,
    NEW.user_agent
  );

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_admins_for_calendar_hub(p_organization_id uuid, p_type text, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin RECORD;
BEGIN
  FOR v_admin IN
    SELECT id
    FROM users
    WHERE organization_id = p_organization_id
      AND role IN ('owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'dept_manager', 'branch_manager')
  LOOP
    IF EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.organization_id = p_organization_id
        AND n.user_id = v_admin.id
        AND n.type = p_type
        AND n.title = p_title
        AND n.message = p_message
        AND n.created_at > now() - INTERVAL '6 hours'
    ) THEN
      CONTINUE;
    END IF;

    BEGIN
      PERFORM create_notification(p_organization_id, v_admin.id, p_type, p_title, p_message, p_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_admins_for_calendar_hub failed for user %: %', v_admin.id, SQLERRM;
    END;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_calendar_event_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_start TIMESTAMPTZ;
BEGIN
  v_start := COALESCE(NEW.start_at, (NEW.event_date + COALESCE(NEW.start_time, '00:00'::TIME))::TIMESTAMPTZ);

  FOR v_user_id IN
    SELECT DISTINCT e.user_id
    FROM employees e
    WHERE e.organization_id = NEW.organization_id
      AND e.user_id IS NOT NULL
      AND e.employment_status = 'active'
      AND (
        NEW.event_scope = 'organization'
        OR e.id = ANY(COALESCE(NEW.team_member_ids, ARRAY[]::UUID[]))
        OR e.branch_id = NEW.branch_id
        OR e.branch_id = NEW.secondary_branch_id
        OR e.department_id = NEW.department_id
        OR e.department_id = NEW.secondary_department_id
      )
  LOOP
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_user_id,
        'calendar_event_created',
        'New Calendar Event',
        NEW.title || ' is scheduled for ' || to_char(v_start, 'Mon DD, YYYY HH12:MI AM'),
        jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_calendar_event_created failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_calendar_event_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT (
    OLD.title IS DISTINCT FROM NEW.title
    OR OLD.start_at IS DISTINCT FROM NEW.start_at
    OR OLD.end_at IS DISTINCT FROM NEW.end_at
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.meeting_url IS DISTINCT FROM NEW.meeting_url
  ) THEN
    RETURN NEW;
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT e.user_id
    FROM employees e
    LEFT JOIN event_attendees ea ON ea.employee_id = e.id AND ea.event_id = NEW.id
    WHERE e.organization_id = NEW.organization_id
      AND e.user_id IS NOT NULL
      AND e.employment_status = 'active'
      AND (
        ea.id IS NOT NULL
        OR NEW.event_scope = 'organization'
        OR e.id = ANY(COALESCE(NEW.team_member_ids, ARRAY[]::UUID[]))
        OR e.branch_id = NEW.branch_id
        OR e.branch_id = NEW.secondary_branch_id
        OR e.department_id = NEW.department_id
        OR e.department_id = NEW.secondary_department_id
      )
  LOOP
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_user_id,
        'calendar_event_updated',
        'Calendar Event Updated',
        NEW.title || ' has been updated.',
        jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type, 'status', NEW.status)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_calendar_event_updated failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_calendar_reschedule_requested()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event calendar_events%ROWTYPE;
  v_employee_name TEXT;
  v_admin_id UUID;
BEGIN
  IF NEW.reschedule_requested IS DISTINCT FROM true
     OR COALESCE(OLD.reschedule_requested, false) IS true THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_event FROM calendar_events WHERE id = NEW.event_id;
  SELECT concat_ws(' ', first_name, last_name) INTO v_employee_name FROM employees WHERE id = NEW.employee_id;

  FOR v_admin_id IN
    SELECT id
    FROM users
    WHERE organization_id = NEW.organization_id
      AND role IN ('owner', 'super_admin', 'admin', 'manager', 'hr_admin', 'dept_manager', 'branch_manager')
  LOOP
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_admin_id,
        'calendar_reschedule_requested',
        'Event Reschedule Requested',
        COALESCE(v_employee_name, 'An employee') || ' requested to reschedule ' || COALESCE(v_event.title, 'an event'),
        jsonb_build_object('event_id', NEW.event_id, 'employee_id', NEW.employee_id, 'attendee_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_calendar_reschedule_requested failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_correction_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_employee RECORD;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending') THEN

    SELECT e.id, e.user_id, e.organization_id, e.first_name, e.last_name
    INTO v_employee
    FROM employees e
    WHERE e.id = NEW.employee_id;

    IF v_employee.user_id IS NOT NULL THEN
      IF NEW.status = 'approved' THEN
        v_title := 'Attendance Correction Approved';
        v_message := format('Your attendance correction request for %s has been approved.',
          TO_CHAR(NEW.requested_time, 'Mon DD at HH:MI AM')
        );
      ELSE
        v_title := 'Attendance Correction Rejected';
        v_message := format('Your attendance correction request for %s has been rejected.',
          TO_CHAR(NEW.requested_time, 'Mon DD at HH:MI AM')
        );

        IF NEW.rejection_reason IS NOT NULL THEN
          v_message := v_message || ' Reason: ' || NEW.rejection_reason;
        END IF;
      END IF;

      PERFORM create_notification(
        v_employee.organization_id,
        v_employee.user_id,
        'correction_' || NEW.status,
        v_title,
        v_message,
        jsonb_build_object('correction_id', NEW.id, 'correction_type', NEW.correction_type)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_employee_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT e.user_id INTO v_user_id
  FROM employees e
  WHERE e.id = NEW.employee_id
    AND e.organization_id = NEW.organization_id;

  IF v_user_id IS NULL OR v_user_id IS NOT DISTINCT FROM NEW.assigned_by THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM create_notification(
      NEW.organization_id,
      v_user_id,
      'task_assigned',
      'New Task Assigned',
      NEW.title,
      jsonb_build_object('task_id', NEW.id, 'due_date', NEW.due_date, 'category', NEW.category)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_employee_task_assigned failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_event_attendee_invited()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event calendar_events%ROWTYPE;
  v_user_id UUID;
  v_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_event
  FROM calendar_events
  WHERE id = NEW.event_id
    AND organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT e.user_id::UUID INTO v_user_id
  FROM employees e
  WHERE e.id = NEW.employee_id
    AND e.organization_id = NEW.organization_id
    AND e.user_id IS NOT NULL
    AND COALESCE(e.employment_status, 'active') = 'active';

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_start := COALESCE(v_event.start_at, (v_event.event_date + COALESCE(v_event.start_time, '00:00'::TIME))::TIMESTAMPTZ);

  BEGIN
    PERFORM create_notification(
      NEW.organization_id,
      v_user_id,
      'calendar_event_invited',
      'Calendar Invite',
      v_event.title || ' is scheduled for ' || to_char(v_start, 'Mon DD, YYYY HH12:MI AM'),
      jsonb_build_object(
        'event_id', NEW.event_id,
        'attendee_id', NEW.id,
        'employee_id', NEW.employee_id,
        'event_type', v_event.event_type
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_event_attendee_invited failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_leave_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_employee RECORD;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Only trigger on status change to approved/rejected
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending') THEN

    -- Get employee details
    SELECT e.id, e.user_id, e.organization_id, e.first_name, e.last_name
    INTO v_employee
    FROM employees e
    WHERE e.id = NEW.employee_id;

    IF v_employee.user_id IS NOT NULL THEN
      -- Build notification message
      IF NEW.status = 'approved' THEN
        v_title := 'Leave Request Approved';
        v_message := format('Your %s leave request from %s to %s has been approved.',
          NEW.leave_type,
          TO_CHAR(NEW.start_date, 'Mon DD'),
          TO_CHAR(NEW.end_date, 'Mon DD')
        );
      ELSE
        v_title := 'Leave Request Rejected';
        v_message := format('Your %s leave request from %s to %s has been rejected.',
          NEW.leave_type,
          TO_CHAR(NEW.start_date, 'Mon DD'),
          TO_CHAR(NEW.end_date, 'Mon DD')
        );

        IF NEW.rejection_reason IS NOT NULL THEN
          v_message := v_message || ' Reason: ' || NEW.rejection_reason;
        END IF;
      END IF;

      -- Create notification
      PERFORM create_notification(
        v_employee.organization_id,
        v_employee.user_id,
        'leave_' || NEW.status,
        v_title,
        v_message,
        jsonb_build_object('leave_id', NEW.id, 'leave_type', NEW.leave_type)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_employee RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Notify all active employees in the organization
    FOR v_employee IN
      SELECT e.id, e.user_id
      FROM employees e
      WHERE e.organization_id = NEW.organization_id
        AND e.employment_status = 'active'
        AND e.user_id IS NOT NULL
    LOOP
      PERFORM create_notification(
        NEW.organization_id,
        v_employee.user_id,
        'announcement_posted',
        'New Announcement',
        CASE
          WHEN LENGTH(NEW.content) > 100 THEN SUBSTRING(NEW.content, 1, 100) || '...'
          ELSE NEW.content
        END,
        jsonb_build_object('announcement_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_overtime_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_employee RECORD;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending') THEN

    SELECT e.id, e.user_id, e.organization_id, e.first_name, e.last_name
    INTO v_employee
    FROM employees e
    WHERE e.id = NEW.employee_id;

    IF v_employee.user_id IS NOT NULL THEN
      IF NEW.status = 'approved' THEN
        v_title := 'Overtime Approved';
        v_message := format('Your overtime request for %s hours on %s has been approved.',
          NEW.hours,
          TO_CHAR(NEW.date, 'Mon DD, YYYY')
        );
      ELSE
        v_title := 'Overtime Rejected';
        v_message := format('Your overtime request for %s hours on %s has been rejected.',
          NEW.hours,
          TO_CHAR(NEW.date, 'Mon DD, YYYY')
        );

        IF NEW.rejection_reason IS NOT NULL THEN
          v_message := v_message || ' Reason: ' || NEW.rejection_reason;
        END IF;
      END IF;

      PERFORM create_notification(
        v_employee.organization_id,
        v_employee.user_id,
        'overtime_' || NEW.status,
        v_title,
        v_message,
        jsonb_build_object('overtime_id', NEW.id, 'hours', NEW.hours, 'date', NEW.date)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_roster_week_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee RECORD;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'published'
     AND OLD.published_at IS NOT DISTINCT FROM NEW.published_at THEN
    RETURN NEW;
  END IF;

  FOR v_employee IN
    SELECT DISTINCT e.id AS employee_id, e.user_id::UUID AS user_id
    FROM roster_assignments ra
    JOIN employees e ON e.id = ra.employee_id
    WHERE ra.organization_id = NEW.organization_id
      AND ra.date >= NEW.week_start
      AND ra.date < NEW.week_start + 7
      AND e.organization_id = NEW.organization_id
      AND e.user_id IS NOT NULL
      AND COALESCE(e.employment_status, 'active') = 'active'
  LOOP
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_employee.user_id,
        'roster_published',
        'Roster Published',
        'Your roster for the week starting ' || to_char(NEW.week_start, 'Mon DD, YYYY') || ' has been published.',
        jsonb_build_object(
          'week_start', NEW.week_start,
          'employee_id', v_employee.employee_id,
          'roster_week_status_id', NEW.id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_roster_week_published failed for employee %: %', v_employee.employee_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_shift_swap_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requester_user_id UUID;
  v_target_user_id UUID;
  v_status_title TEXT;
  v_status_message TEXT;
BEGIN
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT e.user_id::UUID INTO v_requester_user_id
  FROM employees e
  WHERE e.id = NEW.requester_employee_id
    AND e.organization_id = NEW.organization_id
    AND e.user_id IS NOT NULL;

  IF NEW.target_employee_id IS NOT NULL THEN
    SELECT e.user_id::UUID INTO v_target_user_id
    FROM employees e
    WHERE e.id = NEW.target_employee_id
      AND e.organization_id = NEW.organization_id
      AND e.user_id IS NOT NULL;
  END IF;

  v_status_title := CASE WHEN NEW.status = 'approved' THEN 'Shift Swap Approved' ELSE 'Shift Swap Rejected' END;
  v_status_message := CASE
    WHEN NEW.status = 'approved' THEN 'Your shift swap request has been approved.'
    WHEN COALESCE(NEW.rejection_reason, '') <> '' THEN 'Your shift swap request was rejected: ' || NEW.rejection_reason
    ELSE 'Your shift swap request has been rejected.'
  END;

  IF v_requester_user_id IS NOT NULL THEN
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_requester_user_id,
        CASE WHEN NEW.status = 'approved' THEN 'shift_swap_approved' ELSE 'shift_swap_rejected' END,
        v_status_title,
        v_status_message,
        jsonb_build_object(
          'swap_id', NEW.id,
          'requester_employee_id', NEW.requester_employee_id,
          'target_employee_id', NEW.target_employee_id,
          'requester_date', NEW.requester_date,
          'target_date', NEW.target_date,
          'status', NEW.status,
          'rejection_reason', NEW.rejection_reason
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_shift_swap_decision failed for requester %: %', NEW.requester_employee_id, SQLERRM;
    END;
  END IF;

  IF NEW.status = 'approved' AND v_target_user_id IS NOT NULL AND v_target_user_id IS DISTINCT FROM v_requester_user_id THEN
    BEGIN
      PERFORM create_notification(
        NEW.organization_id,
        v_target_user_id,
        'shift_swap_approved',
        'Shift Swap Approved',
        'A shift swap you are part of has been approved.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'requester_employee_id', NEW.requester_employee_id,
          'target_employee_id', NEW.target_employee_id,
          'requester_date', NEW.requester_date,
          'target_date', NEW.target_date,
          'status', NEW.status
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_shift_swap_decision failed for target %: %', NEW.target_employee_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_suspicious_clock_event()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_admin RECORD;
  v_employee RECORD;
  v_message TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.admin_review_status = 'flagged') OR
     (TG_OP = 'UPDATE' AND NEW.admin_review_status = 'flagged' AND OLD.admin_review_status != 'flagged') THEN

    SELECT e.id, e.first_name, e.last_name, e.organization_id
    INTO v_employee
    FROM employees e
    WHERE e.id = NEW.employee_id;

    v_message := format('%s %s''s %s at %s has been flagged for review.',
      v_employee.first_name,
      v_employee.last_name,
      CASE WHEN NEW.event_type = 'clock_in' THEN 'clock-in' ELSE 'clock-out' END,
      TO_CHAR(NEW.timestamp, 'HH:MI AM on Mon DD')
    );

    IF NEW.suspicious_flags IS NOT NULL AND array_length(NEW.suspicious_flags, 1) > 0 THEN
      v_message := v_message || ' Flags: ' || array_to_string(NEW.suspicious_flags, ', ');
    END IF;

    FOR v_admin IN
      SELECT DISTINCT u.id as user_id
      FROM employees e
      JOIN users u ON u.id = e.user_id
      WHERE e.organization_id = v_employee.organization_id
        AND u.role IN ('owner', 'super_admin', 'manager', 'hr_admin')
        AND e.employment_status = 'active'
    LOOP
      PERFORM create_notification(
        v_employee.organization_id,
        v_admin.user_id,
        'clock_flagged',
        'Suspicious Clock Event',
        v_message,
        jsonb_build_object('event_id', NEW.id, 'employee_id', NEW.employee_id, 'flags', NEW.suspicious_flags)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.org_chart_extract_uuid(p_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_value IS NULL OR lower(p_value) = 'null' OR p_value = '' THEN
    RETURN NULL;
  END IF;

  IF p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN p_value::UUID;
  END IF;

  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.org_chart_history_uuid_value(p_details jsonb, p_new_key text, p_old_key text, p_direction text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_value TEXT;
BEGIN
  IF p_direction = 'old' THEN
    v_value := COALESCE(
      p_details ->> p_old_key,
      CASE WHEN p_details ->> 'field' = p_new_key THEN p_details ->> 'old_value' END
    );
  ELSE
    v_value := COALESCE(
      p_details ->> p_new_key,
      CASE WHEN p_details ->> 'field' = p_new_key THEN p_details ->> 'new_value' END
    );
  END IF;

  RETURN org_chart_extract_uuid(v_value);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_department_parent_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_org_id UUID;
  v_cycle_found BOOLEAN;
  v_cross_org_child_found BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM departments child
    WHERE child.parent_department_id = NEW.id
      AND child.organization_id IS DISTINCT FROM NEW.organization_id
  )
  INTO v_cross_org_child_found;

  IF COALESCE(v_cross_org_child_found, false) THEN
    RAISE EXCEPTION 'Department with child departments cannot move to a different organization';
  END IF;

  IF NEW.parent_department_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.parent_department_id = NEW.id THEN
    RAISE EXCEPTION 'Department cannot be its own parent';
  END IF;

  SELECT organization_id
  INTO v_parent_org_id
  FROM departments
  WHERE id = NEW.parent_department_id;

  IF v_parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Parent department % does not exist', NEW.parent_department_id;
  END IF;

  IF v_parent_org_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Parent department must belong to the same organization';
  END IF;

  WITH RECURSIVE department_chain(id, parent_department_id, organization_id, path) AS (
    SELECT d.id, d.parent_department_id, d.organization_id, ARRAY[d.id]
    FROM departments d
    WHERE d.id = NEW.parent_department_id
      AND d.organization_id = NEW.organization_id

    UNION ALL

    SELECT parent.id, parent.parent_department_id, parent.organization_id, dc.path || parent.id
    FROM departments parent
    JOIN department_chain dc ON parent.id = dc.parent_department_id
    WHERE parent.organization_id = NEW.organization_id
      AND parent.id <> ALL(dc.path)
  )
  SELECT EXISTS (
    SELECT 1
    FROM department_chain
    WHERE id = NEW.id
  )
  INTO v_cycle_found;

  IF COALESCE(v_cycle_found, false) THEN
    RAISE EXCEPTION 'Department hierarchy cannot contain cycles';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_employee_manager_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager_org_id UUID;
  v_cycle_found BOOLEAN;
  v_cross_org_report_found BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM employees report
    WHERE report.manager_id = NEW.id
      AND report.organization_id IS DISTINCT FROM NEW.organization_id
  )
  INTO v_cross_org_report_found;

  IF COALESCE(v_cross_org_report_found, false) THEN
    RAISE EXCEPTION 'Employee with direct reports cannot move to a different organization';
  END IF;

  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'Employee cannot report to themselves';
  END IF;

  SELECT organization_id
  INTO v_manager_org_id
  FROM employees
  WHERE id = NEW.manager_id;

  IF v_manager_org_id IS NULL THEN
    RAISE EXCEPTION 'Manager % does not exist', NEW.manager_id;
  END IF;

  IF v_manager_org_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Manager must belong to the same organization';
  END IF;

  WITH RECURSIVE manager_chain(id, manager_id, organization_id, path) AS (
    SELECT e.id, e.manager_id, e.organization_id, ARRAY[e.id]
    FROM employees e
    WHERE e.id = NEW.manager_id
      AND e.organization_id = NEW.organization_id

    UNION ALL

    SELECT parent.id, parent.manager_id, parent.organization_id, mc.path || parent.id
    FROM employees parent
    JOIN manager_chain mc ON parent.id = mc.manager_id
    WHERE parent.organization_id = NEW.organization_id
      AND parent.id <> ALL(mc.path)
  )
  SELECT EXISTS (
    SELECT 1
    FROM manager_chain
    WHERE id = NEW.id
  )
  INTO v_cycle_found;

  IF COALESCE(v_cycle_found, false) THEN
    RAISE EXCEPTION 'Employee manager hierarchy cannot contain cycles';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_employee_matrix_report_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_org_id UUID;
  v_manager_org_id UUID;
  v_cycle_found BOOLEAN;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  NEW.relationship_type := COALESCE(NULLIF(btrim(NEW.relationship_type), ''), 'project');

  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required' USING ERRCODE = '22023';
  END IF;

  IF NEW.matrix_manager_id IS NULL THEN
    RAISE EXCEPTION 'matrix_manager_id is required' USING ERRCODE = '22023';
  END IF;

  IF NEW.employee_id = NEW.matrix_manager_id THEN
    RAISE EXCEPTION 'Employee cannot matrix-report to themselves' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id
  INTO v_employee_org_id
  FROM employees
  WHERE id = NEW.employee_id;

  IF v_employee_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee % does not exist', NEW.employee_id USING ERRCODE = '22023';
  END IF;

  SELECT organization_id
  INTO v_manager_org_id
  FROM employees
  WHERE id = NEW.matrix_manager_id;

  IF v_manager_org_id IS NULL THEN
    RAISE EXCEPTION 'Matrix manager % does not exist', NEW.matrix_manager_id USING ERRCODE = '22023';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_employee_org_id
     OR NEW.organization_id IS DISTINCT FROM v_manager_org_id THEN
    RAISE EXCEPTION 'Matrix report employees must belong to the same organization' USING ERRCODE = '22023';
  END IF;

  WITH RECURSIVE matrix_chain(id, matrix_manager_id, path_ids) AS (
    SELECT
      report.employee_id,
      report.matrix_manager_id,
      ARRAY[report.employee_id]::UUID[]
    FROM employee_matrix_reports report
    WHERE report.employee_id = NEW.matrix_manager_id
      AND report.organization_id = NEW.organization_id
      AND report.id IS DISTINCT FROM NEW.id

    UNION ALL

    SELECT
      parent.employee_id,
      parent.matrix_manager_id,
      mc.path_ids || parent.employee_id
    FROM employee_matrix_reports parent
    JOIN matrix_chain mc ON parent.employee_id = mc.matrix_manager_id
    WHERE parent.organization_id = NEW.organization_id
      AND parent.id IS DISTINCT FROM NEW.id
      AND parent.employee_id <> ALL(mc.path_ids)
  )
  SELECT EXISTS (
    SELECT 1
    FROM matrix_chain
    WHERE matrix_manager_id = NEW.employee_id
  )
  INTO v_cycle_found;

  IF COALESCE(v_cycle_found, false) THEN
    RAISE EXCEPTION 'Employee matrix reporting graph cannot contain cycles' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_audit_event(p_organization_id uuid DEFAULT NULL::uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_target_user_id uuid DEFAULT NULL::uuid, p_target_employee_id uuid DEFAULT NULL::uuid, p_module text DEFAULT 'system'::text, p_action text DEFAULT 'updated'::text, p_severity text DEFAULT 'info'::text, p_entity_type text DEFAULT 'system'::text, p_entity_id uuid DEFAULT NULL::uuid, p_entity_label text DEFAULT NULL::text, p_old_value jsonb DEFAULT '{}'::jsonb, p_new_value jsonb DEFAULT '{}'::jsonb, p_changed_fields jsonb DEFAULT '[]'::jsonb, p_metadata jsonb DEFAULT '{}'::jsonb, p_source text DEFAULT 'app'::text, p_request_id text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_actor_user_id UUID;
  v_actor_employee_id UUID;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_target_name TEXT;
  v_audit_id UUID;
  v_module TEXT;
  v_action TEXT;
  v_severity TEXT;
  v_source TEXT;
  v_capture_context BOOLEAN;
BEGIN
  v_actor_user_id := COALESCE(p_actor_user_id, current_setting('touchorbit.current_user_id', true)::uuid);
  v_org_id := COALESCE(p_organization_id, get_my_org_id());

  IF current_setting('touchorbit.current_user_id', true)::uuid IS NOT NULL
     AND p_actor_user_id IS NOT NULL
     AND p_actor_user_id IS DISTINCT FROM current_setting('touchorbit.current_user_id', true)::uuid
     AND NOT has_permission('audit.manage_retention') THEN
    RAISE EXCEPTION 'Cannot write audit event for another actor' USING ERRCODE = '42501';
  END IF;

  IF v_org_id IS NULL AND v_actor_user_id IS NOT NULL THEN
    SELECT u.organization_id
    INTO v_org_id
    FROM users u
    WHERE u.id = v_actor_user_id;
  END IF;

  IF v_org_id IS NULL AND p_target_employee_id IS NOT NULL THEN
    SELECT e.organization_id
    INTO v_org_id
    FROM employees e
    WHERE e.id = p_target_employee_id;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required for audit event' USING ERRCODE = '22023';
  END IF;

  IF current_setting('touchorbit.current_user_id', true)::uuid IS NOT NULL AND get_my_org_id() IS DISTINCT FROM v_org_id THEN
    RAISE EXCEPTION 'Cannot write audit event outside caller organization' USING ERRCODE = '42501';
  END IF;

  v_module := lower(NULLIF(trim(COALESCE(p_module, 'system')), ''));
  v_action := lower(NULLIF(trim(COALESCE(p_action, 'updated')), ''));
  v_severity := lower(NULLIF(trim(COALESCE(p_severity, 'info')), ''));
  v_source := lower(NULLIF(trim(COALESCE(p_source, 'app')), ''));

  IF v_module IS NULL THEN
    v_module := 'system';
  END IF;

  IF v_action IS NULL THEN
    v_action := 'updated';
  END IF;

  IF v_severity NOT IN ('info', 'notice', 'sensitive', 'critical') THEN
    v_severity := 'info';
  END IF;

  IF v_source NOT IN ('admin_app', 'employee_app', 'api', 'rpc', 'trigger', 'system_job', 'import', 'app') THEN
    v_source := 'app';
  END IF;

  INSERT INTO audit_policy_settings (organization_id)
  VALUES (v_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  IF NOT audit_policy_allows_event(v_org_id, v_module, v_action, v_severity, COALESCE(NULLIF(trim(p_entity_type), ''), 'system')) THEN
    RETURN NULL;
  END IF;

  v_capture_context := audit_policy_capture_request_context(
    v_org_id,
    v_module,
    v_action,
    v_severity,
    COALESCE(NULLIF(trim(p_entity_type), ''), 'system')
  );

  SELECT
    u.email,
    COALESCE(NULLIF(concat_ws(' ', u.first_name, u.last_name), ''), u.email, 'System'),
    e.id
  INTO v_actor_email, v_actor_name, v_actor_employee_id
  FROM users u
  LEFT JOIN employees e
    ON e.user_id = u.id
   AND e.organization_id = u.organization_id
  WHERE u.id = v_actor_user_id
    AND u.organization_id = v_org_id
  LIMIT 1;

  IF p_target_employee_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(concat_ws(' ', e.first_name, e.last_name), ''), e.email, e.employee_number, e.id::TEXT)
    INTO v_target_name
    FROM employees e
    WHERE e.id = p_target_employee_id
      AND e.organization_id = v_org_id;
  ELSIF p_target_user_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(concat_ws(' ', u.first_name, u.last_name), ''), u.email, u.id::TEXT)
    INTO v_target_name
    FROM users u
    WHERE u.id = p_target_user_id
      AND u.organization_id = v_org_id;
  END IF;

  INSERT INTO audit_events (
    organization_id,
    actor_user_id,
    actor_employee_id,
    actor_name_snapshot,
    actor_email_snapshot,
    target_user_id,
    target_employee_id,
    target_name_snapshot,
    module,
    action,
    severity,
    entity_type,
    entity_id,
    entity_label,
    old_value,
    new_value,
    changed_fields,
    metadata,
    source,
    request_id,
    ip_address,
    user_agent
  )
  VALUES (
    v_org_id,
    v_actor_user_id,
    v_actor_employee_id,
    v_actor_name,
    v_actor_email,
    p_target_user_id,
    p_target_employee_id,
    v_target_name,
    v_module,
    v_action,
    v_severity,
    COALESCE(NULLIF(trim(p_entity_type), ''), 'system'),
    p_entity_id,
    p_entity_label,
    COALESCE(p_old_value, '{}'::JSONB),
    COALESCE(p_new_value, '{}'::JSONB),
    COALESCE(p_changed_fields, '[]'::JSONB),
    COALESCE(p_metadata, '{}'::JSONB),
    v_source,
    p_request_id,
    CASE WHEN v_capture_context THEN p_ip_address ELSE NULL END,
    CASE WHEN v_capture_context THEN p_user_agent ELSE NULL END
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_org_chart_presence_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.event_type NOT IN ('clock_in', 'clock_out') THEN
    RETURN NEW;
  END IF;

  INSERT INTO org_chart_presence_events (
    organization_id,
    employee_id,
    clock_event_id,
    event_type,
    occurred_at
  )
  VALUES (
    NEW.organization_id,
    NEW.employee_id,
    NEW.id,
    NEW.event_type,
    NEW.timestamp
  )
  ON CONFLICT (clock_event_id) DO UPDATE
  SET organization_id = EXCLUDED.organization_id,
      employee_id = EXCLUDED.employee_id,
      event_type = EXCLUDED.event_type,
      occurred_at = EXCLUDED.occurred_at;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reject_shift_swap(p_swap_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_swap shift_swap_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_swap
  FROM shift_swap_requests
  WHERE id = p_swap_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift swap not found';
  END IF;

  IF v_swap.status NOT IN ('pending', 'claimed') THEN
    RAISE EXCEPTION 'Request is already processed';
  END IF;

  IF NOT has_permission_for_employee('roster.approve_swap', v_swap.requester_employee_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE shift_swap_requests
  SET status = 'rejected',
      reviewed_by = current_setting('touchorbit.current_user_id', true)::uuid,
      reviewed_at = now(),
      rejection_reason = p_reason
  WHERE id = p_swap_id;

  RETURN 'rejected';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.request_shift_swap(p_requester_id uuid, p_requester_date date, p_target_id uuid DEFAULT NULL::uuid, p_target_date date DEFAULT NULL::date, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_swap_id UUID;
  v_requester_user UUID;
BEGIN
  v_org_id := get_my_org_id();

  SELECT user_id INTO v_requester_user
  FROM employees
  WHERE id = p_requester_id
    AND organization_id = v_org_id;

  IF v_requester_user IS NULL THEN
    RAISE EXCEPTION 'Requester not found';
  END IF;

  IF current_setting('touchorbit.current_user_id', true)::uuid IS DISTINCT FROM v_requester_user AND NOT has_permission_for_employee('roster.edit', p_requester_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM roster_assignments
    WHERE organization_id = v_org_id
      AND employee_id = p_requester_id
      AND date = p_requester_date
  ) THEN
    RAISE EXCEPTION 'Requester has no shift on the requested date';
  END IF;

  IF p_target_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = p_target_id
      AND organization_id = v_org_id
      AND termination_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Target employee not found';
  END IF;

  INSERT INTO shift_swap_requests (
    organization_id,
    requester_employee_id,
    target_employee_id,
    requester_date,
    target_date,
    status,
    reason
  )
  VALUES (
    v_org_id,
    p_requester_id,
    p_target_id,
    p_requester_date,
    p_target_date,
    'pending',
    p_reason
  )
  RETURNING id INTO v_swap_id;

  RETURN v_swap_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.review_clock_event(p_event_id uuid, p_status text, p_reviewed_by text, p_notes text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event clock_events%ROWTYPE;
  v_rows_updated INTEGER;
BEGIN
  IF current_setting('touchorbit.current_user_id', true)::uuid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_event FROM clock_events WHERE id = p_event_id;

  IF NOT FOUND OR v_event.organization_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Clock event not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_permission_for_employee('attendance.review_spoofing', v_event.employee_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE clock_events
  SET admin_review_status = p_status,
      reviewed_by = current_setting('touchorbit.current_user_id', true)::uuid,
      reviewed_at = now(),
      review_notes = p_notes
  WHERE id = p_event_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  INSERT INTO security_audit_log (organization_id, actor_user_id, target_employee_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_event.organization_id,
    current_setting('touchorbit.current_user_id', true)::uuid,
    v_event.employee_id,
    'attendance.review_spoofing',
    'clock_event',
    p_event_id,
    jsonb_build_object('admin_review_status', v_event.admin_review_status),
    jsonb_build_object('admin_review_status', p_status, 'notes', p_notes)
  );

  RETURN v_rows_updated;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.route_expense_claim(p_claim_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim          expense_claims%ROWTYPE;
  v_config         expense_approval_config%ROWTYPE;
  v_emp            employees%ROWTYPE;
  v_dept_mgr_uid   UUID;
  v_branch_mgr_uid UUID;
  v_new_status     TEXT;
  v_needs_level1   BOOLEAN := false;
  v_needs_level2   BOOLEAN := false;
  v_needs_level3   BOOLEAN := false;
BEGIN
  SELECT * INTO v_claim FROM expense_claims WHERE id = p_claim_id;
  SELECT * INTO v_config FROM expense_approval_config WHERE organization_id = v_claim.organization_id;
  SELECT * INTO v_emp FROM employees WHERE id = v_claim.employee_id;

  -- Default: require manager + HR for every claim when no config set
  IF NOT FOUND THEN
    v_config.auto_approve_below := 0;
    v_config.level1_min_amount  := 0;
    v_config.level2_min_amount  := 0;
    v_config.level3_min_amount  := 999999999;
    v_config.parallel_approval  := false;
    v_config.skip_if_no_manager := true;
  END IF;

  -- Auto-approve: only fires when explicitly configured above 0
  IF v_config.auto_approve_below > 0 AND v_claim.amount <= v_config.auto_approve_below THEN
    UPDATE expense_claims SET status = 'awaiting_finance' WHERE id = p_claim_id;
    RETURN 'awaiting_finance';
  END IF;

  -- Determine levels needed (threshold = 0 means ALL claims hit that level)
  v_needs_level1 := v_claim.amount >= COALESCE(v_config.level1_min_amount, 0);
  v_needs_level2 := v_claim.amount >= COALESCE(v_config.level2_min_amount, 0);
  v_needs_level3 := v_claim.amount >= COALESCE(v_config.level3_min_amount, 999999999);

  -- Resolve level1 approver (dept manager → branch manager fallback)
  IF v_needs_level1 THEN
    SELECT e2.user_id INTO v_dept_mgr_uid
    FROM departments d JOIN employees e2 ON e2.id = d.manager_employee_id
    WHERE d.id = v_emp.department_id LIMIT 1;

    IF v_dept_mgr_uid IS NULL THEN
      SELECT e2.user_id INTO v_branch_mgr_uid
      FROM branches b JOIN employees e2 ON e2.id = b.manager_employee_id
      WHERE b.id = v_emp.branch_id LIMIT 1;
    END IF;

    IF v_dept_mgr_uid IS NULL AND v_branch_mgr_uid IS NULL AND v_config.skip_if_no_manager THEN
      v_needs_level1 := false;
    ELSE
      INSERT INTO expense_claim_approvals (claim_id, level, approver_role, approver_user_id)
      VALUES (p_claim_id, 1,
        CASE WHEN v_dept_mgr_uid IS NOT NULL THEN 'dept_manager' ELSE 'branch_manager' END,
        COALESCE(v_dept_mgr_uid, v_branch_mgr_uid));
    END IF;
  END IF;

  IF v_needs_level2 THEN
    INSERT INTO expense_claim_approvals (claim_id, level, approver_role)
    VALUES (p_claim_id, 2, 'hr_admin');
  END IF;

  IF v_needs_level3 THEN
    INSERT INTO expense_claim_approvals (claim_id, level, approver_role)
    VALUES (p_claim_id, 3, 'owner');
  END IF;

  IF v_needs_level1 THEN
    v_new_status := 'awaiting_level1';
  ELSIF v_needs_level2 THEN
    v_new_status := 'awaiting_level2';
  ELSIF v_needs_level3 THEN
    v_new_status := 'awaiting_level3';
  ELSE
    v_new_status := 'awaiting_finance';
  END IF;

  UPDATE expense_claims SET status = v_new_status WHERE id = p_claim_id;
  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.route_leave_request(p_request_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request        leave_records%ROWTYPE;
  v_config         leave_approval_config%ROWTYPE;
  v_emp            employees%ROWTYPE;
  v_dept_mgr_uid   UUID;
  v_branch_mgr_uid UUID;
  v_new_status     TEXT;
  v_needs_level1   BOOLEAN := false;
  v_needs_level2   BOOLEAN := false;
  v_needs_level3   BOOLEAN := false;
BEGIN
  SELECT * INTO v_request FROM leave_records WHERE id = p_request_id;
  SELECT * INTO v_config FROM leave_approval_config WHERE organization_id = v_request.organization_id;
  SELECT * INTO v_emp FROM employees WHERE id = v_request.employee_id;

  -- Default: require manager + HR for every leave when no config set
  IF NOT FOUND THEN
    v_config.auto_approve_below_days := 0;
    v_config.level1_min_days         := 0;
    v_config.level2_min_days         := 0;
    v_config.level3_min_days         := 999;
    v_config.parallel_approval       := false;
    v_config.skip_if_no_manager      := true;
  END IF;

  -- Auto-approve only if configured above 0
  IF v_config.auto_approve_below_days > 0 AND v_request.days_count <= v_config.auto_approve_below_days THEN
    UPDATE leave_records SET status = 'approved', approved_at = now() WHERE id = p_request_id;
    RETURN 'approved';
  END IF;

  -- Determine levels needed (threshold = 0 means ALL leaves hit that level)
  v_needs_level1 := v_request.days_count >= COALESCE(v_config.level1_min_days, 0);
  v_needs_level2 := v_request.days_count >= COALESCE(v_config.level2_min_days, 0);
  v_needs_level3 := v_request.days_count >= COALESCE(v_config.level3_min_days, 999);

  -- Resolve level1 approver (dept manager → branch manager fallback)
  IF v_needs_level1 THEN
    SELECT e2.user_id INTO v_dept_mgr_uid
    FROM departments d JOIN employees e2 ON e2.id = d.manager_employee_id
    WHERE d.id = v_emp.department_id LIMIT 1;

    IF v_dept_mgr_uid IS NULL THEN
      SELECT e2.user_id INTO v_branch_mgr_uid
      FROM branches b JOIN employees e2 ON e2.id = b.manager_employee_id
      WHERE b.id = v_emp.branch_id LIMIT 1;
    END IF;

    IF v_dept_mgr_uid IS NULL AND v_branch_mgr_uid IS NULL AND v_config.skip_if_no_manager THEN
      v_needs_level1 := false;
    ELSE
      INSERT INTO leave_request_approvals (request_id, level, approver_role, approver_user_id)
      VALUES (p_request_id, 1,
        CASE WHEN v_dept_mgr_uid IS NOT NULL THEN 'dept_manager' ELSE 'branch_manager' END,
        COALESCE(v_dept_mgr_uid, v_branch_mgr_uid));
    END IF;
  END IF;

  IF v_needs_level2 THEN
    INSERT INTO leave_request_approvals (request_id, level, approver_role)
    VALUES (p_request_id, 2, 'hr_admin');
  END IF;

  IF v_needs_level3 THEN
    INSERT INTO leave_request_approvals (request_id, level, approver_role)
    VALUES (p_request_id, 3, 'owner');
  END IF;

  IF v_needs_level1 THEN
    v_new_status := 'awaiting_level1';
  ELSIF v_needs_level2 THEN
    v_new_status := 'awaiting_level2';
  ELSIF v_needs_level3 THEN
    v_new_status := 'awaiting_level3';
  ELSE
    v_new_status := 'approved';
    UPDATE leave_records SET approved_at = now() WHERE id = p_request_id;
  END IF;

  UPDATE leave_records SET status = v_new_status WHERE id = p_request_id;
  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.route_overtime_record(p_record_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_record         overtime_records%ROWTYPE;
  v_config         overtime_approval_config%ROWTYPE;
  v_emp            employees%ROWTYPE;
  v_dept_mgr_uid   UUID;
  v_branch_mgr_uid UUID;
  v_new_status     TEXT;
  v_needs_level1   BOOLEAN := false;
  v_needs_level2   BOOLEAN := false;
  v_needs_level3   BOOLEAN := false;
BEGIN
  SELECT * INTO v_record FROM overtime_records WHERE id = p_record_id;
  SELECT * INTO v_config FROM overtime_approval_config WHERE organization_id = v_record.organization_id;
  SELECT * INTO v_emp FROM employees WHERE id = v_record.employee_id;

  -- Default: require manager + HR for every overtime when no config set
  IF NOT FOUND THEN
    v_config.auto_approve_below_hours := 0;
    v_config.level1_min_hours         := 0;
    v_config.level2_min_hours         := 0;
    v_config.level3_min_hours         := 999;
    v_config.parallel_approval        := false;
    v_config.skip_if_no_manager       := true;
  END IF;

  -- Auto-approve only if configured above 0
  IF v_config.auto_approve_below_hours > 0 AND v_record.hours <= v_config.auto_approve_below_hours THEN
    UPDATE overtime_records SET status = 'approved', approved_at = now() WHERE id = p_record_id;
    RETURN 'approved';
  END IF;

  -- Determine levels needed
  v_needs_level1 := v_record.hours >= COALESCE(v_config.level1_min_hours, 0);
  v_needs_level2 := v_record.hours >= COALESCE(v_config.level2_min_hours, 0);
  v_needs_level3 := v_record.hours >= COALESCE(v_config.level3_min_hours, 999);

  IF v_needs_level1 THEN
    SELECT e2.user_id INTO v_dept_mgr_uid
    FROM departments d JOIN employees e2 ON e2.id = d.manager_employee_id
    WHERE d.id = v_emp.department_id LIMIT 1;

    IF v_dept_mgr_uid IS NULL THEN
      SELECT e2.user_id INTO v_branch_mgr_uid
      FROM branches b JOIN employees e2 ON e2.id = b.manager_employee_id
      WHERE b.id = v_emp.branch_id LIMIT 1;
    END IF;

    IF v_dept_mgr_uid IS NULL AND v_branch_mgr_uid IS NULL AND v_config.skip_if_no_manager THEN
      v_needs_level1 := false;
    ELSE
      INSERT INTO overtime_request_approvals (record_id, level, approver_role, approver_user_id)
      VALUES (p_record_id, 1,
        CASE WHEN v_dept_mgr_uid IS NOT NULL THEN 'dept_manager' ELSE 'branch_manager' END,
        COALESCE(v_dept_mgr_uid, v_branch_mgr_uid));
    END IF;
  END IF;

  IF v_needs_level2 THEN
    INSERT INTO overtime_request_approvals (record_id, level, approver_role)
    VALUES (p_record_id, 2, 'hr_admin');
  END IF;

  IF v_needs_level3 THEN
    INSERT INTO overtime_request_approvals (record_id, level, approver_role)
    VALUES (p_record_id, 3, 'owner');
  END IF;

  IF v_needs_level1 THEN
    v_new_status := 'awaiting_level1';
  ELSIF v_needs_level2 THEN
    v_new_status := 'awaiting_level2';
  ELSIF v_needs_level3 THEN
    v_new_status := 'awaiting_level3';
  ELSE
    v_new_status := 'approved';
    UPDATE overtime_records SET approved_at = now() WHERE id = p_record_id;
  END IF;

  UPDATE overtime_records SET status = v_new_status WHERE id = p_record_id;
  RETURN v_new_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.seed_sri_lankan_holidays(p_org_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
BEGIN
  IF p_org_id IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'Not authorized to seed holidays for this organization';
  END IF;

  WITH holiday_seed(name, holiday_date, holiday_type, recurring, description) AS (
  VALUES
    ('Duruthu Full Moon Poya Day', '2026-01-03'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2026-01-15'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Navam Full Moon Poya Day', '2026-02-01'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2026-02-04'::DATE, 'public', false, 'National Day'),
    ('Mahasivarathri Day', '2026-02-15'::DATE, 'public', false, 'Hindu festival'),
    ('Madin Full Moon Poya Day', '2026-03-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Id Ul-Fitr', '2026-03-21'::DATE, 'public', false, 'Islamic holiday'),
    ('Bak Full Moon Poya Day', '2026-04-01'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Good Friday', '2026-04-03'::DATE, 'public', false, 'Christian holiday'),
    ('Day prior to Sinhala & Tamil New Year Day', '2026-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2026-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2026-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2026-05-01'::DATE, 'poya', false, 'Buddhist festival'),
    ('Day following Vesak Full Moon Poya Day', '2026-05-02'::DATE, 'public', false, 'Buddhist festival'),
    ('Id Ul-Alha', '2026-05-28'::DATE, 'public', false, 'Islamic holiday'),
    ('Adhi Poson Full Moon Poya Day', '2026-05-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2026-06-29'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2026-07-29'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Milad un-Nabi', '2026-08-26'::DATE, 'public', false, 'Islamic holiday'),
    ('Nikini Full Moon Poya Day', '2026-08-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2026-09-26'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2026-10-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Deepavali', '2026-11-08'::DATE, 'public', false, 'Hindu festival'),
    ('Ill Full Moon Poya Day', '2026-11-24'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2026-12-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2026-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Tamil Thai Pongal Day', '2027-01-15'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2027-01-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2027-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2027-02-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Mahasivarathri Day', '2027-03-06'::DATE, 'public', false, 'Hindu festival'),
    ('Id Ul-Fitr', '2027-03-10'::DATE, 'public', false, 'Islamic holiday'),
    ('Madin Full Moon Poya Day', '2027-03-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Good Friday', '2027-03-26'::DATE, 'public', false, 'Christian holiday'),
    ('Day prior to Sinhala & Tamil New Year Day', '2027-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2027-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2027-04-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2027-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Id Ul-Alha', '2027-05-17'::DATE, 'public', false, 'Islamic holiday'),
    ('Vesak Full Moon Poya Day', '2027-05-20'::DATE, 'poya', false, 'Buddhist festival'),
    ('Day following Vesak Full Moon Poya Day', '2027-05-21'::DATE, 'public', false, 'Buddhist festival'),
    ('Poson Full Moon Poya Day', '2027-06-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2027-07-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Milad un-Nabi', '2027-08-15'::DATE, 'public', false, 'Islamic holiday'),
    ('Nikini Full Moon Poya Day', '2027-08-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2027-09-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2027-10-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Deepavali', '2027-10-28'::DATE, 'public', false, 'Hindu festival'),
    ('Ill Full Moon Poya Day', '2027-11-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2027-12-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2027-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2028-01-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2028-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('National Day', '2028-02-04'::DATE, 'public', false, 'National Day'),
    ('Mahasivarathri Day', '2028-02-23'::DATE, 'public', false, 'Hindu festival'),
    ('Navam Full Moon Poya Day', '2028-02-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Id Ul-Fitr', '2028-02-26'::DATE, 'public', false, 'Islamic holiday'),
    ('Madin Full Moon Poya Day', '2028-03-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2028-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Good Friday', '2028-04-14'::DATE, 'public', false, 'Christian holiday'),
    ('Sinhala & Tamil New Year Day', '2028-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2028-04-24'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2028-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Id Ul-Alha', '2028-05-05'::DATE, 'public', false, 'Islamic holiday'),
    ('Vesak Full Moon Poya Day', '2028-05-23'::DATE, 'poya', false, 'Buddhist festival'),
    ('Day following Vesak Full Moon Poya Day', '2028-05-24'::DATE, 'public', false, 'Buddhist festival'),
    ('Poson Full Moon Poya Day', '2028-06-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2028-07-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Milad un-Nabi', '2028-08-03'::DATE, 'public', false, 'Islamic holiday'),
    ('Nikini Full Moon Poya Day', '2028-08-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2028-09-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Deepavali', '2028-10-17'::DATE, 'public', false, 'Hindu festival'),
    ('Vap Full Moon Poya Day', '2028-10-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2028-11-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2028-12-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2028-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Tamil Thai Pongal Day', '2029-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2029-01-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2029-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2029-02-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2029-03-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2029-04-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2029-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2029-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2029-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2029-05-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2029-06-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2029-07-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2029-08-10'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2029-09-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2029-10-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2029-11-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2029-12-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2029-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2030-01-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2030-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Navam Full Moon Poya Day', '2030-02-03'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2030-02-04'::DATE, 'public', false, 'National Day'),
    ('Madin Full Moon Poya Day', '2030-03-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2030-04-03'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2030-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2030-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2030-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2030-05-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2030-06-01'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Adhi Poson Full Moon Poya Day', '2030-06-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2030-07-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2030-08-28'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2030-09-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2030-10-26'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2030-11-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2030-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Unduvap Full Moon Poya Day', '2030-12-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2031-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2031-01-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2031-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2031-02-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2031-03-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2031-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2031-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2031-04-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2031-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2031-05-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2031-06-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2031-07-19'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2031-08-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2031-09-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2031-10-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2031-11-14'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2031-12-14'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2031-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2032-01-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2032-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('National Day', '2032-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2032-02-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2032-03-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2032-04-10'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2032-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2032-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2032-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2032-05-10'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2032-06-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2032-07-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2032-08-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2032-09-05'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2032-10-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2032-11-03'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2032-12-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2032-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Tamil Thai Pongal Day', '2033-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2033-01-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2033-02-04'::DATE, 'public', false, 'National Day'),
    ('Madin Full Moon Poya Day', '2033-03-01'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Adhi Madin Full Moon Poya Day', '2033-03-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2033-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2033-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2033-04-29'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2033-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2033-05-28'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2033-06-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2033-07-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2033-08-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2033-09-24'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2033-10-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2033-11-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2033-12-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2033-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Tamil Thai Pongal Day', '2034-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2034-01-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2034-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2034-02-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2034-03-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2034-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2034-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2034-04-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2034-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2034-05-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2034-06-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2034-07-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2034-08-14'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2034-09-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2034-10-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2034-11-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2034-12-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2034-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2035-01-09'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2035-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('National Day', '2035-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2035-02-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2035-03-09'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2035-04-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2035-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2035-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2035-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2035-05-07'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2035-06-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2035-07-05'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2035-08-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2035-09-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2035-10-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Adhi Vap Full Moon Poya Day', '2035-10-31'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2035-11-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2035-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Unduvap Full Moon Poya Day', '2035-12-29'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2036-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2036-01-28'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2036-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2036-02-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2036-03-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2036-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2036-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2036-04-26'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2036-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2036-05-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2036-06-24'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2036-07-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2036-08-22'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2036-09-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2036-10-20'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2036-11-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2036-12-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2036-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Tamil Thai Pongal Day', '2037-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2037-01-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2037-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2037-02-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2037-03-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2037-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2037-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2037-04-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2037-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2037-05-14'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2037-06-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2037-07-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2037-08-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2037-09-10'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2037-10-09'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2037-11-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2037-12-07'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2037-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2038-01-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2038-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('National Day', '2038-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2038-02-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2038-03-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2038-04-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2038-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2038-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2038-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2038-05-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2038-06-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2038-07-02'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Adhi Esala Full Moon Poya Day', '2038-07-31'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2038-08-30'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2038-09-28'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2038-10-28'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2038-11-27'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2038-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Unduvap Full Moon Poya Day', '2038-12-26'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2039-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('Duruthu Full Moon Poya Day', '2039-01-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('National Day', '2039-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2039-02-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2039-03-25'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2039-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2039-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Bak Full Moon Poya Day', '2039-04-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('May Day', '2039-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2039-05-23'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2039-06-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2039-07-21'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2039-08-19'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2039-09-18'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2039-10-17'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2039-11-16'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2039-12-15'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2039-12-25'::DATE, 'public', false, 'Christian holiday'),
    ('Duruthu Full Moon Poya Day', '2040-01-14'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Tamil Thai Pongal Day', '2040-01-14'::DATE, 'public', false, 'Hindu harvest festival'),
    ('National Day', '2040-02-04'::DATE, 'public', false, 'National Day'),
    ('Navam Full Moon Poya Day', '2040-02-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Madin Full Moon Poya Day', '2040-03-13'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Bak Full Moon Poya Day', '2040-04-12'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Day prior to Sinhala & Tamil New Year Day', '2040-04-13'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('Sinhala & Tamil New Year Day', '2040-04-14'::DATE, 'public', false, 'Sinhala and Tamil New Year holiday'),
    ('May Day', '2040-05-01'::DATE, 'public', false, 'International Workers'' Day'),
    ('Vesak Full Moon Poya Day', '2040-05-11'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Poson Full Moon Poya Day', '2040-06-10'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Esala Full Moon Poya Day', '2040-07-09'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Nikini Full Moon Poya Day', '2040-08-08'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Binara Full Moon Poya Day', '2040-09-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Vap Full Moon Poya Day', '2040-10-06'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Ill Full Moon Poya Day', '2040-11-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Unduvap Full Moon Poya Day', '2040-12-04'::DATE, 'poya', false, 'Buddhist Poya Day'),
    ('Christmas Day', '2040-12-25'::DATE, 'public', false, 'Christian holiday')
  ), inserted AS (
    INSERT INTO holidays (organization_id, branch_id, name, date, type, recurring, description)
    SELECT p_org_id, NULL::UUID, hs.name, hs.holiday_date, hs.holiday_type, hs.recurring, hs.description
    FROM holiday_seed hs
    WHERE NOT EXISTS (
      SELECT 1
      FROM holidays h
      WHERE h.organization_id = p_org_id
        AND h.branch_id IS NULL
        AND h.date = hs.holiday_date
        AND h.name = hs.name
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM inserted;

  RETURN v_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_employee_manager(p_employee_id uuid, p_manager_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(employee_id uuid, previous_manager_id uuid, manager_id uuid, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_employee employees%ROWTYPE;
  v_manager employees%ROWTYPE;
  v_previous_manager_id UUID;
  v_result_updated_at TIMESTAMPTZ;
  v_cycle_found BOOLEAN := false;
  v_changed_by_name TEXT;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to reassign managers' USING ERRCODE = '42501';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_employee
  FROM employees
  WHERE id = p_employee_id
    AND organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee is not available in this organization' USING ERRCODE = '22023';
  END IF;

  IF v_employee.termination_date IS NOT NULL
     OR COALESCE(v_employee.employment_status, 'active') = 'terminated' THEN
    RAISE EXCEPTION 'Cannot reassign a terminated employee' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    has_permission_for_employee('employees.reassign_manager', p_employee_id)
    OR has_permission_for_employee('employees.update_employment', p_employee_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this employee' USING ERRCODE = '42501';
  END IF;

  v_previous_manager_id := v_employee.manager_id;

  IF p_manager_id IS NOT NULL THEN
    IF p_manager_id = p_employee_id THEN
      RAISE EXCEPTION 'Employee cannot report to themselves' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_manager
    FROM employees
    WHERE id = p_manager_id
      AND organization_id = v_org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Manager is not available in this organization' USING ERRCODE = '22023';
    END IF;

    IF v_manager.termination_date IS NOT NULL
       OR COALESCE(v_manager.employment_status, 'active') = 'terminated' THEN
      RAISE EXCEPTION 'Cannot assign a terminated employee as manager' USING ERRCODE = '22023';
    END IF;

    WITH RECURSIVE manager_chain(id, manager_id, path_ids) AS (
      SELECT mgr.id, mgr.manager_id, ARRAY[mgr.id]::UUID[]
      FROM employees mgr
      WHERE mgr.id = p_manager_id
        AND mgr.organization_id = v_org_id

      UNION ALL

      SELECT parent.id, parent.manager_id, mc.path_ids || parent.id
      FROM employees parent
      JOIN manager_chain mc ON parent.id = mc.manager_id
      WHERE parent.organization_id = v_org_id
        AND parent.id <> ALL(mc.path_ids)
    )
    SELECT EXISTS (SELECT 1 FROM manager_chain WHERE id = p_employee_id)
    INTO v_cycle_found;

    IF COALESCE(v_cycle_found, false) THEN
      RAISE EXCEPTION 'Employee manager hierarchy cannot contain cycles' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_previous_manager_id IS NOT DISTINCT FROM p_manager_id THEN
    employee_id := p_employee_id;
    previous_manager_id := v_previous_manager_id;
    manager_id := v_previous_manager_id;
    updated_at := v_employee.updated_at;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE employees
  SET manager_id = p_manager_id,
      updated_at = now()
  WHERE id = p_employee_id
    AND organization_id = v_org_id
  RETURNING employees.manager_id, employees.updated_at
  INTO manager_id, v_result_updated_at;

  SELECT COALESCE(NULLIF(concat_ws(' ', u.first_name, u.last_name), ''), u.email, 'Admin')
  INTO v_changed_by_name
  FROM users u
  WHERE u.id = current_setting('touchorbit.current_user_id', true)::uuid;

  INSERT INTO employee_history (
    employee_id,
    event_type,
    event_date,
    details,
    description,
    changed_by,
    changed_by_name
  )
  VALUES (
    p_employee_id,
    'manager_changed',
    now(),
    jsonb_build_object(
      'field', 'manager_id',
      'old_value', v_previous_manager_id,
      'new_value', p_manager_id,
      'old_manager_id', v_previous_manager_id,
      'new_manager_id', p_manager_id
    ),
    CASE
      WHEN p_manager_id IS NULL THEN 'Manager removed from org chart reporting line.'
      WHEN v_previous_manager_id IS NULL THEN 'Manager assigned for org chart reporting line.'
      ELSE 'Manager changed for org chart reporting line.'
    END,
    current_setting('touchorbit.current_user_id', true)::uuid,
    COALESCE(v_changed_by_name, 'Admin')
  );

  INSERT INTO security_audit_log (
    organization_id,
    actor_user_id,
    target_employee_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  VALUES (
    v_org_id,
    current_setting('touchorbit.current_user_id', true)::uuid,
    p_employee_id,
    'employees.reassign_manager',
    'employee',
    p_employee_id,
    jsonb_build_object('manager_id', v_previous_manager_id),
    jsonb_build_object('manager_id', p_manager_id)
  );

  employee_id := p_employee_id;
  previous_manager_id := v_previous_manager_id;
  updated_at := v_result_updated_at;

  RETURN NEXT;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_employee_task_reminder_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.due_date IS NOT NULL AND NEW.reminder_minutes IS NOT NULL THEN
    NEW.reminder_at := NEW.due_date - make_interval(mins => GREATEST(NEW.reminder_minutes, 0));
  ELSE
    NEW.reminder_at := NULL;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.due_date IS DISTINCT FROM NEW.due_date OR OLD.reminder_minutes IS DISTINCT FROM NEW.reminder_minutes) THEN
    NEW.last_reminded_at := NULL;
  END IF;

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_roster_week_status(p_week_start date, p_status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_permission TEXT;
BEGIN
  v_org_id := get_my_org_id();

  IF p_status NOT IN ('draft', 'published', 'locked') THEN
    RAISE EXCEPTION 'Invalid roster week status: %', p_status;
  END IF;

  v_permission := CASE
    WHEN p_status = 'locked' THEN 'roster.lock'
    ELSE 'roster.publish'
  END;

  IF v_org_id IS NULL OR NOT (is_admin() OR has_permission(v_permission)) THEN
    RAISE EXCEPTION 'Not authorized to update roster week status';
  END IF;

  INSERT INTO roster_week_status (
    organization_id,
    week_start,
    status,
    published_at,
    published_by,
    locked_at,
    locked_by,
    updated_by
  )
  VALUES (
    v_org_id,
    p_week_start,
    p_status,
    CASE WHEN p_status = 'published' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'published' THEN current_setting('touchorbit.current_user_id', true)::uuid ELSE NULL END,
    CASE WHEN p_status = 'locked' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'locked' THEN current_setting('touchorbit.current_user_id', true)::uuid ELSE NULL END,
    current_setting('touchorbit.current_user_id', true)::uuid
  )
  ON CONFLICT (organization_id, week_start) DO UPDATE
  SET
    status = EXCLUDED.status,
    published_at = CASE
      WHEN p_status = 'published' THEN now()
      WHEN p_status = 'draft' THEN NULL
      ELSE roster_week_status.published_at
    END,
    published_by = CASE
      WHEN p_status = 'published' THEN current_setting('touchorbit.current_user_id', true)::uuid
      WHEN p_status = 'draft' THEN NULL
      ELSE roster_week_status.published_by
    END,
    locked_at = CASE
      WHEN p_status = 'locked' THEN now()
      WHEN p_status = 'draft' THEN NULL
      ELSE roster_week_status.locked_at
    END,
    locked_by = CASE
      WHEN p_status = 'locked' THEN current_setting('touchorbit.current_user_id', true)::uuid
      WHEN p_status = 'draft' THEN NULL
      ELSE roster_week_status.locked_by
    END,
    updated_by = current_setting('touchorbit.current_user_id', true)::uuid,
    updated_at = now();

  IF p_status = 'published' THEN
    UPDATE roster_assignments
    SET acknowledgment_status = 'pending',
        acknowledged_at = NULL,
        acknowledged_by = NULL,
        conflict_reason = NULL,
        conflict_flagged_at = NULL,
        conflict_resolved_at = NULL,
        conflict_resolved_by = NULL
    WHERE organization_id = v_org_id
      AND date >= p_week_start
      AND date < p_week_start + INTERVAL '7 days';
  END IF;

  RETURN p_status;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_leave_policy_to_employees(p_org_id uuid, p_year integer, p_annual_days integer, p_casual_days integer, p_sick_days integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- 1. Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only administrators can sync policies';
  END IF;

  -- 2. Update existing leave_balances for the organization and year
  -- Annual
  UPDATE leave_balances 
  SET entitled_days = p_annual_days,
      remaining_days = p_annual_days - used_days
  WHERE organization_id = p_org_id 
    AND year = p_year 
    AND leave_type = 'annual';

  -- Casual
  UPDATE leave_balances 
  SET entitled_days = p_casual_days,
      remaining_days = p_casual_days - used_days
  WHERE organization_id = p_org_id 
    AND year = p_year 
    AND leave_type = 'casual';

  -- Sick
  UPDATE leave_balances 
  SET entitled_days = p_sick_days,
      remaining_days = p_sick_days - used_days
  WHERE organization_id = p_org_id 
    AND year = p_year 
    AND leave_type = 'sick';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.terminate_employee(p_employee_id uuid, p_termination_date date, p_last_working_day date, p_reason text, p_terminated_by uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE employees
  SET
    employment_status = 'terminated',
    termination_date = p_termination_date,
    last_working_day = p_last_working_day,
    termination_reason = p_reason,
    terminated_by = p_terminated_by,
    updated_at = now()
  WHERE id = p_employee_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.touch_audit_policy_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := current_setting('touchorbit.current_user_id', true)::uuid;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trigger_route_expense_claim()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM route_expense_claim(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'route_expense_claim failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trigger_route_leave_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM route_leave_request(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'route_leave_request failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trigger_route_overtime_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM route_overtime_record(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'route_overtime_record failed: %', SQLERRM;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_audit_policy_settings(p_capture_ip_mode text DEFAULT NULL::text, p_retention_days integer DEFAULT NULL::integer, p_optional_modules jsonb DEFAULT NULL::jsonb, p_clear_retention boolean DEFAULT false)
 RETURNS TABLE(id uuid, organization_id uuid, capture_ip_mode text, retention_days integer, optional_modules jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_capture_ip_mode TEXT;
  v_optional_modules JSONB;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    has_permission('settings.manage_security')
    OR has_permission('audit.manage_retention')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage audit policy settings' USING ERRCODE = '42501';
  END IF;

  v_capture_ip_mode := lower(NULLIF(trim(COALESCE(p_capture_ip_mode, '')), ''));

  IF v_capture_ip_mode IS NOT NULL
     AND v_capture_ip_mode NOT IN ('sensitive_only', 'all', 'security_only', 'off') THEN
    RAISE EXCEPTION 'Invalid capture_ip_mode' USING ERRCODE = '22023';
  END IF;

  IF p_retention_days IS NOT NULL AND p_retention_days < 30 THEN
    RAISE EXCEPTION 'retention_days must be null or at least 30' USING ERRCODE = '22023';
  END IF;

  v_optional_modules := COALESCE(p_optional_modules, '{}'::JSONB);

  INSERT INTO audit_policy_settings (
    organization_id,
    capture_ip_mode,
    retention_days,
    optional_modules,
    created_by,
    updated_by
  )
  VALUES (
    v_org_id,
    COALESCE(v_capture_ip_mode, 'sensitive_only'),
    CASE WHEN COALESCE(p_clear_retention, false) THEN NULL ELSE p_retention_days END,
    COALESCE(NULLIF(v_optional_modules, '{}'::JSONB), jsonb_build_object(
      'employees', true,
      'org_chart', true,
      'attendance', true,
      'leave', true,
      'overtime', true,
      'expenses', true,
      'roster', true,
      'calendar', true,
      'documents', true,
      'tasks', true,
      'settings', true,
      'imports', true,
      'exports', true,
      'system', true
    )),
    current_setting('touchorbit.current_user_id', true)::uuid,
    current_setting('touchorbit.current_user_id', true)::uuid
  )
  ON CONFLICT ON CONSTRAINT audit_policy_settings_organization_id_key DO UPDATE
  SET capture_ip_mode = COALESCE(v_capture_ip_mode, audit_policy_settings.capture_ip_mode),
      retention_days = CASE
        WHEN COALESCE(p_clear_retention, false) THEN NULL
        WHEN p_retention_days IS NOT NULL THEN p_retention_days
        ELSE audit_policy_settings.retention_days
      END,
      optional_modules = audit_policy_settings.optional_modules || COALESCE(p_optional_modules, '{}'::JSONB),
      updated_by = current_setting('touchorbit.current_user_id', true)::uuid,
      updated_at = now();

  RETURN QUERY
  SELECT *
  FROM get_audit_policy_settings();
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_balance_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only update balance when status changes to 'approved'
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE leave_balances
    SET used_days = used_days + NEW.days_count
    WHERE organization_id = NEW.organization_id
      AND employee_id = NEW.employee_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)
      AND leave_type = NEW.leave_type;
  END IF;

  -- Restore balance when leave is cancelled
  IF NEW.status = 'cancelled' AND OLD.status = 'approved' THEN
    UPDATE leave_balances
    SET used_days = used_days - NEW.days_count
    WHERE organization_id = NEW.organization_id
      AND employee_id = NEW.employee_id
      AND year = EXTRACT(YEAR FROM NEW.start_date)
      AND leave_type = NEW.leave_type;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_calendar_event(p_event_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_event_type text DEFAULT NULL::text, p_event_scope text DEFAULT NULL::text, p_start_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_all_day boolean DEFAULT NULL::boolean, p_branch_id uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_secondary_branch_id uuid DEFAULT NULL::uuid, p_secondary_department_id uuid DEFAULT NULL::uuid, p_team_member_ids uuid[] DEFAULT NULL::uuid[], p_meeting_provider text DEFAULT NULL::text, p_meeting_url text DEFAULT NULL::text, p_meeting_id text DEFAULT NULL::text, p_requires_rsvp boolean DEFAULT NULL::boolean, p_reminder_minutes integer DEFAULT NULL::integer, p_attachments jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_location text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current calendar_events%ROWTYPE;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_all_day BOOLEAN;
  v_scope TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required to update calendar events';
  END IF;

  SELECT * INTO v_current
  FROM calendar_events
  WHERE id = p_event_id
    AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calendar event not found';
  END IF;

  v_start := COALESCE(p_start_time, v_current.start_at, (v_current.event_date + COALESCE(v_current.start_time, '00:00'::TIME))::TIMESTAMPTZ);
  v_end := COALESCE(p_end_time, v_current.end_at, (v_current.event_date + COALESCE(v_current.end_time, v_current.start_time, '23:59'::TIME))::TIMESTAMPTZ);
  v_all_day := COALESCE(p_all_day, v_current.all_day, false);
  v_scope := COALESCE(p_event_scope, v_current.event_scope);

  IF v_end < v_start THEN
    RAISE EXCEPTION 'Invalid event schedule';
  END IF;

  UPDATE calendar_events
  SET
    title = COALESCE(NULLIF(trim(p_title), ''), title),
    description = COALESCE(p_description, description),
    event_type = COALESCE(p_event_type, event_type),
    event_scope = v_scope,
    target_type = calendar_event_target_type(v_scope),
    target_id = COALESCE(p_department_id::TEXT, p_branch_id::TEXT, p_team_member_ids[1]::TEXT, target_id),
    event_date = v_start::DATE,
    start_time = CASE WHEN v_all_day THEN NULL ELSE v_start::TIME END,
    end_time = CASE WHEN v_all_day THEN NULL ELSE v_end::TIME END,
    start_at = v_start,
    end_at = v_end,
    all_day = v_all_day,
    branch_id = COALESCE(p_branch_id, branch_id),
    department_id = COALESCE(p_department_id, department_id),
    secondary_branch_id = COALESCE(p_secondary_branch_id, secondary_branch_id),
    secondary_department_id = COALESCE(p_secondary_department_id, secondary_department_id),
    team_member_ids = COALESCE(p_team_member_ids, team_member_ids),
    meeting_provider = COALESCE(p_meeting_provider, meeting_provider),
    meeting_url = COALESCE(p_meeting_url, meeting_url),
    meeting_id = COALESCE(p_meeting_id, meeting_id),
    requires_rsvp = COALESCE(p_requires_rsvp, requires_rsvp),
    reminder_minutes = COALESCE(p_reminder_minutes, reminder_minutes),
    attachments = COALESCE(p_attachments, attachments),
    status = COALESCE(p_status, status),
    location = COALESCE(p_location, location)
  WHERE id = p_event_id
    AND organization_id = get_my_org_id();

  RETURN p_event_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_employee_training_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_holiday_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_leave_remaining()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.remaining_days = NEW.entitled_days - NEW.used_days;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.upsert_roster_assignment(p_employee_id uuid, p_date date, p_shift_template_id uuid, p_notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_row_id UUID;
BEGIN
  v_org_id := get_my_org_id();

  IF v_org_id IS NULL OR NOT has_permission_for_employee('roster.edit', p_employee_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_shift_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.id = p_shift_template_id
      AND s.organization_id = v_org_id
      AND COALESCE(s.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'Shift is not available for this organization';
  END IF;

  INSERT INTO roster_assignments (
    organization_id,
    employee_id,
    date,
    shift_id,
    notes,
    created_by,
    acknowledgment_status,
    acknowledged_at,
    acknowledged_by,
    conflict_reason,
    conflict_flagged_at,
    conflict_resolved_at,
    conflict_resolved_by
  )
  VALUES (
    v_org_id,
    p_employee_id,
    p_date,
    p_shift_template_id,
    p_notes,
    current_setting('touchorbit.current_user_id', true)::uuid,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (employee_id, date) DO UPDATE
  SET shift_id = EXCLUDED.shift_id,
      notes = EXCLUDED.notes,
      created_by = current_setting('touchorbit.current_user_id', true)::uuid,
      acknowledgment_status = 'pending',
      acknowledged_at = NULL,
      acknowledged_by = NULL,
      conflict_reason = NULL,
      conflict_flagged_at = NULL,
      conflict_resolved_at = NULL,
      conflict_resolved_by = NULL
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_encashment_request(p_employee_id uuid, p_year integer, p_days numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_remaining_annual DECIMAL;
  v_max_encashable INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- 1. Check if organization allows encashment
  SELECT encashment_allowed, encashment_max_days 
  INTO v_allowed, v_max_encashable
  FROM organizations 
  WHERE id = (SELECT organization_id FROM employees WHERE id = p_employee_id);

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Encashment is not enabled for your organization.');
  END IF;

  -- 2. Check if requested days exceed max limit
  IF p_days > v_max_encashable THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Maximum encashable limit is ' || v_max_encashable || ' days.');
  END IF;

  -- 3. Check if employee has enough balance
  SELECT remaining_days INTO v_remaining_annual
  FROM leave_balances 
  WHERE employee_id = p_employee_id 
    AND year = p_year 
    AND leave_type = 'annual';

  IF v_remaining_annual IS NULL OR v_remaining_annual < p_days THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Insufficient annual leave balance.');
  END IF;

  RETURN jsonb_build_object('valid', true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.verify_clock_event(p_org_id uuid, p_lat double precision, p_lng double precision, p_timezone text, p_work_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_strict_mode BOOLEAN;
  v_org_timezone TEXT;
  v_is_within_geofence BOOLEAN := false;
  v_timezone_matches BOOLEAN := false;
  v_status TEXT := 'verified';
  v_flags TEXT[] := '{}';
  v_nearest_geofence_name TEXT;
  v_distance FLOAT;
BEGIN
  -- Get organization settings
  SELECT strict_location_mode, timezone 
  INTO v_strict_mode, v_org_timezone 
  FROM organizations WHERE id = p_org_id;

  -- 1. Check Timezone
  IF p_timezone = v_org_timezone THEN
    v_timezone_matches := true;
  ELSE
    v_flags := array_append(v_flags, 'timezone_mismatch');
    v_status := 'flagged';
  END IF;

  -- 2. Check Geofence (only for office work)
  IF p_work_type = 'office' THEN
    SELECT name, calculate_distance(p_lat, p_lng, latitude, longitude) as dist
    INTO v_nearest_geofence_name, v_distance
    FROM geofences
    WHERE organization_id = p_org_id AND status = 'active'
    ORDER BY dist ASC LIMIT 1;

    IF v_distance IS NOT NULL AND v_distance <= (SELECT radius_meters FROM geofences WHERE name = v_nearest_geofence_name AND organization_id = p_org_id LIMIT 1) THEN
      v_is_within_geofence := true;
    ELSE
      v_flags := array_append(v_flags, 'outside_geofence');
      v_status := 'flagged';
    END IF;
  ELSE
    -- WFH/Field is always "within geofence" for logic purposes
    v_is_within_geofence := true;
  END IF;

  -- 3. Enforce Strict Mode (REJECT if failed)
  IF v_strict_mode = true THEN
    IF NOT v_is_within_geofence OR NOT v_timezone_matches THEN
      RETURN jsonb_build_object(
        'decision', 'REJECTED',
        'reason', CASE 
          WHEN NOT v_is_within_geofence THEN 'Outside designated work area'
          WHEN NOT v_timezone_matches THEN 'Invalid device timezone (' || p_timezone || ')'
          ELSE 'Security verification failed'
        END
      );
    END IF;
  END IF;

  -- Return Success/Flagged status
  RETURN jsonb_build_object(
    'decision', CASE WHEN v_status = 'flagged' THEN 'FLAGGED' ELSE 'SUCCESS' END,
    'flags', v_flags,
    'geofence_verified', v_is_within_geofence,
    'timezone_verified', v_timezone_matches
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.verify_clock_event(p_organization_id uuid, p_employee_id uuid, p_lat numeric, p_lng numeric, p_accuracy numeric, p_work_type text, p_suspicious_flags text[], p_timezone text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_strict_mode BOOLEAN;
  v_org_timezone TEXT;
  v_is_inside BOOLEAN;
  v_geofence_verified BOOLEAN := false;
  v_flags TEXT[] := COALESCE(p_suspicious_flags, ARRAY[]::TEXT[]);
  v_status TEXT := 'SUCCESS';
BEGIN
  IF current_setting('touchorbit.current_user_id', true)::uuid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_work_type NOT IN ('office', 'wfh', 'field') THEN
    RAISE EXCEPTION 'Invalid work type' USING ERRCODE = '22023';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_accuracy IS NULL THEN
    RAISE EXCEPTION 'Location payload is incomplete' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM employees e
    WHERE e.id = p_employee_id
      AND e.organization_id = p_organization_id
      AND e.user_id = current_setting('touchorbit.current_user_id', true)::uuid
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT strict_location_mode, timezone
  INTO v_org_strict_mode, v_org_timezone
  FROM organizations
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found' USING ERRCODE = '22023';
  END IF;

  IF p_work_type = 'office' THEN
    IF EXISTS (SELECT 1 FROM organizations WHERE id = p_organization_id AND block_on_ip_mismatch = true) THEN
      IF EXISTS (
        SELECT 1 FROM clock_events
        WHERE employee_id = p_employee_id
          AND ip_check_status = 'done'
          AND 'ip_distance_mismatch' = ANY(suspicious_flags)
          AND admin_review_status = 'flagged'
          AND timestamp > now() - interval '24 hours'
        LIMIT 1
      ) THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'decision', 'REJECTED', 'reason', 'location_unverifiable', 'flags', v_flags, 'geofence_verified', false);
      END IF;
    END IF;

    IF v_org_strict_mode = true THEN
      SELECT EXISTS (
        SELECT 1 FROM geofences
        WHERE organization_id = p_organization_id
          AND status = 'active'
          AND calculate_distance(p_lat, p_lng, latitude, longitude) <= radius_meters
      ) INTO v_is_inside;

      IF NOT v_is_inside THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'decision', 'REJECTED', 'reason', 'outside_geofence', 'flags', v_flags, 'geofence_verified', false);
      END IF;

      v_geofence_verified := true;

      IF p_accuracy < 5 OR p_accuracy > 100 THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'decision', 'REJECTED', 'reason', 'location_unverifiable', 'flags', v_flags, 'geofence_verified', false);
      END IF;

      IF 'low_variance' = ANY(v_flags) THEN
        RETURN jsonb_build_object('status', 'REJECTED', 'decision', 'REJECTED', 'reason', 'location_unverifiable', 'flags', v_flags, 'geofence_verified', false);
      END IF;
    END IF;
  ELSE
    v_geofence_verified := true;
  END IF;

  IF p_timezone IS NOT NULL AND v_org_timezone IS NOT NULL AND p_timezone != v_org_timezone THEN
    v_flags := array_append(v_flags, 'timezone_mismatch');
    v_status := 'FLAGGED';
  END IF;

  RETURN jsonb_build_object('status', v_status, 'decision', v_status, 'flags', v_flags, 'geofence_verified', v_geofence_verified);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.verify_clock_event_location()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_geofence RECORD;
  v_min_distance NUMERIC;
  v_is_within_geofence BOOLEAN := false;
  v_flags TEXT[] := '{}';
  v_teleport_result RECORD;
  v_is_ios BOOLEAN := false;
BEGIN
  -- Skip if no coordinates provided (kiosk mode)
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.admin_review_status := 'none';
    RETURN NEW;
  END IF;

  -- ⭐ SIMPLE FIX: If admin is approving/rejecting, don't interfere!
  -- Check the NEW status - if it's being SET to approved/rejected, skip all verification
  IF NEW.admin_review_status IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Skip geofence verification for WFH and field work
  IF NEW.work_type IN ('wfh', 'field') THEN
    NEW.location_verified := true;
    NEW.admin_review_status := 'none';
    RETURN NEW;
  END IF;

  -- Initialize suspicious_flags if null
  IF NEW.suspicious_flags IS NULL THEN
    NEW.suspicious_flags := '{}';
  END IF;

  -- Check if device is iOS (from device_fingerprint)
  IF NEW.device_fingerprint IS NOT NULL THEN
    v_is_ios := (
      NEW.device_fingerprint->>'platform' ILIKE '%iPhone%' OR
      NEW.device_fingerprint->>'platform' ILIKE '%iPad%' OR
      NEW.device_fingerprint->>'platform' ILIKE '%iPod%' OR
      NEW.device_fingerprint->>'userAgent' ILIKE '%iPhone%' OR
      NEW.device_fingerprint->>'userAgent' ILIKE '%iPad%' OR
      NEW.device_fingerprint->>'userAgent' ILIKE '%iPod%'
    );
  END IF;

  -- Check 1: Low variance (possible mock location)
  -- SKIP for iOS: iOS GPS caches location for battery efficiency
  IF NOT v_is_ios AND NEW.location_variance IS NOT NULL AND NEW.location_variance < 0.00001 THEN
    v_flags := array_append(v_flags, 'low_variance');
  END IF;

  -- Check 2: Accuracy anomaly (too precise or too imprecise)
  IF NEW.gps_accuracy IS NOT NULL THEN
    IF NEW.gps_accuracy < 1 THEN
      v_flags := array_append(v_flags, 'accuracy_too_precise');
    ELSIF NEW.gps_accuracy > 100 THEN
      v_flags := array_append(v_flags, 'accuracy_too_imprecise');
    END IF;
  END IF;

  -- Check 3: Timezone mismatch (only if organization has configured expected timezone)
  IF NEW.timezone_offset IS NOT NULL THEN
    DECLARE
      v_org_timezone INTEGER;
      v_timezone_tolerance INTEGER;
    BEGIN
      SELECT expected_timezone_offset, timezone_tolerance_minutes
      INTO v_org_timezone, v_timezone_tolerance
      FROM organizations
      WHERE id = NEW.organization_id;

      -- Only check if organization has configured expected timezone
      IF v_org_timezone IS NOT NULL THEN
        IF ABS(NEW.timezone_offset - v_org_timezone) > COALESCE(v_timezone_tolerance, 60) THEN
          v_flags := array_append(v_flags, 'timezone_mismatch');
        END IF;
      END IF;
    END;
  END IF;

  -- Check 4: Teleportation detection
  SELECT * INTO v_teleport_result
  FROM check_teleportation(
    NEW.employee_id,
    NEW.latitude,
    NEW.longitude,
    NEW.timestamp
  );

  IF v_teleport_result.is_suspicious THEN
    v_flags := array_append(v_flags, 'teleportation');
  END IF;

  -- Check 5: Server-side geofence verification (only for office mode)
  -- Fetch active geofences for the organization
  SELECT INTO v_min_distance MIN(
    calculate_distance(NEW.latitude, NEW.longitude, g.latitude, g.longitude)
  )
  FROM geofences g
  WHERE g.organization_id = NEW.organization_id
    AND g.status = 'active';

  -- If geofences exist, check if within any of them
  IF v_min_distance IS NOT NULL THEN
    -- Check if within any geofence radius
    SELECT EXISTS(
      SELECT 1
      FROM geofences g
      WHERE g.organization_id = NEW.organization_id
        AND g.status = 'active'
        AND calculate_distance(NEW.latitude, NEW.longitude, g.latitude, g.longitude) <= g.radius_meters
    ) INTO v_is_within_geofence;

    -- Override client-provided location_verified with server calculation
    NEW.location_verified := v_is_within_geofence;

    -- Flag if outside all geofences
    IF NOT v_is_within_geofence THEN
      v_flags := array_append(v_flags, 'outside_geofence');
    END IF;
  ELSE
    -- No geofences configured - allow from anywhere
    NEW.location_verified := true;
  END IF;

  -- Merge any client-provided flags
  IF NEW.suspicious_flags IS NOT NULL AND array_length(NEW.suspicious_flags, 1) > 0 THEN
    v_flags := v_flags || NEW.suspicious_flags;
  END IF;

  -- If iOS detected, remove 'low_variance' flag (client may have added it before server check)
  IF v_is_ios THEN
    v_flags := array_remove(v_flags, 'low_variance');
  END IF;

  -- Remove duplicates
  SELECT array_agg(DISTINCT flag) INTO v_flags FROM unnest(v_flags) AS flag;

  NEW.suspicious_flags := v_flags;

  -- Set admin review status
  IF array_length(v_flags, 1) > 0 THEN
    NEW.admin_review_status := 'flagged';
  ELSE
    NEW.admin_review_status := 'none';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_audit_payroll_run_insert_update AFTER INSERT OR UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION audit_payroll_run_insert_update();
CREATE TRIGGER trg_audit_policy_settings_updated_at BEFORE UPDATE ON audit_policy_settings FOR EACH ROW EXECUTE FUNCTION touch_audit_policy_settings_updated_at();
CREATE TRIGGER trg_audit_salary_revision_insert AFTER INSERT ON salary_revisions FOR EACH ROW EXECUTE FUNCTION audit_salary_revision_insert();
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_compoff_updated BEFORE UPDATE ON comp_off_records FOR EACH ROW EXECUTE FUNCTION update_holiday_timestamp();
CREATE TRIGGER trg_conflict_log_updated_at BEFORE UPDATE ON conflict_log FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_detect_overtime AFTER INSERT OR UPDATE ON clock_events FOR EACH ROW EXECUTE FUNCTION detect_and_create_overtime();
CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employee_availability_updated_at BEFORE UPDATE ON employee_availability FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employee_documents_updated_at BEFORE UPDATE ON employee_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employee_goals_updated_at BEFORE UPDATE ON employee_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_employee_tasks_reminder_at BEFORE INSERT OR UPDATE ON employee_tasks FOR EACH ROW EXECUTE FUNCTION set_employee_task_reminder_at();
CREATE TRIGGER trg_employee_tasks_updated_at BEFORE UPDATE ON employee_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_employee_training_updated_at BEFORE UPDATE ON employee_training FOR EACH ROW EXECUTE FUNCTION update_employee_training_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_encashment_updated_at BEFORE UPDATE ON leave_encashment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_enforce_org_position_references BEFORE INSERT OR UPDATE OF organization_id, department_id, manager_id, filled_by_employee_id ON org_positions FOR EACH ROW EXECUTE FUNCTION enforce_org_position_references();
CREATE TRIGGER trg_event_attendees_updated_at BEFORE UPDATE ON event_attendees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expense_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_geofences_updated_at BEFORE UPDATE ON geofences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON holidays FOR EACH ROW EXECUTE FUNCTION update_holiday_timestamp();
CREATE TRIGGER trg_initialize_leave_balances AFTER INSERT ON employees FOR EACH ROW EXECUTE FUNCTION initialize_employee_leave_balances();
CREATE TRIGGER trg_leave_balances_remaining BEFORE INSERT OR UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_leave_remaining();
CREATE TRIGGER trg_leave_records_updated_at BEFORE UPDATE ON leave_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_log_employee_changes AFTER UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION log_employee_changes();
CREATE TRIGGER trg_log_employee_creation AFTER INSERT ON employees FOR EACH ROW EXECUTE FUNCTION log_employee_creation();
CREATE TRIGGER trg_log_roster_assignment_overlap BEFORE INSERT OR UPDATE OF employee_id, date, shift_id ON roster_assignments FOR EACH ROW EXECUTE FUNCTION log_roster_assignment_overlap();
CREATE TRIGGER trg_mirror_employee_history_to_audit_events AFTER INSERT ON employee_history FOR EACH ROW EXECUTE FUNCTION mirror_employee_history_to_audit_events();
CREATE TRIGGER trg_mirror_security_audit_log_to_audit_events AFTER INSERT ON security_audit_log FOR EACH ROW EXECUTE FUNCTION mirror_security_audit_log_to_audit_events();
CREATE TRIGGER trg_notify_calendar_event_created AFTER INSERT ON calendar_events FOR EACH ROW EXECUTE FUNCTION notify_calendar_event_created();
CREATE TRIGGER trg_notify_calendar_event_updated AFTER UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION notify_calendar_event_updated();
CREATE TRIGGER trg_notify_calendar_reschedule_requested AFTER UPDATE ON event_attendees FOR EACH ROW EXECUTE FUNCTION notify_calendar_reschedule_requested();
CREATE TRIGGER trg_notify_correction_submitted AFTER INSERT ON attendance_corrections FOR EACH ROW EXECUTE FUNCTION fn_notify_correction_submitted();
CREATE TRIGGER trg_notify_employee_task_assigned AFTER INSERT ON employee_tasks FOR EACH ROW EXECUTE FUNCTION notify_employee_task_assigned();
CREATE TRIGGER trg_notify_event_attendee_invited AFTER INSERT ON event_attendees FOR EACH ROW EXECUTE FUNCTION notify_event_attendee_invited();
CREATE TRIGGER trg_notify_expense_event AFTER INSERT OR UPDATE ON expense_claims FOR EACH ROW EXECUTE FUNCTION fn_notify_expense_event();
CREATE TRIGGER trg_notify_leave_event AFTER INSERT OR UPDATE ON leave_records FOR EACH ROW EXECUTE FUNCTION fn_notify_leave_event();
CREATE TRIGGER trg_notify_low_coverage AFTER INSERT OR DELETE OR UPDATE ON roster_assignments FOR EACH ROW EXECUTE FUNCTION fn_notify_low_coverage();
CREATE TRIGGER trg_notify_new_announcement AFTER INSERT ON announcements FOR EACH ROW EXECUTE FUNCTION notify_new_announcement();
CREATE TRIGGER trg_notify_overtime_alert AFTER INSERT OR UPDATE OF status, hours ON overtime_records FOR EACH ROW EXECUTE FUNCTION fn_notify_overtime_alert();
CREATE TRIGGER trg_notify_overtime_submitted AFTER INSERT ON overtime_records FOR EACH ROW EXECUTE FUNCTION fn_notify_overtime_submitted();
CREATE TRIGGER trg_notify_payroll_finalized AFTER UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION fn_notify_payroll_finalized();
CREATE TRIGGER trg_notify_roster_week_published AFTER INSERT OR UPDATE ON roster_week_status FOR EACH ROW EXECUTE FUNCTION notify_roster_week_published();
CREATE TRIGGER trg_notify_salary_revised AFTER INSERT ON salary_revisions FOR EACH ROW EXECUTE FUNCTION fn_notify_salary_revised();
CREATE TRIGGER trg_notify_shift_conflict AFTER INSERT ON conflict_log FOR EACH ROW EXECUTE FUNCTION fn_notify_shift_conflict();
CREATE TRIGGER trg_notify_shift_swap_decision AFTER UPDATE ON shift_swap_requests FOR EACH ROW EXECUTE FUNCTION notify_shift_swap_decision();
CREATE TRIGGER trg_notify_suspicious_clock AFTER INSERT OR UPDATE ON clock_events FOR EACH ROW EXECUTE FUNCTION notify_suspicious_clock_event();
CREATE TRIGGER trg_notify_training_assigned AFTER INSERT ON employee_training FOR EACH ROW EXECUTE FUNCTION fn_notify_training_assigned();
CREATE TRIGGER trg_org_meeting_providers_updated_at BEFORE UPDATE ON organization_meeting_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_performance_reviews_updated_at BEFORE UPDATE ON performance_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prevent_department_parent_cycle BEFORE INSERT OR UPDATE OF parent_department_id, organization_id ON departments FOR EACH ROW EXECUTE FUNCTION prevent_department_parent_cycle();
CREATE TRIGGER trg_prevent_employee_manager_cycle BEFORE INSERT OR UPDATE OF manager_id, organization_id ON employees FOR EACH ROW EXECUTE FUNCTION prevent_employee_manager_cycle();
CREATE TRIGGER trg_prevent_employee_matrix_report_cycle BEFORE INSERT OR UPDATE OF organization_id, employee_id, matrix_manager_id, relationship_type ON employee_matrix_reports FOR EACH ROW EXECUTE FUNCTION prevent_employee_matrix_report_cycle();
CREATE TRIGGER trg_public_calendar_tokens_updated_at BEFORE UPDATE ON public_calendar_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_record_org_chart_presence_event AFTER INSERT OR UPDATE OF event_type, "timestamp", employee_id, organization_id ON clock_events FOR EACH ROW EXECUTE FUNCTION record_org_chart_presence_event();
CREATE TRIGGER trg_roster_assignments_updated_at BEFORE UPDATE ON roster_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_roster_week_status_updated_at BEFORE UPDATE ON roster_week_status FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_route_expense_claim AFTER INSERT ON expense_claims FOR EACH ROW EXECUTE FUNCTION trigger_route_expense_claim();
CREATE TRIGGER trg_route_leave_request AFTER INSERT ON leave_records FOR EACH ROW EXECUTE FUNCTION trigger_route_leave_request();
CREATE TRIGGER trg_route_overtime_record AFTER INSERT ON overtime_records FOR EACH ROW EXECUTE FUNCTION trigger_route_overtime_record();
CREATE TRIGGER trg_sent_documents_updated_at BEFORE UPDATE ON sent_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shift_swap_requests_updated_at BEFORE UPDATE ON shift_swap_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_single_default_meeting_provider BEFORE INSERT OR UPDATE ON organization_meeting_providers FOR EACH ROW EXECUTE FUNCTION enforce_single_default_meeting_provider();
CREATE TRIGGER trg_update_balance_on_approval AFTER UPDATE ON leave_records FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION update_balance_on_approval();
CREATE TRIGGER trg_user_meeting_providers_updated_at BEFORE UPDATE ON user_meeting_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_verify_clock_event_location BEFORE INSERT OR UPDATE ON clock_events FOR EACH ROW EXECUTE FUNCTION verify_clock_event_location();

-- Migration tracking table for the custom runner
CREATE TABLE IF NOT EXISTS migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
