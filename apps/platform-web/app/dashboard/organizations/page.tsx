"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrgName, setNewOrgName] = useState("");
  const [open, setOpen] = useState(false);

  const fetchOrgs = () => {
    api
      .get("/organizations")
      .then((res: any) => setOrgs(res || []))
      .catch(() => toast.error("Failed to load organizations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    try {
      await api.post("/organizations", { name: newOrgName });
      toast.success("Organization created");
      setNewOrgName("");
      setOpen(false);
      fetchOrgs();
    } catch {
      toast.error("Failed to create organization");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Create Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
              <Button onClick={handleCreate} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org: any) => (
            <Card key={org.id}>
              <CardHeader>
                <CardTitle>{org.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Plan: {org.plan || "free"}</p>
                <p className="text-sm text-muted-foreground">Role: {org.role}</p>
                <p className="text-sm text-muted-foreground">Slug: {org.slug}</p>
              </CardContent>
            </Card>
          ))}
          {orgs.length === 0 && (
            <p className="text-muted-foreground col-span-full">No organizations found.</p>
          )}
        </div>
      )}
    </div>
  );
}
