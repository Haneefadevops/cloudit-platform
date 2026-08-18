"use client"

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCustomers, useDefaultPipeline } from "@/hooks/useCRM";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Customer, Priority } from "@/lib/contracts";

const priorityVariant: Record<Priority, BadgeProps["variant"]> = {
  low: "outline",
  medium: "accent",
  high: "error",
};

function formatCurrency(value: number | null | undefined, currency: string | null | undefined) {
  if (!value) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency ?? "LKR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PipelinePage() {
  const { data: customers = [], isLoading: customersLoading, error } = useCustomers();
  const { data: pipeline, isLoading: pipelineLoading } = useDefaultPipeline();
  const qc = useQueryClient();

  const move = useMutation<Customer, Error, { customerId: string; pipelineStageId: string }>({
    mutationFn: async ({ customerId, pipelineStageId }) => {
      const result = await apiFetch<Customer>(`/v2/customers/${customerId}/stage`, {
        method: "PUT",
        body: JSON.stringify({ pipelineStageId }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  const isLoading = customersLoading || pipelineLoading;

  const stages = pipeline?.stages ?? [];
  const byStage = stages.reduce<Record<string, Customer[]>>((acc, stage) => {
    acc[stage.id] = customers.filter((c) => c.pipelineStageId === stage.id);
    return acc;
  }, {});

  const totalValue = customers.reduce((sum, c) => sum + (c.valueAmount ?? 0), 0);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pipeline</h1>
          <p className="text-muted">Kanban view of customers by pipeline stage.</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            Pipeline value: <span className="font-medium text-foreground">{formatCurrency(totalValue, "LKR")}</span>
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <GlassCard className="mt-6 text-center">
          <p className="text-error">Failed to load pipeline.</p>
        </GlassCard>
      ) : stages.length === 0 ? (
        <GlassCard className="mt-6 text-center">
          <p className="text-muted">No pipeline configured.</p>
        </GlassCard>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              customers={byStage[stage.id] ?? []}
              onDropCustomer={(customerId) => move.mutate({ customerId, pipelineStageId: stage.id })}
              isMoving={move.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StageColumn({
  stage,
  customers,
  onDropCustomer,
  isMoving,
}: {
  stage: { id: string; name: string };
  customers: Customer[];
  onDropCustomer: (customerId: string) => void;
  isMoving: boolean;
}) {
  const stageValue = customers.reduce((sum, c) => sum + (c.valueAmount ?? 0), 0);

  return (
    <div
      className="flex w-72 min-w-[18rem] flex-col rounded-3xl border border-border bg-surface/60 backdrop-blur-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const customerId = e.dataTransfer.getData("customerId");
        if (customerId && customerId !== e.dataTransfer.getData("sourceStageId")) {
          onDropCustomer(customerId);
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{stage.name}</Badge>
          <span className="text-sm text-muted">{customers.length}</span>
        </div>
        <span className="text-xs font-medium text-muted">
          {formatCurrency(stageValue, "LKR") ?? "—"}
        </span>
      </div>
      <div className={`flex-1 space-y-3 p-3 ${isMoving ? "opacity-60" : ""}`}>
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-elevated/40 p-4 text-center">
            <p className="text-xs text-muted">No customers</p>
          </div>
        ) : (
          customers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} />
          ))
        )}
      </div>
    </div>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Link href={`/dashboard/customers/${customer.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("customerId", customer.id);
      }}
      className="block cursor-move rounded-2xl border border-border bg-surface-elevated/60 p-4 transition-colors hover:border-secondary/50 hover:bg-surface-elevated"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{customer.fullName}</p>
          {customer.company && (
            <p className="truncate text-xs text-muted">{customer.company}</p>
          )}
        </div>
        <Badge variant={priorityVariant[customer.priority]} className="text-[10px]">
          {customer.priority}
        </Badge>
      </div>
      {customer.valueAmount ? (
        <p className="mt-3 text-sm font-semibold text-foreground">
          {formatCurrency(customer.valueAmount, customer.valueCurrency)}
        </p>
      ) : null}
      {customer.expectedCloseDate && (
        <p className="mt-2 text-xs text-muted">
          Close: {new Date(customer.expectedCloseDate).toLocaleDateString()}
        </p>
      )}
    </Link>
  );
}
