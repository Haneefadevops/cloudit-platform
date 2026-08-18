"use client"

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccounts, useCreateAccount } from "@/hooks/useAccounts";
import type { Account, AccountLifecycleStage } from "@/lib/contracts";
import { Plus, Briefcase, ExternalLink, Building2 } from "lucide-react";

const lifecycleVariant: Record<AccountLifecycleStage, BadgeProps["variant"]> = {
  prospect: "outline",
  qualified: "secondary",
  customer: "success",
  churned: "outline",
  archived: "outline",
};

function lifecycleLabel(stage: AccountLifecycleStage) {
  return stage.replace(/_/g, " ");
}

export default function AccountsPage() {
  const { data: accounts = [], isLoading, error } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      name,
      slug: slug || undefined,
      industry: industry || null,
      website: website || null,
      isPublic,
    });
    setOpen(false);
    setName("");
    setSlug("");
    setIndustry("");
    setWebsite("");
    setIsPublic(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-48" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-error">Failed to load accounts.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Accounts</h1>
          <p className="text-muted">Manage B2B accounts and partnerships.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted" />
            <p className="mt-3 text-muted">No accounts yet.</p>
            <p className="text-xs text-muted">Create your first B2B account to start tracking contacts and deals.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New account</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="name">Account name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated if empty"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isPublic"
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isPublic" className="text-sm font-normal">
                Public profile (visible in directory)
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={create.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  return (
    <Link href={`/dashboard/accounts/${account.id}`}>
      <Card className="transition-colors hover:border-secondary/50 hover:bg-surface-elevated/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{account.name}</CardTitle>
                <p className="text-xs text-muted">/{account.slug}</p>
              </div>
            </div>
            <Badge variant={lifecycleVariant[account.lifecycleStage]}>{lifecycleLabel(account.lifecycleStage)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {account.industry && <span>{account.industry}</span>}
            {account.website && (
              <a
                href={account.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            )}
            {account.isPublic && <Badge variant="accent">Public</Badge>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
