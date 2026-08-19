import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type BillingStatus = {
  provider: "stripe";
  checkoutEnabled: boolean;
  products: {
    foundingPro: { monthly: boolean; annual: boolean };
    teams: { monthly: boolean; annual: boolean };
  };
  subscription: null | {
    product: "founding_pro" | "teams";
    interval: "monthly" | "annual";
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canManage: boolean;
  };
  taxNotice: string;
};

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const result = await apiFetch<BillingStatus>("/v2/billing/status");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (selection: {
      product: "founding_pro" | "teams";
      interval: "monthly" | "annual";
    }) => {
      const result = await apiFetch<{ url: string }>("/v2/billing/checkout", {
        method: "POST",
        body: JSON.stringify(selection),
      });
      if (!result.ok) throw new Error(result.error);
      window.location.assign(result.data.url);
    },
  });
}

export function useCreateBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const result = await apiFetch<{ url: string }>("/v2/billing/portal", {
        method: "POST",
      });
      if (!result.ok) throw new Error(result.error);
      window.location.assign(result.data.url);
    },
  });
}
