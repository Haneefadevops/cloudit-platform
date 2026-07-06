"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@cloudit/ui";

export default function LeavePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Leave</h1>
      <Card>
        <CardHeader>
          <CardTitle>Leave management</CardTitle>
          <CardDescription>This module is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Leave requests, balances, and approvals will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
