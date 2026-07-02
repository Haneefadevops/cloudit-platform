"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, getPublicProfileUrl } from "@/lib/api";
import { ProfileForm } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import { useToast } from "@/components/ui/toast";
import type { Profile, ProfileInput } from "@/lib/contracts";

export default function ProfileBuilderPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [isSaving, setIsSaving] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    async function load() {
      const result = await apiFetch<Profile>("/profiles/me");
      if (result.ok) {
        setProfile(result.data);
        setStatus("success");
      } else if (result.error.includes("404") || result.error.includes("not found")) {
        setProfile(null);
        setStatus("success");
      } else {
        setStatus("error");
      }
    }
    load();
  }, []);

  async function handleSubmit(input: ProfileInput) {
    setIsSaving(true);

    const result = await apiFetch<Profile>("/profiles/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });

    if (result.ok) {
      setProfile(result.data);
      show("Profile saved", "success");
    } else {
      show(`Could not save profile: ${result.error}`, "error");
    }

    setIsSaving(false);
  }

  if (status === "loading") {
    return <LoadingState message="Loading your profile..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load profile"
        message="We were unable to load your profile. Please try again."
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  const publicUrl = profile ? getPublicProfileUrl(profile.slug) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile builder</h1>
          <p className="text-muted">
            Create and manage your public digital business card.
          </p>
        </div>
        {publicUrl && (
          <Link href={publicUrl} target="_blank">
            <Button variant="outline" className="w-full sm:w-auto">
              Preview public profile
            </Button>
          </Link>
        )}
      </div>

      {!profile && (
        <EmptyState
          title="No profile yet"
          message="Fill out the form below to create your OrbitOne profile."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            This information will be visible on your public profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            key={profile?.id || "new"}
            profile={profile}
            onSubmit={handleSubmit}
            isLoading={isSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
