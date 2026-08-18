"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDuplicateGroups, useMergeCustomers } from "@/hooks/useCRM";
import { ArrowLeft, Merge } from "lucide-react";

export default function DuplicatesPage() {
  const { data: groups = [], isLoading } = useDuplicateGroups();
  const merge = useMergeCustomers();

  return (
    <div className="p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary">Duplicate customers</h1>
          <p className="text-muted">Review and merge potential duplicates.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-48 w-full" />
      ) : groups.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <p className="text-muted">No duplicate customers found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((group) => (
            <Card key={group.canonicalCustomerId}>
              <CardHeader>
                <CardTitle className="text-base">{group.canonicalName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">{customer.fullName}</p>
                      <p className="text-xs text-muted">
                        {customer.email} {customer.company && `· ${customer.company}`} · {customer.reason}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/customers/${customer.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={() => {
                    const primary = group.canonicalCustomerId;
                    const secondary = group.customers.find((c) => c.id !== primary)?.id;
                    if (secondary) {
                      merge.mutate({ primaryCustomerId: primary, secondaryCustomerId: secondary });
                    }
                  }}
                  disabled={merge.isPending}
                >
                  <Merge className="mr-2 h-4 w-4" />
                  Merge into {group.canonicalName}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
