"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Eye, QrCode } from "lucide-react";
import { ActivationChecklist } from "@/components/activation/activation-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { trackActivationMilestone } from "@/lib/activation-analytics";

export default function GetStartedPage() {
  useEffect(() => {
    void trackActivationMilestone("activation_started");
  }, []);

  return (
    <div className="space-y-8 p-6 md:p-8">
      <PageHeader
        eyebrow="First steps"
        title="Make your next introduction easier to follow up."
        description="Set up the essentials now. You can refine the rest of your page whenever you are ready."
      />
      <ActivationChecklist expanded />
      <Card className="bg-secondary">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-foreground">When your page is ready, make it easy to share.</p>
            <p className="mt-1 text-sm leading-6 text-foreground/75">Preview the page before publishing, then use its link, QR code, and vCard as needed.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/dashboard/profile"><Eye className="h-4 w-4" />Open My Page</Link></Button>
            <Button asChild><Link href="/dashboard/scheduling"><QrCode className="h-4 w-4" />Set up bookings <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
