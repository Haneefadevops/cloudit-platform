import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Customer,
  CustomerInput,
  CustomerActivity,
  CustomerActivityInput,
  CustomerFollowUp,
  CustomerFollowUpInput,
  CRMSummary,
} from "@/lib/contracts";

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const result = await apiFetch<Customer[]>("/v2/customers");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ["customers", id],
    queryFn: async () => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: id.length > 0,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerInput) => {
      const result = await apiFetch<Customer>("/v2/customers", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CustomerInput> }) => {
      const result = await apiFetch<Customer>(`/v2/customers/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiFetch<{ deleted: true }>(`/v2/customers/${id}`, {
        method: "DELETE",
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
  });
}

export function useCustomerActivities(customerId: string) {
  return useQuery<CustomerActivity[]>({
    queryKey: ["customers", customerId, "activities"],
    queryFn: async () => {
      const result = await apiFetch<CustomerActivity[]>(`/v2/customers/${customerId}/activities`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: customerId.length > 0,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, input }: { customerId: string; input: CustomerActivityInput }) => {
      const result = await apiFetch<CustomerActivity>(`/v2/customers/${customerId}/activities`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId, "activities"] });
    },
  });
}

export function useCustomerFollowUps(customerId: string) {
  return useQuery<CustomerFollowUp[]>({
    queryKey: ["customers", customerId, "follow-ups"],
    queryFn: async () => {
      const result = await apiFetch<CustomerFollowUp[]>(`/v2/customers/${customerId}/follow-ups`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: customerId.length > 0,
  });
}

export function useCreateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, input }: { customerId: string; input: CustomerFollowUpInput }) => {
      const result = await apiFetch<CustomerFollowUp>(`/v2/customers/${customerId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId, "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
  });
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      followUpId,
      completed,
    }: {
      customerId: string;
      followUpId: string;
      completed: boolean;
    }) => {
      const result = await apiFetch<CustomerFollowUp>(
        `/v2/customers/${customerId}/follow-ups/${followUpId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ completed }),
        }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId, "follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "summary"] });
    },
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
