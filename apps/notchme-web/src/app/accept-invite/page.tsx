"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAcceptInvite } from "@/hooks/useOrganizations";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const inviteSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  confirmPassword: z.string().min(1, "Confirm your password"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteSkeleton />}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-muted">Loading…</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") ?? "";
  const accept = useAcceptInvite();
  const { refresh } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  async function onSubmit(values: InviteFormValues) {
    if (values.password !== values.confirmPassword) {
      form.setError("confirmPassword", { message: "Passwords do not match" });
      return;
    }

    try {
      await accept.mutateAsync({ token, password: values.password, fullName: values.fullName });
      setSubmitted(true);
      await refresh();
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      // Error is surfaced via accept.isError
    }
  }

  if (!token) {
    return (
      <ErrorCard
        title="Invalid invite link"
        message="This invite link is missing a token. Please ask your administrator to send a new invite."
      />
    );
  }

  if (submitted && accept.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle size={24} />
            </div>
            <p className="text-lg font-semibold text-success">Invite accepted</p>
            <p className="text-muted">Redirecting to dashboard…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpiredError = accept.error?.message?.toLowerCase().includes("expired");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Accept invite</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName && (
                <p className="text-sm text-error">{form.formState.errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-sm text-error">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-error">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            {accept.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-3 text-sm text-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{isExpiredError ? "Invite expired" : "Could not accept invite"}</p>
                  <p className="text-error/80">
                    {accept.error?.message ?? "Please check your link or request a new invite."}
                  </p>
                </div>
              </div>
            )}

            <Button type="submit" isLoading={accept.isPending} className="w-full">
              Accept invite
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle size={24} />
          </div>
          <p className="text-lg font-semibold text-error">{title}</p>
          <p className="mt-1 text-muted">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
