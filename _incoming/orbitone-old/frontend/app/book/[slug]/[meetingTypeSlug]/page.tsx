"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { LoadingState } from "@/components/empty-states";

export default function LegacyBookingRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const meetingTypeSlug = params.meetingTypeSlug as string;

  useEffect(() => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("type", meetingTypeSlug);
    router.replace(`/book/${slug}?${query.toString()}`);
  }, [router, slug, meetingTypeSlug, searchParams]);

  return (
    <PublicShell className="flex items-center justify-center py-12">
      <LoadingState message="Loading booking calendar..." />
    </PublicShell>
  );
}
