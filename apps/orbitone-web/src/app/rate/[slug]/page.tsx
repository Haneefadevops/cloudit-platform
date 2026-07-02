"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { RatingForm } from "@/components/rating/rating-form";
import { usePublicProfile } from "@/hooks/useProfile";
import { useState } from "react";
import { CheckCircle } from "lucide-react";

export default function RatePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading } = usePublicProfile(slug ?? "");
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

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-error">Profile not found.</p>
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
            <Avatar src={profile.avatarUrl} fallback={profile.fullName} size="lg" />
          </div>
          <CardTitle>Rate {profile.fullName}</CardTitle>
          <CardDescription>Share your experience to help others.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <p className="font-medium text-primary">Thank you for your feedback!</p>
            </div>
          ) : (
            <RatingForm profileId={profile.id} onSuccess={() => setSubmitted(true)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
