import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — CloudIT Hospitality",
};

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hospitality Dashboard</h1>
      <p className="text-muted-foreground">Dashboard home placeholder</p>
    </div>
  );
}
