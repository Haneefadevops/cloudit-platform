import { supabase } from './supabase'

// Notify an employee by their employee_id (looks up their user_id automatically)
export async function notifyEmployee(
  orgId: string,
  employeeId: string,
  type: string,
  title: string,
  message: string
) {
  try {
    const { data: emp } = await supabase
      .from('employees')
      .select('user_id')
      .eq('id', employeeId)
      .single()

    if (!emp?.user_id) return

    await supabase.from('notifications').insert({
      organization_id: orgId,
      user_id: emp.user_id,
      type,
      title,
      message,
    })
  } catch (e) {
    console.error('notifyEmployee failed:', e)
  }
}
