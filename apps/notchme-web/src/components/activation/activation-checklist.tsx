"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Check, Circle, ExternalLink, Sparkles } from "lucide-react";
import { useMyProfile } from "@/hooks/useProfile";
import { useMeetingTypes } from "@/hooks/useScheduling";
import { deriveActivationChecklistState } from "@/lib/activation";
import { trackActivationMilestone } from "@/lib/activation-analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  action: string;
};

export function useActivationChecklist() {
  const profileQuery = useMyProfile();
  const meetingTypesQuery = useMeetingTypes();
  const { profileComplete, publicPageReady, bookingConfigured, shareReady } = deriveActivationChecklistState(profileQuery.data, meetingTypesQuery.data);

  useEffect(() => {
    if (profileQuery.isSuccess && profileComplete) void trackActivationMilestone("activation_profile_completed");
    if (meetingTypesQuery.isSuccess && bookingConfigured) void trackActivationMilestone("activation_booking_configured");
    if (profileQuery.isSuccess && shareReady) void trackActivationMilestone("activation_page_published");
  }, [bookingConfigured, meetingTypesQuery.isSuccess, profileComplete, profileQuery.isSuccess, shareReady]);

  const items: ChecklistItem[] = [
    {
      id: "profile",
      title: "Complete your professional details",
      description: "Add a headline so people immediately understand what you do.",
      complete: profileComplete,
      href: "/dashboard/profile?activation=details",
      action: "Edit details",
    },
    {
      id: "page",
      title: "Make your page useful",
      description: "Add a contact method or website to your public page.",
      complete: publicPageReady,
      href: "/dashboard/profile?activation=page",
      action: "Improve My Page",
    },
    {
      id: "booking",
      title: "Add a booking option",
      description: "Create at least one active meeting type for people who want to meet.",
      complete: bookingConfigured,
      href: "/dashboard/scheduling/meeting-types",
      action: "Add meeting type",
    },
    {
      id: "share",
      title: "Publish and share",
      description: "Publish your page, then preview the page people will see.",
      complete: shareReady,
      href: "/dashboard/profile?activation=publish",
      action: "Publish My Page",
    },
  ];

  return {
    items,
    completedCount: items.filter((item) => item.complete).length,
    totalCount: items.length,
    isLoading: profileQuery.isLoading || meetingTypesQuery.isLoading,
    isError: profileQuery.isError || meetingTypesQuery.isError,
    isComplete: items.every((item) => item.complete),
  };
}

export function ActivationChecklist({ className, expanded = false }: { className?: string; expanded?: boolean }) {
  const { items, completedCount, totalCount, isLoading, isError, isComplete } = useActivationChecklist();

  if (isLoading) {
    return <Skeleton className={cn("h-44 w-full rounded-2xl", className)} />;
  }

  if (isError) {
    return (
      <Card className={cn("border-error/30 bg-error-subtle", className)}>
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">Your activation progress is temporarily unavailable.</p>
          <p className="mt-1 text-sm leading-6 text-foreground/75">Your saved profile and booking settings have not been changed. Refresh the page to try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (isComplete && !expanded) {
    return null;
  }

  return (
    <Card className={cn("border-border bg-surface-elevated", className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Get your page ready</CardTitle>
            <CardDescription>Complete the essentials for a useful NotchMe introduction.</CardDescription>
          </div>
          <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            {completedCount} of {totalCount} complete
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className={cn("flex items-start gap-3 rounded-xl border p-4", item.complete ? "border-success/30 bg-success-subtle" : "border-border bg-surface") }>
              <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", item.complete ? "bg-success text-success-foreground" : "text-muted")}>
                {item.complete ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-foreground/75">{item.description}</p>
                {!item.complete && <Button className="mt-3" size="sm" variant="outline" asChild><Link href={item.href}>{item.action}<ExternalLink className="h-3.5 w-3.5" /></Link></Button>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
