"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingForm } from "@/components/rating/rating-form";
import { useFeedbackTokenInfo } from "@/hooks/useFeedback";
import { useState } from "react";
import { CheckCircle, MessageSquare } from "lucide-react";

export default function FeedbackPage() {
  const { token } = useParams<{ token: string }>();
  const { data: info, isLoading, error } = useFeedbackTokenInfo(token ?? "");
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-error">Feedback request not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MessageSquare className="h-8 w-8" />
            </div>
          </div>
          <CardTitle>How was your experience?</CardTitle>
          <CardDescription>Share feedback for {info.customerName}.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <p className="font-medium text-primary">Thank you for your feedback!</p>
            </div>
          ) : (
            <RatingForm
              profileId={info.profileId}
              customerId={info.customerId}
              bookingId={info.bookingId ?? undefined}
              feedbackToken={token}
              onSuccess={() => setSubmitted(true)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
