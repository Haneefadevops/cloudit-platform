import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Customer,
  CustomerInput,
  CustomerActivity,
  CustomerFollowUp,
  CustomerFollowUpInput,
  CustomerActivityInput,
  CRMSummary,
  CustomerStageHistory,
  CustomerLifecycleInput,
  CustomerAssignInput,
  CustomerCloseInput,
  CustomerOutcome,
  CustomFieldDefinition,
  CustomFieldInput,
  Pipeline,
  PipelineStageInput,
  CustomerStageMoveInput,
} from "@/lib/contracts";

export type CustomerFilters = {
  search?: string;
  lifecycleStage?: Customer["lifecycleStage"];
  priority?: Customer["priority"];
  assignedTo?: string;
  source?: Customer["source"];
  outcome?: Customer["outcome"];
  sortBy?: "createdAt" | "lastContactedAt" | "expectedCloseDate" | "valueAmount";
  sortOrder?: "asc" | "desc";
};

export function useCustomers(filters: CustomerFilters = {}) {
  return useQuery<Customer[]>({
    queryKey: ["customers", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.lifecycleStage) params.set("lifecycleStage", filters.lifecycleStage);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters.source) params.set("source", filters.source);
      if (filters.outcome) params.set("outcome", filters.outcome);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
      const query = params.toString() ? `?${params.toString()}` : "";
      const result = await apiFetch<Customer[]>(`/v2/customers${query}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery<Customer>({
    queryKey: ["customers", id],
    queryFn: async () => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation<Customer, Error, CustomerInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Customer>("/v2/customers", { method: "POST", body: JSON.stringify(input) });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, Partial<CustomerInput>>({
    mutationFn: async (input) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}`, { method: "PUT", body: JSON.stringify(input) });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/customers/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useCustomerStageHistory(customerId: string | undefined) {
  return useQuery<CustomerStageHistory[]>({
    queryKey: ["customers", customerId, "history"],
    queryFn: async () => {
      const result = await apiFetch<CustomerStageHistory[]>(`/v2/customers/${customerId}/history`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!customerId,
  });
}

export function useUpdateCustomerLifecycle(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, CustomerLifecycleInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}/lifecycle`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
      qc.invalidateQueries({ queryKey: ["customers", id, "history"] });
      qc.invalidateQueries({ queryKey: ["customers", id, "activities"] });
      qc.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
  });
}

export function useAssignCustomer(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, CustomerAssignInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}/assign`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useCloseCustomer(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, { outcome: CustomerOutcome; closedReason?: string | null }>({
    mutationFn: async ({ outcome, closedReason }) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}/close`, {
        method: "PUT",
        body: JSON.stringify({ outcome, closedReason } as CustomerCloseInput),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
      qc.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
  });
}

export function useCustomerActivities(customerId: string | undefined) {
  return useQuery<CustomerActivity[]>({
    queryKey: ["customers", customerId, "activities"],
    queryFn: async () => {
      const result = await apiFetch<CustomerActivity[]>(`/v2/customers/${customerId}/activities`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomerActivity(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<CustomerActivity, Error, CustomerActivityInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<CustomerActivity>(`/v2/customers/${customerId}/activities`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", customerId, "activities"] });
      qc.invalidateQueries({ queryKey: ["customers", customerId] });
    },
  });
}

export function useCustomerFollowUps(customerId: string | undefined) {
  return useQuery<CustomerFollowUp[]>({
    queryKey: ["customers", customerId, "follow-ups"],
    queryFn: async () => {
      const result = await apiFetch<CustomerFollowUp[]>(`/v2/customers/${customerId}/follow-ups`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomerFollowUp(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<CustomerFollowUp, Error, CustomerFollowUpInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<CustomerFollowUp>(`/v2/customers/${customerId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers", customerId, "follow-ups"] }),
  });
}

export function useCompleteCustomerFollowUp(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<CustomerFollowUp, Error, { followUpId: string; completed: boolean }>({
    mutationFn: async ({ followUpId, completed }) => {
      const result = await apiFetch<CustomerFollowUp>(
        `/v2/customers/${customerId}/follow-ups/${followUpId}`,
        { method: "PATCH", body: JSON.stringify({ completed }) }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers", customerId, "follow-ups"] }),
  });
}

export function useDeleteCustomerFollowUp(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (followUpId) => {
      const result = await apiFetch(`/v2/customers/${customerId}/follow-ups/${followUpId}`, {
        method: "DELETE",
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers", customerId, "follow-ups"] }),
  });
}

export function useCRMSummary() {
  return useQuery<CRMSummary>({
    queryKey: ["crm", "summary"],
    queryFn: async () => {
      const result = await apiFetch<CRMSummary>("/v2/crm/summary");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCustomFields() {
  return useQuery<CustomFieldDefinition[]>({
    queryKey: ["crm", "custom-fields"],
    queryFn: async () => {
      const result = await apiFetch<CustomFieldDefinition[]>("/v2/crm/custom-fields");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation<CustomFieldDefinition, Error, CustomFieldInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<CustomFieldDefinition>("/v2/crm/custom-fields", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "custom-fields"] }),
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation<CustomFieldDefinition, Error, { id: string } & Partial<CustomFieldInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<CustomFieldDefinition>(`/v2/crm/custom-fields/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "custom-fields"] }),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/crm/custom-fields/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "custom-fields"] }),
  });
}

export function useDefaultPipeline() {
  return useQuery<Pipeline>({
    queryKey: ["crm", "pipelines", "default"],
    queryFn: async () => {
      const result = await apiFetch<Pipeline>("/v2/crm/pipelines/default");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useUpdatePipeline(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Pipeline, Error, { name: string }>({
    mutationFn: async (input) => {
      const result = await apiFetch<Pipeline>(`/v2/crm/pipelines/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "pipelines"] }),
  });
}

export function useCreatePipelineStage(pipelineId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Pipeline["stages"][number], Error, PipelineStageInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Pipeline["stages"][number]>(`/v2/crm/pipelines/${pipelineId}/stages`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "pipelines"] }),
  });
}

export function useUpdatePipelineStage() {
  const qc = useQueryClient();
  return useMutation<Pipeline["stages"][number], Error, { id: string } & Partial<PipelineStageInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<Pipeline["stages"][number]>(`/v2/crm/pipelines/stages/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "pipelines"] }),
  });
}

export function useDeletePipelineStage() {
  const qc = useQueryClient();
  return useMutation<void, Error, { stageId: string; fallbackStageId?: string }>({
    mutationFn: async ({ stageId, fallbackStageId }) => {
      const result = await apiFetch(`/v2/crm/pipelines/stages/${stageId}`, {
        method: "DELETE",
        body: JSON.stringify({ fallbackStageId }),
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "pipelines"] }),
  });
}

export function useMoveCustomerStage(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, CustomerStageMoveInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}/stage`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}


// ============================================================
// Activity types
// ============================================================

import type {
  ActivityTypeDefinition,
  ActivityTypeDefinitionInput,
  CRMTemplate,
  CRMTemplateInput,
  AutomationRule,
  AutomationRuleInput,
  WebhookSubscription,
  WebhookSubscriptionInput,
  BulkActionInput,
  BulkActionResult,
  DuplicateGroup,
  CustomerMergeInput,
  CustomerImportRow,
  CustomerImportResult,
} from "@/lib/contracts";

export function useActivityTypes() {
  return useQuery<ActivityTypeDefinition[]>({
    queryKey: ["crm", "activity-types"],
    queryFn: async () => {
      const result = await apiFetch<ActivityTypeDefinition[]>("/v2/crm/activity-types");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateActivityType() {
  const qc = useQueryClient();
  return useMutation<ActivityTypeDefinition, Error, ActivityTypeDefinitionInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<ActivityTypeDefinition>("/v2/crm/activity-types", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "activity-types"] }),
  });
}

export function useUpdateActivityType() {
  const qc = useQueryClient();
  return useMutation<ActivityTypeDefinition, Error, { id: string } & Partial<ActivityTypeDefinitionInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<ActivityTypeDefinition>(`/v2/crm/activity-types/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "activity-types"] }),
  });
}

export function useDeleteActivityType() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/crm/activity-types/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "activity-types"] }),
  });
}

// ============================================================
// Templates
// ============================================================

export function useTemplates() {
  return useQuery<CRMTemplate[]>({
    queryKey: ["crm", "templates"],
    queryFn: async () => {
      const result = await apiFetch<CRMTemplate[]>("/v2/crm/templates");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation<CRMTemplate, Error, CRMTemplateInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<CRMTemplate>("/v2/crm/templates", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation<CRMTemplate, Error, { id: string } & Partial<CRMTemplateInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<CRMTemplate>(`/v2/crm/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/crm/templates/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "templates"] }),
  });
}

// ============================================================
// Automation rules
// ============================================================

export function useAutomationRules() {
  return useQuery<AutomationRule[]>({
    queryKey: ["crm", "automation"],
    queryFn: async () => {
      const result = await apiFetch<AutomationRule[]>("/v2/crm/automation");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation<AutomationRule, Error, AutomationRuleInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<AutomationRule>("/v2/crm/automation", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "automation"] }),
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation<AutomationRule, Error, { id: string } & Partial<AutomationRuleInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<AutomationRule>(`/v2/crm/automation/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "automation"] }),
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/crm/automation/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "automation"] }),
  });
}

// ============================================================
// Webhooks
// ============================================================

export function useWebhookSubscriptions() {
  return useQuery<WebhookSubscription[]>({
    queryKey: ["crm", "webhooks"],
    queryFn: async () => {
      const result = await apiFetch<WebhookSubscription[]>("/v2/crm/webhooks");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateWebhookSubscription() {
  const qc = useQueryClient();
  return useMutation<WebhookSubscription, Error, WebhookSubscriptionInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<WebhookSubscription>("/v2/crm/webhooks", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "webhooks"] }),
  });
}

export function useUpdateWebhookSubscription() {
  const qc = useQueryClient();
  return useMutation<WebhookSubscription, Error, { id: string } & Partial<WebhookSubscriptionInput>>({
    mutationFn: async ({ id, ...input }) => {
      const result = await apiFetch<WebhookSubscription>(`/v2/crm/webhooks/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "webhooks"] }),
  });
}

export function useDeleteWebhookSubscription() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/crm/webhooks/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "webhooks"] }),
  });
}

// ============================================================
// Bulk actions
// ============================================================

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation<BulkActionResult, Error, BulkActionInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<BulkActionResult>("/v2/customers/bulk", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDuplicateGroups() {
  return useQuery<DuplicateGroup[]>({
    queryKey: ["customers", "duplicates"],
    queryFn: async () => {
      const result = await apiFetch<DuplicateGroup[]>("/v2/customers/duplicates");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useMergeCustomers() {
  const qc = useQueryClient();
  return useMutation<void, Error, CustomerMergeInput>({
    mutationFn: async (input) => {
      const result = await apiFetch("/v2/customers/merge", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", "duplicates"] });
    },
  });
}

export function useImportCustomers() {
  const qc = useQueryClient();
  return useMutation<CustomerImportResult, Error, CustomerImportRow[]>({
    mutationFn: async (rows) => {
      const result = await apiFetch<CustomerImportResult>("/v2/customers/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
