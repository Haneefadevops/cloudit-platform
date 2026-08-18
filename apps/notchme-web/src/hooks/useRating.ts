import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CustomerRating, SubmitRatingInput } from "@/lib/contracts";

export function useSubmitRating() {
  return useMutation<CustomerRating, Error, SubmitRatingInput>({
    mutationFn: async (input) => {
      const result = await apiFetch<CustomerRating>("/v2/ratings", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
