import { api } from "./api-client";

export interface SuperAdminInput {
  email: string;
  firstName: string;
  lastName: string;
}

export interface ModuleToggleInput {
  moduleKey: string;
  enabled?: boolean;
}

export interface CreateOnboardingInput {
  organizationName: string;
  slug?: string;
  product: string;
  superAdmin: SuperAdminInput;
  modules?: ModuleToggleInput[];
  details?: Record<string, unknown>;
}

export interface OrganizationProvisioning {
  id: string;
  orgId: string;
  product: string;
  tenantId: string;
  status: "pending" | "provisioned" | "invite_sent" | "activated" | "failed" | "revoked";
  invitedEmail: string;
  invitedAt?: string;
  activatedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingOrganization {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  logo?: string | null;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  productModules?: Array<{
    id: string;
    orgId: string;
    product: string;
    moduleKey: string;
    enabled: boolean;
  }>;
  provisioning?: OrganizationProvisioning[];
  customFields?: OrganizationCustomField[];
  featureFlags?: OrganizationFeatureFlag[];
}

export interface OrganizationCustomField {
  id: string;
  orgId: string;
  product: string;
  module: string;
  entity: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: "text" | "number" | "date" | "dropdown" | "checkbox";
  options?: Record<string, unknown> | null;
  required: boolean;
  order: number;
  isActive: boolean;
}

export interface UpsertCustomFieldInput {
  product: string;
  module: string;
  entity: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: OrganizationCustomField["fieldType"];
  options?: Record<string, unknown>;
  required?: boolean;
  order?: number;
  isActive?: boolean;
}

export interface OrganizationFeatureFlag {
  id: string;
  orgId: string;
  product: string;
  featureKey: string;
  enabled: boolean;
}

export interface SetFeatureFlagInput {
  product: string;
  featureKey: string;
  enabled: boolean;
}

export interface ProductModuleDefinition {
  key: string;
  label: string;
  description: string;
  clientOnly?: boolean;
  clientOrgIds?: string[];
}

export interface ProductDefinition {
  key: string;
  label: string;
  description: string;
  modules: ProductModuleDefinition[];
}

export const onboardingApi = {
  create: (body: CreateOnboardingInput) =>
    api.post<OnboardingOrganization>("/onboarding", body),

  list: () => api.get<OnboardingOrganization[]>("/onboarding"),

  get: (orgId: string) =>
    api.get<OnboardingOrganization>(`/onboarding/${orgId}`),

  resend: (orgId: string, product?: string) =>
    api.post<OrganizationProvisioning>(`/onboarding/${orgId}/resend`, { product }),

  retry: (orgId: string, product?: string) =>
    api.post<OrganizationProvisioning>(`/onboarding/${orgId}/retry`, { product }),

  revoke: (orgId: string, product?: string) =>
    api.post<OrganizationProvisioning>(`/onboarding/${orgId}/revoke`, { product }),

  getRegistry: () => api.get<ProductDefinition[]>("/modules/registry"),
};

export const customFieldsApi = {
  list: (orgId: string, product?: string, entity?: string) =>
    api.get<OrganizationCustomField[]>(
      `/custom-fields/organizations/${orgId}?${new URLSearchParams({
        ...(product ? { product } : {}),
        ...(entity ? { entity } : {}),
      }).toString()}`
    ),

  upsert: (orgId: string, body: UpsertCustomFieldInput) =>
    api.post<OrganizationCustomField>(`/custom-fields/organizations/${orgId}`, body),

  remove: (orgId: string, id: string) =>
    api.delete<Record<string, unknown>>(`/custom-fields/organizations/${orgId}/${id}`),
};

export const featureFlagsApi = {
  list: (orgId: string, product?: string) =>
    api.get<OrganizationFeatureFlag[]>(
      `/feature-flags/organizations/${orgId}?${new URLSearchParams({
        ...(product ? { product } : {}),
      }).toString()}`
    ),

  set: (orgId: string, body: SetFeatureFlagInput) =>
    api.post<OrganizationFeatureFlag>(`/feature-flags/organizations/${orgId}`, body),

  remove: (orgId: string, id: string) =>
    api.delete<Record<string, unknown>>(`/feature-flags/organizations/${orgId}/${id}`),
};

export function getStatusBadgeVariant(
  status: OrganizationProvisioning["status"]
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" {
  switch (status) {
    case "activated":
      return "success";
    case "invite_sent":
    case "provisioned":
      return "info";
    case "pending":
      return "warning";
    case "failed":
      return "destructive";
    case "revoked":
      return "secondary";
    default:
      return "outline";
  }
}

export function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
