"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePublicAccount, useAccounts, useRequestConnection } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Globe, Mail, ArrowLeft } from "lucide-react";

export default function PublicAccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: account, isLoading, error } = usePublicAccount(slug ?? "");
  const { state } = useAuth();
  const { data: myAccounts = [] } = useAccounts();
  const request = useRequestConnection(myAccounts[0]?.id);
  const isBusinessUser = state.status === "authenticated" && state.user.plan.startsWith("pro_business");
  const myAccount = myAccounts[0];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-error">Business account not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link href="/directory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Directory
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Briefcase className="h-8 w-8" />
                </div>
                <div>
                  <CardTitle className="text-2xl" data-testid="public-account-name">{account.name}</CardTitle>
                  <p className="text-sm text-muted">/{account.slug}</p>
                </div>
              </div>
              <Badge variant="secondary">{account.lifecycleStage}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {account.industry && <p className="text-muted">{account.industry}</p>}
            {account.website && (
              <a
                href={account.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-secondary hover:underline"
              >
                <Globe className="h-4 w-4" />
                {account.website}
              </a>
            )}
            {account.billingAddress && (
              <p className="text-sm text-muted">{account.billingAddress}</p>
            )}

            {isBusinessUser && myAccount && myAccount.id !== account.id && (
              <Button
                className="w-full"
                onClick={() => request.mutateAsync(account.id)}
                isLoading={request.isPending}
                data-testid="public-connect-button"
              >
                <Mail className="mr-2 h-4 w-4" />
                Connect with {account.name}
              </Button>
            )}
            {!isBusinessUser && (
              <p className="text-center text-xs text-muted">
                <Link href="/login" className="text-secondary hover:underline">
                  Log in
                </Link>{" "}
                with a Pro Business plan to connect.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
