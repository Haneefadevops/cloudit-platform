"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@cloudit/ui";

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
      <Card>
        <CardHeader>
          <CardTitle>Payroll management</CardTitle>
          <CardDescription>This module is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Payroll runs, payslips, and salary calculations will be managed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
