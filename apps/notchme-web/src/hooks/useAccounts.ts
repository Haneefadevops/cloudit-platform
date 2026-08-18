import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Account,
  AccountInput,
  AccountWithContacts,
  AccountConnection,
  Customer,
} from "@/lib/contracts";

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const result = await apiFetch<Account[]>("/v2/accounts");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useAccount(id: string | undefined) {
  return useQuery<AccountWithContacts>({
    queryKey: ["accounts", id],
    queryFn: async () => {
      const result = await apiFetch<AccountWithContacts>(`/v2/accounts/${id}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation<Account, Error, AccountInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Account>("/v2/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Account, Error, Partial<AccountInput>>({
    mutationFn: async (input) => {
      const result = await apiFetch<Account>(`/v2/accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["accounts", id] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const result = await apiFetch(`/v2/accounts/${id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useAccountConnections(id: string | undefined) {
  return useQuery<AccountConnection[]>({
    queryKey: ["accounts", id, "connections"],
    queryFn: async () => {
      const result = await apiFetch<AccountConnection[]>(`/v2/accounts/${id}/connections`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!id,
  });
}

export function useRequestConnection(accountId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<AccountConnection, Error, string>({
    mutationFn: async (toAccountId) => {
      const result = await apiFetch<AccountConnection>(`/v2/accounts/${accountId}/connect`, {
        method: "POST",
        body: JSON.stringify({ toAccountId }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts", accountId, "connections"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useRespondConnection() {
  const qc = useQueryClient();
  return useMutation<AccountConnection, Error, { connectionId: string; status: "accepted" | "rejected" }>({
    mutationFn: async ({ connectionId, status }) => {
      const result = await apiFetch<AccountConnection>(`/v2/accounts/connections/${connectionId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDirectory(search?: string, industry?: string) {
  return useQuery<Account[]>({
    queryKey: ["accounts", "directory", { search, industry }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (industry) params.set("industry", industry);
      const query = params.toString() ? `?${params.toString()}` : "";
      const result = await apiFetch<Account[]>(`/v2/accounts/directory${query}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function usePublicAccount(slug: string | undefined) {
  return useQuery<Account>({
    queryKey: ["accounts", "public", slug],
    queryFn: async () => {
      const result = await apiFetch<Account>(`/v2/accounts/public/${slug}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!slug,
  });
}

export function useLinkCustomerToAccount(accountId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Customer, Error, { customerId: string; unlink?: boolean }>({
    mutationFn: async ({ customerId, unlink }) => {
      const result = await apiFetch<Customer>(`/v2/accounts/${accountId}/customers/${customerId}`, {
        method: unlink ? "DELETE" : "PUT",
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts", accountId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
