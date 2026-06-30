"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAcceptInvite } from "@/hooks/useOrganizations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface p-4"><Card className="w-full max-w-md"><CardContent className="p-6 text-center"><p className="text-muted">Loading...</p></CardContent></Card></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") ?? "";
  const accept = useAcceptInvite();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm({
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: { fullName: string; password: string; confirmPassword: string }) {
    if (values.password !== values.confirmPassword) {
      form.setError("confirmPassword", { message: "Passwords do not match." });
      return;
    }
    await accept.mutateAsync({ token, password: values.password, fullName: values.fullName });
    setSubmitted(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-error">Invalid invite link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted && accept.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-success">Invite accepted. Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <Input id="fullName" {...form.register("fullName", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...form.register("password", { required: true, minLength: 8 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register("confirmPassword", { required: true })}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-error">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            {accept.isError && (
              <p className="text-sm text-error">{accept.error?.message ?? "Could not accept invite."}</p>
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
