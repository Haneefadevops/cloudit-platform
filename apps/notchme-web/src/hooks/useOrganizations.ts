import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Organization,
  OrganizationInput,
  OrganizationMember,
  OrganizationInvite,
  InviteStaffInput,
  CreateStaffProfileInput,
  User,
} from "@/lib/contracts";

export function useMyOrganization() {
  return useQuery<Organization | null>({
    queryKey: ["organization", "me"],
    queryFn: async () => {
      const result = await apiFetch<Organization>("/v2/organizations/me");
      if (!result.ok) {
        if (result.error === "Organization not found.") return null;
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrganizationInput) => {
      const result = await apiFetch<Organization>("/v2/organizations", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "me"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OrganizationInput>) => {
      const result = await apiFetch<Organization>("/v2/organizations/me", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "me"] });
    },
  });
}

export function useOrganizationMembers() {
  return useQuery<OrganizationMember[]>({
    queryKey: ["organization", "members"],
    queryFn: async () => {
      const result = await apiFetch<OrganizationMember[]>("/v2/organizations/members");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useInviteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteStaffInput) => {
      const result = await apiFetch<OrganizationInvite>("/v2/organizations/invites", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "members"] });
    },
  });
}

export function useCreateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStaffProfileInput) => {
      const result = await apiFetch<{ user: User; profile: { slug: string } }>(
        "/v2/organizations/staff-profiles",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "members"] });
    },
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async ({
      token,
      password,
      fullName,
    }: {
      token: string;
      password: string;
      fullName?: string;
    }) => {
      const result = await apiFetch<User>("/v2/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password, fullName }),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
