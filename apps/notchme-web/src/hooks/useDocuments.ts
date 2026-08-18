import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Document, DocumentInput, DocumentStatusUpdate } from "@/lib/contracts";

export function useCustomerDocuments(customerId: string | undefined) {
  return useQuery<Document[]>({
    queryKey: ["customers", customerId, "documents"],
    queryFn: async () => {
      const result = await apiFetch<Document[]>(`/v2/customers/${customerId}/documents`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!customerId,
  });
}

export function useCreateDocument(customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Document, Error, DocumentInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<Document>(`/v2/customers/${customerId}/documents`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", customerId, "documents"] });
      qc.invalidateQueries({ queryKey: ["customers", customerId, "activities"] });
    },
  });
}

export function useUpdateDocumentStatus(documentId: string | undefined, customerId: string | undefined) {
  const qc = useQueryClient();
  return useMutation<Document, Error, DocumentStatusUpdate>({
    mutationFn: async ({ status }) => {
      const result = await apiFetch<Document>(`/v2/documents/${documentId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", customerId, "documents"] });
      qc.invalidateQueries({ queryKey: ["customers", customerId, "activities"] });
    },
  });
}

export async function downloadDocument(documentId: string, title: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
  const response = await fetch(`${base}/v2/documents/${documentId}/download`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to download document.");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
