import { apiFetch } from "@/lib/api";

export type ActivationMilestone =
  | "activation_started"
  | "activation_profile_completed"
  | "activation_booking_configured"
  | "activation_page_published"
  | "activation_share_opened";

/** Sends only an allow-listed milestone name. Profile and contact content never leave the page. */
export async function trackActivationMilestone(eventType: ActivationMilestone): Promise<void> {
  await apiFetch<undefined>("/v2/analytics/activation", {
    method: "POST",
    body: JSON.stringify({ eventType }),
  });
}
