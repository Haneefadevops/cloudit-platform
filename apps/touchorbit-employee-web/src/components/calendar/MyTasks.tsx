'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { EmptyState, PillBadge } from '@/components/ui-touchorbit'
import { Check, Clock, Plus, CalendarDays, Repeat, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description?: string
  category: 'work' | 'personal' | 'training' | 'compliance'
  due_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  is_recurring: boolean
  assigner?: { first_name: string; last_name: string }
}

interface MyTasksProps {
  onCreateTask?: () => void
  className?: string
}

export function MyTasks({ onCreateTask, className }: MyTasksProps) {
  const { userId, organizationId, isLoaded } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all')

  const loadTasks = useCallback(async () => {
    if (!organizationId || !isLoaded || !userId) return
    setLoading(true)
    try {
      // Get employee ID first
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!emp) {
        setTasks([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('employee_tasks')
        .select(`
          id, title, description, category, due_date, status, is_recurring,
          assigner:users!employee_tasks_assigned_by_fkey(id, first_name, last_name)
        `)
        .eq('organization_id', organizationId)
        .eq('employee_id', emp.id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50)

      if (error) {
        console.error('MyTasks load error:', error)
        setTasks([])
        return
      }

      const mapped = (data || []).map((t: any): Task => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category || 'work',
        due_date: t.due_date,
        status: t.status || 'pending',
        is_recurring: t.is_recurring || false,
        assigner: Array.isArray(t.assigner) ? t.assigner[0] : t.assigner,
      }))

      setTasks(mapped)
    } finally {
      setLoading(false)
    }
  }, [organizationId, isLoaded, userId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  async function handleComplete(taskId: string) {
    try {
      await supabase
        .from('employee_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId)
      toast.success('Task completed!')
      loadTasks()
    } catch {
      toast.error('Failed to complete task')
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'pending') return t.status === 'pending' || t.status === 'in_progress'
    return t.status === filter
  })

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }

  return (
    <div className={cn('bg-white rounded-[24px] p-5 border border-[#F1F0F4] shadow-lg', className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-[#1A1727]">My Tasks</h3>
          <p className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mt-0.5">Track & Complete</p>
        </div>
        {onCreateTask && (
          <button
            onClick={onCreateTask}
            className="w-8 h-8 rounded-xl bg-[#534AB7] text-white flex items-center justify-center hover:bg-[#1E1854] transition-all active:scale-95"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Pending', value: counts.pending, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Done', value: counts.completed, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Overdue', value: counts.overdue, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(stat => (
          <button
            key={stat.label}
            onClick={() => setFilter(stat.label === 'Pending' ? 'pending' : stat.label === 'Done' ? 'completed' : 'overdue')}
            className={cn(
              'py-2 rounded-xl border text-center transition-all',
              stat.color
            )}
          >
            <div className="text-lg font-black">{stat.value}</div>
            <div className="text-[9px] font-black uppercase tracking-wider">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3">
        {(['all', 'pending', 'completed', 'overdue'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all',
              filter === f ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-[#F8F7F9] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState title="No tasks" description={`No ${filter === 'all' ? '' : filter} tasks.`} className="py-6" />
        ) : (
          filteredTasks.map(task => (
            <TaskRow key={task.id} task={task} onComplete={() => handleComplete(task.id)} />
          ))
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const isOverdue = task.status === 'overdue'
  const isCompleted = task.status === 'completed'

  const dueText = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No due date'

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-2xl border transition-all',
        isOverdue ? 'bg-red-50/30 border-red-100' : 'bg-[#F8F7F9]/50 border-[#F1F0F4]'
      )}
    >
      <button
        onClick={onComplete}
        className={cn(
          'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
          isCompleted
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-[#D1D5DB] hover:border-emerald-400 hover:bg-emerald-50'
        )}
      >
        {isCompleted && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold truncate', isCompleted ? 'text-[#9CA3AF] line-through' : 'text-[#1A1727]')}>
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <PillBadge status={task.status} className="text-[8px] px-1.5">{task.status.replace('_', ' ')}</PillBadge>
          <span className={cn('text-[10px] font-medium flex items-center gap-1', isOverdue ? 'text-red-500' : 'text-[#9CA3AF]')}>
            <CalendarDays size={10} /> {dueText}
          </span>
          {task.is_recurring && (
            <span className="text-[10px] text-purple-500 font-medium flex items-center gap-1">
              <Repeat size={10} /> Recurring
            </span>
          )}
        </div>
        {task.assigner && (
          <div className="text-[10px] text-[#9CA3AF] font-medium mt-1">
            Assigned by {task.assigner.first_name} {task.assigner.last_name}
          </div>
        )}
      </div>
    </div>
  )
}
