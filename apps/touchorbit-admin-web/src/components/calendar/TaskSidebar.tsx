'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { EmptyState, PillBadge } from '@/components/ui-touchorbit'
import { Check, Clock, Plus, Trash2, Edit3, AlertCircle, CalendarDays, Repeat, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description?: string
  category: 'work' | 'personal' | 'training' | 'compliance'
  due_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  is_recurring: boolean
  employee?: { first_name: string; last_name: string; department?: string }
  assigner?: { first_name: string; last_name: string }
}

interface TaskSidebarProps {
  onCreateTask: () => void
  onEditTask: (task: Task) => void
  className?: string
}

export function TaskSidebar({ onCreateTask, onEditTask, className }: TaskSidebarProps) {
  const { organizationId, isLoaded, isAdmin } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all')

  const loadTasks = useCallback(async () => {
    if (!organizationId || !isLoaded) return
    setLoading(true)
    try {
      const result = await api.get<Task[]>('/employee-tasks?limit=50')
      if (!result.ok) {
        console.error('TaskSidebar load error:', result.error)
        setTasks([])
        return
      }

      const mapped = (result.data || []).map((t: any): Task => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category || 'work',
        due_date: t.due_date,
        status: t.status || 'pending',
        is_recurring: t.is_recurring || false,
        employee: t.employee,
        assigner: t.assigner,
      }))

      setTasks(mapped)
    } finally {
      setLoading(false)
    }
  }, [organizationId, isLoaded])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  async function handleComplete(taskId: string) {
    try {
      const result = await api.patch(`/employee-tasks/${taskId}/complete`, {})
      if (!result.ok) throw new Error(result.error || 'Failed')
      toast.success('Task completed')
      loadTasks()
    } catch {
      toast.error('Failed to complete task')
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Delete this task?')) return
    try {
      const result = await api.del(`/employee-tasks/${taskId}`)
      if (!result.ok) throw new Error(result.error || 'Failed')
      toast.success('Task deleted')
      loadTasks()
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }

  const categoryColors: Record<string, string> = {
    work: 'bg-blue-500',
    personal: 'bg-purple-500',
    training: 'bg-orange-500',
    compliance: 'bg-red-500',
  }

  return (
    <div className={cn('bg-white rounded-[32px] p-6 border border-[#F1F0F4] shadow-xl shadow-purple-900/5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-[#1A1727]">Tasks</h3>
          <p className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mt-0.5">Manage & Track</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateTask}
            className="w-8 h-8 rounded-xl bg-[#534AB7] text-white flex items-center justify-center hover:bg-[#1E1854] transition-all active:scale-95"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-[#F8F7F9] border border-[#F1F0F4] flex items-center justify-center text-[#9CA3AF]">
            <Clock size={14} />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {([
          { id: 'all' as const, label: `All ${counts.all}`, color: 'text-[#534AB7] bg-purple-50 border-purple-200' },
          { id: 'pending' as const, label: `Pending ${counts.pending}`, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { id: 'overdue' as const, label: `Overdue ${counts.overdue}`, color: 'text-red-700 bg-red-50 border-red-200' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all',
              filter === tab.id ? tab.color : 'bg-white border-[#F1F0F4] text-[#9CA3AF] hover:bg-[#F8F7F9]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[#F8F7F9] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState title="No tasks" description={`No ${filter === 'all' ? '' : filter} tasks found.`} className="py-6" />
        ) : (
          filteredTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={() => handleComplete(task.id)}
              onEdit={() => onEditTask(task)}
              onDelete={() => handleDelete(task.id)}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TaskRow({
  task,
  onComplete,
  onEdit,
  onDelete,
  isAdmin,
}: {
  task: Task
  onComplete: () => void
  onEdit: () => void
  onDelete: () => void
  isAdmin: boolean
}) {
  const isOverdue = task.status === 'overdue'
  const isCompleted = task.status === 'completed'

  const dueText = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No due date'

  return (
    <div
      className={cn(
        'group p-3 rounded-2xl border transition-all',
        isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-white border-[#F1F0F4] hover:border-purple-200 hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Complete checkbox */}
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
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-1.5 h-1.5 rounded-full', {
              'bg-blue-500': task.category === 'work',
              'bg-purple-500': task.category === 'personal',
              'bg-orange-500': task.category === 'training',
              'bg-red-500': task.category === 'compliance',
            })} />
            <span className={cn('text-xs font-bold truncate', isCompleted ? 'text-[#9CA3AF] line-through' : 'text-[#1A1727]')}>
              {task.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

          {isAdmin && task.employee && (
            <div className="text-[10px] text-[#9CA3AF] font-medium mt-1 flex items-center gap-1">
              <User size={10} />
              {task.employee.first_name} {task.employee.last_name}
              {task.employee.department && ` · ${task.employee.department}`}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-purple-50 text-[#9CA3AF] hover:text-purple-600 transition-all">
            <Edit3 size={12} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 transition-all">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
