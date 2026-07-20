// Typed fetch helpers for all 7 report API routes.
// Each function returns { data, meta, error }.
// Call buildExportUrl(...) to get a direct CSV download link.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Modules that have been migrated to the NestJS backend.
const BACKEND_REPORT_MODULES = [
  "attendance",
  "leave",
  "payroll",
  "adherence",
  "overtime",
  "late",
  "expense",
];

export interface ReportFilters {
  startDate: string;
  endDate: string;
  departmentId?: string | null;
  employeeIds?: string[] | null;
  mode?: "summary" | "detail";
  // leave-specific
  leaveType?: string | null;
  status?: string | null;
}

export interface ReportResponse<T = Record<string, unknown>> {
  data: T[];
  meta: Record<string, unknown>;
  error: string | null;
}

// ── Row types (match exact keys returned by each API route) ──────────────────

export interface AttendanceSummaryRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  total_scheduled: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  on_leave_count: number;
  avg_hours_worked: number;
  attendance_rate: number;
}

export interface AttendanceDetailRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  work_date: string;
  status: string;
  shift_name: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  minutes_late: number | null;
}

export interface LateArrivalRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  work_date: string;
  day_of_week: string;
  shift_name: string;
  scheduled_start: string;
  actual_clock_in: string;
  minutes_late: number;
  severity: string;
  repeat_count: number;
}

export interface LeaveRow {
  id: string;
  employee_name: string;
  department_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  entitled_days: number | null;
  used_days: number | null;
  remaining_days: number | null;
}

export interface AdherenceRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  total_scheduled: number;
  on_time_count: number;
  late_count: number;
  early_departure_count: number;
  absent_count: number;
  late_early_count: number;
  adherence_rate: number;
}

export interface OvertimeRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  overtime_date: string;
  overtime_hours: number;
  overtime_status: string;
  had_roster_shift: boolean;
  shift_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  flag: string;
}

export interface PayrollRow {
  employee_id: string;
  employee_name: string;
  department_name: string;
  month_label: string;
  run_status: string;
  basic_salary: number;
  gross_salary: number;
  net_salary: number;
  epf_employee: number;
  epf_employer: number;
  etf: number;
  paye_tax: number;
  total_deductions: number;
  days_worked: number;
  days_absent: number;
  overtime_hours: number;
}

export interface ExpenseRow {
  id: string;
  employee_name: string;
  department_name: string;
  claim_date: string;
  category_name: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
}

const NUMERIC_ROW_FIELDS = new Set([
  "total_scheduled",
  "present_count",
  "late_count",
  "absent_count",
  "on_leave_count",
  "avg_hours_worked",
  "attendance_rate",
  "minutes_late",
  "repeat_count",
  "days",
  "entitled_days",
  "used_days",
  "remaining_days",
  "on_time_count",
  "early_departure_count",
  "late_early_count",
  "overtime_hours",
  "basic_salary",
  "gross_salary",
  "net_salary",
  "epf_employee",
  "epf_employer",
  "etf",
  "paye_tax",
  "total_deductions",
  "days_worked",
  "days_absent",
  "amount",
]);

function normalizeRows<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row as T;
    return Object.fromEntries(
      Object.entries(row).map(([key, fieldValue]) => [
        key,
        NUMERIC_ROW_FIELDS.has(key) && fieldValue != null && fieldValue !== ""
          ? Number(fieldValue)
          : fieldValue,
      ]),
    ) as T;
  });
}

// ── Internal builder ─────────────────────────────────────────────────────────

function buildParams(
  filters: ReportFilters & { format?: string },
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.startDate) p.set("startDate", filters.startDate);
  if (filters.endDate) p.set("endDate", filters.endDate);
  if (filters.departmentId) p.set("departmentId", filters.departmentId);
  if (filters.employeeIds?.length)
    p.set("employeeIds", filters.employeeIds.join(","));
  if (filters.mode) p.set("mode", filters.mode);
  if (filters.leaveType) p.set("leaveType", filters.leaveType);
  if (filters.status) p.set("status", filters.status);
  if (filters.format) p.set("format", filters.format);
  return p;
}

async function fetchModule<T>(
  module: string,
  filters: ReportFilters,
): Promise<ReportResponse<T>> {
  try {
    const params = buildParams(filters);
    const useBackend = BACKEND_REPORT_MODULES.includes(module) && API_URL;
    const url = useBackend
      ? `${API_URL}/api/reports/${module}?${params}`
      : `/api/reports/${module}?${params}`;

    const res = await fetch(url, {
      credentials: useBackend ? "include" : "same-origin",
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return {
        data: [],
        meta: {},
        error: json.error ?? json.message ?? `HTTP ${res.status}`,
      };
    }

    const payload = await res.json();
    // Backend reports return { data, meta, error } directly; internal routes do too.
    return {
      data: normalizeRows<T>(payload.data),
      meta:
        payload.meta && typeof payload.meta === "object" ? payload.meta : {},
      error: null,
    };
  } catch (err: any) {
    return { data: [], meta: {}, error: err.message ?? "Network error" };
  }
}

// ── Public fetch functions ───────────────────────────────────────────────────

export const reportFetch = {
  attendance: (f: ReportFilters) =>
    fetchModule<AttendanceSummaryRow | AttendanceDetailRow>("attendance", f),
  late: (f: ReportFilters) => fetchModule<LateArrivalRow>("late", f),
  leave: (f: ReportFilters) => fetchModule<LeaveRow>("leave", f),
  adherence: (f: ReportFilters) => fetchModule<AdherenceRow>("adherence", f),
  overtime: (f: ReportFilters) => fetchModule<OvertimeRow>("overtime", f),
  payroll: (f: ReportFilters) => fetchModule<PayrollRow>("payroll", f),
  expense: (f: ReportFilters) => fetchModule<ExpenseRow>("expense", f),
  roster: (f: ReportFilters) => fetchModule<AdherenceRow>("roster", f),
};

// ── Export URL builder (triggers browser download via <a> click) ─────────────

export function buildExportUrl(module: string, filters: ReportFilters): string {
  return `/api/reports/${module}?${buildParams({ ...filters, format: "csv" })}`;
}

export function triggerExport(module: string, filters: ReportFilters): void {
  const url = buildExportUrl(module, filters);
  const a = document.createElement("a");
  a.href = url;
  a.click();
}
