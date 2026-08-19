"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@/hooks/useAuthActions";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const reset = useResetPassword();
  useEffect(
    () =>
      setToken(new URLSearchParams(window.location.search).get("token") ?? ""),
    [],
  );
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {reset.isSuccess ? (
            <div className="space-y-4">
              <p role="status" className="text-sm text-muted">
                Your password was changed and all previous sessions were
                revoked.
              </p>
              <Button asChild>
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                reset.mutate({ token, password });
              }}
            >
              {!token && (
                <p role="alert" className="text-sm text-error">
                  This reset link is missing its token.
                </p>
              )}
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={!token}
                isLoading={reset.isPending}
              >
                Reset password
              </Button>
              {reset.isError && (
                <p role="alert" className="text-sm text-error">
                  {reset.error.message}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
