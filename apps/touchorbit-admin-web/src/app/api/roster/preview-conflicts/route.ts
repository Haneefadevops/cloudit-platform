import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

type DraftAssignment = {
  id?: string
  employee_id?: string
  employeeId?: string
  date?: string
  shift_id?: string
  shiftId?: string
}

type NormalizedAssignment = {
  id: string
  employee_id: string
  date: string
  shift_id: string
  source: 'draft' | 'existing'
}

type ShiftRow = {
  id: string
  name: string | null
  start_time: string | null
  end_time: string | null
}

type WindowedAssignment = NormalizedAssignment & {
  start: Date
  end: Date
  shift: ShiftRow
}

type PreviewBody = {
  assignments?: DraftAssignment[]
}

function normalizeDrafts(assignments: DraftAssignment[]) {
  return assignments.flatMap((assignment, index): NormalizedAssignment[] => {
    const employeeId = assignment.employee_id ?? assignment.employeeId
    const shiftId = assignment.shift_id ?? assignment.shiftId
    if (!employeeId || !assignment.date || !shiftId) return []
    return [{
      id: assignment.id ?? `draft-${index + 1}`,
      employee_id: employeeId,
      date: assignment.date,
      shift_id: shiftId,
      source: 'draft',
    }]
  })
}

function toDateTime(date: string, time: string | null) {
  return new Date(`${date}T${time ?? '00:00:00'}Z`)
}

function withWindows(assignments: NormalizedAssignment[], shifts: Map<string, ShiftRow>) {
  return assignments.flatMap((assignment): WindowedAssignment[] => {
    const shift = shifts.get(assignment.shift_id)
    if (!shift?.start_time || !shift?.end_time) return []
    const start = toDateTime(assignment.date, shift.start_time)
    const end = toDateTime(assignment.date, shift.end_time)
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1)
    return [{ ...assignment, shift, start, end }]
  })
}

function overlaps(a: WindowedAssignment, b: WindowedAssignment) {
  return a.start < b.end && b.start < a.end
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as PreviewBody | DraftAssignment[]
  const rawAssignments = Array.isArray(body) ? body : body.assignments
  if (!Array.isArray(rawAssignments)) {
    return NextResponse.json({ error: 'assignments array is required' }, { status: 400 })
  }

  const drafts = normalizeDrafts(rawAssignments)
  if (drafts.length === 0) {
    return NextResponse.json({ conflicts: [], meta: { checked: 0 } })
  }

  const employeeIds = [...new Set(drafts.map((assignment) => assignment.employee_id))]
  const dates = [...new Set(drafts.map((assignment) => assignment.date))]
  const minDate = dates.sort()[0]
  const maxDate = dates.sort()[dates.length - 1]

  const { data: employees, error: employeeError } = await auth.supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('organization_id', auth.profile.organization_id)
    .in('id', employeeIds)

  if (employeeError) {
    console.error('[roster/preview-conflicts POST] employees', employeeError)
    return NextResponse.json({ error: employeeError.message }, { status: 500 })
  }

  const scopedEmployeeIds = new Set((employees ?? []).map((employee) => employee.id))
  const scopedDrafts = drafts.filter((assignment) => scopedEmployeeIds.has(assignment.employee_id))
  if (scopedDrafts.length === 0) {
    return NextResponse.json({ conflicts: [], meta: { checked: 0 } })
  }

  const [existingResult, leaveResult, availabilityResult] = await Promise.all([
    auth.supabase
      .from('roster_assignments')
      .select('id, employee_id, date, shift_id')
      .eq('organization_id', auth.profile.organization_id)
      .gte('date', minDate)
      .lte('date', maxDate)
      .in('employee_id', [...scopedEmployeeIds]),
    auth.supabase
      .from('leave_records')
      .select('id, employee_id, leave_type, start_date, end_date, status')
      .eq('organization_id', auth.profile.organization_id)
      .eq('status', 'approved')
      .lte('start_date', maxDate)
      .gte('end_date', minDate)
      .in('employee_id', [...scopedEmployeeIds]),
    auth.supabase
      .from('employee_availability')
      .select('id, employee_id, day_of_week, start_time, end_time, is_available, effective_from, effective_until, reason')
      .eq('organization_id', auth.profile.organization_id)
      .eq('is_available', false)
      .lte('effective_from', maxDate)
      .or(`effective_until.is.null,effective_until.gte.${minDate}`)
      .in('employee_id', [...scopedEmployeeIds]),
  ])

  const firstError = [existingResult.error, leaveResult.error, availabilityResult.error].find(Boolean)
  if (firstError) {
    console.error('[roster/preview-conflicts POST]', firstError)
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const existing = ((existingResult.data ?? []) as { id: string; employee_id: string; date: string; shift_id: string | null }[])
    .filter((assignment) => assignment.shift_id)
    .map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employee_id,
      date: assignment.date,
      shift_id: assignment.shift_id!,
      source: 'existing' as const,
    }))

  const shiftIds = [...new Set([...scopedDrafts, ...existing].map((assignment) => assignment.shift_id))]
  const { data: shifts, error: shiftError } = await auth.supabase
    .from('shifts')
    .select('id, name, start_time, end_time')
    .in('id', shiftIds)

  if (shiftError) {
    console.error('[roster/preview-conflicts POST] shifts', shiftError)
    return NextResponse.json({ error: shiftError.message }, { status: 500 })
  }

  const shiftMap = new Map(((shifts ?? []) as ShiftRow[]).map((shift) => [shift.id, shift]))
  const windows = withWindows([...scopedDrafts, ...existing], shiftMap)
  const draftWindows = windows.filter((assignment) => assignment.source === 'draft')
  const conflicts: Record<string, unknown>[] = []

  for (const draft of draftWindows) {
    for (const other of windows) {
      if (draft.id === other.id || draft.employee_id !== other.employee_id || draft.date !== other.date) continue
      if (!overlaps(draft, other)) continue
      conflicts.push({
        conflict_type: 'roster_shift_overlap',
        severity: 'high',
        employee_id: draft.employee_id,
        date: draft.date,
        draft_id: draft.id,
        source_id: other.id,
        source: other.source,
        message: 'Draft assignment overlaps another shift for the same employee',
        details: {
          draft_shift_id: draft.shift_id,
          source_shift_id: other.shift_id,
          overlap_start: new Date(Math.max(draft.start.getTime(), other.start.getTime())).toISOString(),
          overlap_end: new Date(Math.min(draft.end.getTime(), other.end.getTime())).toISOString(),
        },
      })
    }

    const leave = (leaveResult.data ?? []).find((row) =>
      row.employee_id === draft.employee_id &&
      draft.date >= row.start_date &&
      draft.date <= row.end_date
    )
    if (leave) {
      conflicts.push({
        conflict_type: 'leave_overlap',
        severity: 'high',
        employee_id: draft.employee_id,
        date: draft.date,
        draft_id: draft.id,
        source_id: leave.id,
        message: 'Draft assignment overlaps approved leave',
        details: { leave_type: leave.leave_type, start_date: leave.start_date, end_date: leave.end_date },
      })
    }

    for (const availability of availabilityResult.data ?? []) {
      if (availability.employee_id !== draft.employee_id) continue
      const availabilityDate = draft.date
      const day = new Date(`${availabilityDate}T00:00:00Z`).getUTCDay()
      if (availability.day_of_week !== day) continue
      if (availability.effective_from > availabilityDate) continue
      if (availability.effective_until && availability.effective_until < availabilityDate) continue

      if (!availability.start_time || !availability.end_time) {
        conflicts.push({
          conflict_type: 'availability_overlap',
          severity: 'medium',
          employee_id: draft.employee_id,
          date: draft.date,
          draft_id: draft.id,
          source_id: availability.id,
          message: 'Draft assignment falls on an unavailable day',
          details: { reason: availability.reason },
        })
        continue
      }

      const unavailableStart = toDateTime(availabilityDate, availability.start_time)
      const unavailableEnd = toDateTime(availabilityDate, availability.end_time)
      if (unavailableEnd <= unavailableStart) unavailableEnd.setUTCDate(unavailableEnd.getUTCDate() + 1)
      if (draft.start < unavailableEnd && unavailableStart < draft.end) {
        conflicts.push({
          conflict_type: 'availability_overlap',
          severity: 'medium',
          employee_id: draft.employee_id,
          date: draft.date,
          draft_id: draft.id,
          source_id: availability.id,
          message: 'Draft assignment overlaps unavailable time',
          details: { reason: availability.reason, start_time: availability.start_time, end_time: availability.end_time },
        })
      }
    }
  }

  const uniqueConflicts = new Map(conflicts.map((conflict) => [
    `${conflict.conflict_type}:${conflict.draft_id}:${conflict.source_id}:${conflict.date}`,
    conflict,
  ]))

  return NextResponse.json({
    conflicts: [...uniqueConflicts.values()],
    meta: {
      checked: scopedDrafts.length,
      skipped: drafts.length - scopedDrafts.length,
    },
  })
}
