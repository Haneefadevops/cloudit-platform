"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVerifyEmail } from "@/hooks/useAuthActions";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const verify = useVerifyEmail();
  const { refresh } = useAuth();
  useEffect(
    () =>
      setToken(new URLSearchParams(window.location.search).get("token") ?? ""),
    [],
  );
  const submit = async () => {
    await verify.mutateAsync(token);
    await refresh();
  };
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {verify.isSuccess ? (
            <>
              <p role="status" className="text-sm text-muted">
                Your email is verified. Your workspace is ready.
              </p>
              <Button asChild>
                <Link href="/dashboard/get-started">Continue</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                Confirm this email address before using the private workspace.
              </p>
              <Button
                onClick={submit}
                disabled={!token}
                isLoading={verify.isPending}
              >
                Verify email
              </Button>
              {!token && (
                <p role="alert" className="text-sm text-error">
                  This verification link is missing its token.
                </p>
              )}
              {verify.isError && (
                <p role="alert" className="text-sm text-error">
                  {verify.error.message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
