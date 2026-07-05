import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type FeatureFlag = {
  featureKey: string;
  enabled: boolean;
};

export type WhiteLabelConfig = {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  dateFormat: string;
  currency: string;
  supportEmail: string | null;
};

const DEFAULT_WHITE_LABEL: WhiteLabelConfig = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  dateFormat: "DD/MM/YYYY",
  currency: "LKR",
  supportEmail: null,
};

/**
 * Fetch feature flags for the current organization.
 *
 * NOTE: The OrbitOne backend does not yet expose an endpoint for the
 * Platform-managed OrganizationFeatureFlag config. This hook calls the
 * intended contract (`GET /v2/organizations/feature-flags`) and falls back
 * to an empty list until the endpoint is implemented.
 */
export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ["organization", "feature-flags"],
    queryFn: async () => {
      const result = await apiFetch<FeatureFlag[]>("/v2/organizations/feature-flags");
      if (!result.ok) {
        // Silently fall back when the endpoint is not implemented.
        return [];
      }
      return result.data;
    },
  });
}

export function useIsFeatureEnabled(featureKey: string) {
  const { data = [] } = useFeatureFlags();
  return data.some((f) => f.featureKey === featureKey && f.enabled);
}

/**
 * Fetch white-label config for the current organization.
 *
 * NOTE: The OrbitOne backend does not yet expose a dedicated white-label
 * endpoint. This hook calls the intended contract
 * (`GET /v2/organizations/white-label`) and falls back to defaults.
 */
export function useWhiteLabel() {
  return useQuery<WhiteLabelConfig>({
    queryKey: ["organization", "white-label"],
    queryFn: async () => {
      const result = await apiFetch<WhiteLabelConfig>("/v2/organizations/white-label");
      if (!result.ok) {
        return DEFAULT_WHITE_LABEL;
      }
      return { ...DEFAULT_WHITE_LABEL, ...result.data };
    },
  });
}
