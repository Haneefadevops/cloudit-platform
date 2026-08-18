import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Profile, ProfileInput, PublicProfile } from "@/lib/contracts";

export function useMyProfile() {
  return useQuery<Profile | null>({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const result = await apiFetch<Profile>("/v2/profiles/me");
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const result = await apiFetch<Profile>("/v2/profiles/me", {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function usePublicProfile(slug: string) {
  return useQuery<PublicProfile>({
    queryKey: ["profile", "public", slug],
    queryFn: async () => {
      const result = await apiFetch<PublicProfile>(`/v2/profiles/${slug}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
