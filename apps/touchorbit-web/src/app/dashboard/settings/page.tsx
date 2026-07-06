"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@cloudit/ui";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>This module is coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configure your organization profile, working hours, and preferences here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
