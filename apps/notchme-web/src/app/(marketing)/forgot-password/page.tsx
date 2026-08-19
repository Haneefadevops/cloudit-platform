"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/hooks/useAuthActions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useForgotPassword();
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          {request.isSuccess ? (
            <div className="space-y-4">
              <p role="status" className="text-sm text-muted">
                {request.data.message}
              </p>
              <Button asChild variant="outline">
                <Link href="/login">Return to login</Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                request.mutate(email);
              }}
            >
              <p className="text-sm text-muted">
                Enter your account email. The response is intentionally the same
                whether or not an account exists.
              </p>
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button
                className="w-full"
                type="submit"
                isLoading={request.isPending}
              >
                Request reset link
              </Button>
              {request.isError && (
                <p role="alert" className="text-sm text-error">
                  {request.error.message}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
