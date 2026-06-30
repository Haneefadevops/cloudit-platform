"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  category: "work" | "personal" | "training" | "compliance";
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  completedAt?: string;
  assignedBy?: string;
  isRecurring: boolean;
}

export function useTasks() {
  const { organizationId, isLoaded } = useAuth();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!organizationId || !isLoaded) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Try new employee_tasks table first (Phase 1 migration)
      const { data, error } = await supabase
        .from("employee_tasks")
        .select("*")
        .eq("organization_id", organizationId)
        .order("due_date", { ascending: true })
        .limit(50);

      if (error) {
        // Gracefully fall back if table doesn't exist yet
        console.warn("employee_tasks not available yet:", error.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category || "work",
        dueDate: t.due_date,
        status: t.status || "pending",
        completedAt: t.completed_at,
        assignedBy: t.assigned_by,
        isRecurring: t.is_recurring || false,
      }));

      setTasks(mapped);
    } catch (err) {
      console.error("useTasks error:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, isLoaded]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return { tasks, loading, refetch: loadTasks };
}
