"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@cloudit/ui";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
      <Card>
        <CardHeader>
          <CardTitle>Employee management</CardTitle>
          <CardDescription>This module is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You will be able to add, edit, and manage employee records here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
