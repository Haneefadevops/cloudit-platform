"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cloudit/ui";
import { Plus, Sparkles } from "lucide-react";
import { HousekeepingTaskModal } from "@/components/housekeeping-task-modal";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type {
  HousekeepingTask,
  HousekeepingTaskStatus,
  PaginatedResponse,
  Property,
  Room,
} from "@/lib/types";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const taskStatusOptions = statusOptions.filter((option) => option.value);

const statusBadgeVariant: Record<HousekeepingTaskStatus, string> = {
  pending: "secondary",
  in_progress: "default",
  completed: "default",
  cancelled: "outline",
};

const typeLabels: Record<string, string> = {
  checkout_clean: "Checkout Clean",
  stayover_clean: "Stayover Clean",
  deep_clean: "Deep Clean",
  maintenance_followup: "Maintenance Follow-up",
};

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HousekeepingTask | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [taskRes, roomRes, propertyRes] = await Promise.all([
        api.get<PaginatedResponse<HousekeepingTask>>("/housekeeping?limit=1000"),
        api.get<PaginatedResponse<Room>>("/rooms?limit=1000"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
      ]);
      setTasks(taskRes.data);
      setRooms(roomRes.data);
      setProperties(propertyRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const roomNumber = task.room?.roomNumber || "";
    const assignedTo = task.assignedTo || "";
    const matchesSearch =
      roomNumber.toLowerCase().includes(search.toLowerCase()) ||
      assignedTo.toLowerCase().includes(search.toLowerCase()) ||
      typeLabels[task.type].toLowerCase().includes(search.toLowerCase());
    const matchesProperty = propertyFilter ? task.propertyId === propertyFilter : true;
    const matchesStatus = statusFilter ? task.status === statusFilter : true;
    return matchesSearch && matchesProperty && matchesStatus;
  });

  async function handleSubmit(data: Partial<HousekeepingTask>) {
    try {
      if (editingTask) {
        await api.patch(`/housekeeping/${editingTask.id}`, data);
      } else {
        await api.post("/housekeeping", data);
      }
      setModalOpen(false);
      setEditingTask(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleStatusChange(task: HousekeepingTask, status: string) {
    try {
      await api.patch(`/housekeeping/${task.id}`, { status });
      loadData();
    } catch (error) {
      console.error(error);
    }
  }

  const propertyOptions = [
    { value: "", label: "All Properties" },
    ...properties.map((property) => ({ value: property.id, label: property.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Housekeeping" description="Manage room cleaning and turnover work">
        <Button onClick={() => { setEditingTask(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />
            <Select
              options={propertyOptions}
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              className="max-w-xs"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No housekeeping tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          {task.room?.roomNumber || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{task.property?.name || "-"}</TableCell>
                      <TableCell>{typeLabels[task.type]}</TableCell>
                      <TableCell>{task.assignedTo || "-"}</TableCell>
                      <TableCell>{task.dueDate ? formatDate(task.dueDate) : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[task.status] as any}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            options={taskStatusOptions}
                            value={task.status}
                            onChange={(event) => handleStatusChange(task, event.target.value)}
                            className="h-8 w-36"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingTask(task); setModalOpen(true); }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <HousekeepingTaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        rooms={rooms}
        task={editingTask}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
