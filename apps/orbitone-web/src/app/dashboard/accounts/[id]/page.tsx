"use client"

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAccountConnections,
  useRequestConnection,
  useRespondConnection,
  useLinkCustomerToAccount,
  useDirectory,
} from "@/hooks/useAccounts";
import { useCustomers } from "@/hooks/useCRM";
import type { Account, AccountLifecycleStage, AccountConnection } from "@/lib/contracts";
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  Trash2,
  Plus,
  Users,
  Link2,
  CheckCircle,
  XCircle,
} from "lucide-react";

const lifecycleVariant: Record<AccountLifecycleStage, BadgeProps["variant"]> = {
  prospect: "outline",
  qualified: "secondary",
  customer: "success",
  churned: "outline",
  archived: "outline",
};

const lifecycleStages: AccountLifecycleStage[] = ["prospect", "qualified", "customer", "churned", "archived"];

function lifecycleLabel(stage: AccountLifecycleStage) {
  return stage.replace(/_/g, " ");
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useAccount(id);
  const deleteAccount = useDeleteAccount();
  const [isEditing, setIsEditing] = useState(false);

  const onDelete = async () => {
    if (!id) return;
    if (confirm("Delete this account? Linked contacts will be unassigned.")) {
      await deleteAccount.mutateAsync(id);
      router.push("/dashboard/accounts");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-error">Account not found.</p>
        <Button className="mt-4" asChild>
          <Link href="/dashboard/accounts">Back to accounts</Link>
        </Button>
      </div>
    );
  }

  const { account, contacts } = data;
  const publicUrl = `${window.location.origin}/a/${account.slug}`;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/accounts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-primary">{account.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={lifecycleVariant[account.lifecycleStage]}>
              {lifecycleLabel(account.lifecycleStage)}
            </Badge>
            {account.isPublic && <Badge variant="accent">Public</Badge>}
            <span className="text-xs text-muted">/{account.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account.isPublic && (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Public page
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={deleteAccount.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AccountInfo account={account} />
          <ContactsCard accountId={account.id} contacts={contacts} />
        </div>
        <div className="space-y-6">
          <ConnectionsCard accountId={account.id} />
        </div>
      </div>

      <EditAccountDialog account={account} open={isEditing} onClose={() => setIsEditing(false)} />
    </div>
  );
}

function AccountInfo({ account }: { account: Account }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Account details
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Info label="Industry" value={account.industry} />
        <Info label="Website" value={account.website} />
        <Info label="Tax ID" value={account.taxId} />
        <Info label="Billing address" value={account.billingAddress} />
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function ContactsCard({ accountId, contacts }: { accountId: string; contacts: import("@/lib/contracts").Customer[] }) {
  const [open, setOpen] = useState(false);
  const { data: customers = [] } = useCustomers();
  const link = useLinkCustomerToAccount(accountId);
  const available = customers.filter((c) => !c.accountId && c.organizationId);

  const handleLink = async (customerId: string) => {
    await link.mutateAsync({ customerId });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </span>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Link contact
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted">No linked contacts yet.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between rounded-xl bg-surface-elevated/40 p-3">
                <Link href={`/dashboard/customers/${contact.id}`} className="font-medium text-foreground hover:underline">
                  {contact.fullName}
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => link.mutateAsync({ customerId: contact.id, unlink: true })}
                  isLoading={link.isPending}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {available.length === 0 ? (
              <p className="text-sm text-muted">No unassigned contacts available.</p>
            ) : (
              available.map((customer) => (
                <Button
                  key={customer.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleLink(customer.id)}
                >
                  {customer.fullName}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ConnectionsCard({ accountId }: { accountId: string }) {
  const { data: connections = [], isLoading } = useAccountConnections(accountId);
  const { data: directory = [] } = useDirectory();
  const request = useRequestConnection(accountId);
  const respond = useRespondConnection();
  const [selectedTarget, setSelectedTarget] = useState("");

  const pendingInbound = connections.filter((c) => c.status === "pending" && c.toAccountId === accountId);
  const active = connections.filter((c) => c.status === "accepted");

  const availableTargets = directory.filter((a) => a.id !== accountId && !connections.some((c) => c.otherAccount.id === a.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connections
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select account to connect</option>
            {availableTargets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedTarget}
            onClick={() => {
              if (selectedTarget) request.mutateAsync(selectedTarget);
            }}
            isLoading={request.isPending}
          >
            Connect
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            {pendingInbound.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted">Pending requests</p>
                {pendingInbound.map((connection) => (
                  <ConnectionRow
                    key={connection.id}
                    connection={connection}
                    onAccept={() => respond.mutateAsync({ connectionId: connection.id, status: "accepted" })}
                    onReject={() => respond.mutateAsync({ connectionId: connection.id, status: "rejected" })}
                  />
                ))}
              </div>
            )}
            {active.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted">Connected</p>
                {active.map((connection) => (
                  <ConnectionRow key={connection.id} connection={connection} />
                ))}
              </div>
            )}
            {pendingInbound.length === 0 && active.length === 0 && (
              <p className="text-sm text-muted">No connections yet.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionRow({
  connection,
  onAccept,
  onReject,
}: {
  connection: AccountConnection;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl bg-surface-elevated/40 p-3"
      data-testid={`connection-${connection.otherAccount.slug}`}
    >
      <div>
        <p className="font-medium text-foreground">{connection.otherAccount.name}</p>
        <Badge variant={connection.status === "accepted" ? "success" : "outline"} className="mt-1 text-[10px]">
          {connection.status}
        </Badge>
      </div>
      {connection.status === "pending" && onAccept && onReject && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onAccept} aria-label="Accept connection">
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} aria-label="Reject connection">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EditAccountDialog({
  account,
  open,
  onClose,
}: {
  account: Account;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateAccount(account.id);
  const [form, setForm] = useState<Partial<Account>>(account);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({
      name: form.name,
      slug: form.slug,
      industry: form.industry,
      website: form.website,
      billingAddress: form.billingAddress,
      taxId: form.taxId,
      lifecycleStage: form.lifecycleStage,
      isPublic: form.isPublic,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <div>
            <Label htmlFor="editName">Name</Label>
            <Input
              id="editName"
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="editSlug">Slug</Label>
            <Input
              id="editSlug"
              value={form.slug ?? ""}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editIndustry">Industry</Label>
              <Input
                id="editIndustry"
                value={form.industry ?? ""}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="editLifecycle">Lifecycle</Label>
              <select
                id="editLifecycle"
                value={form.lifecycleStage}
                onChange={(e) => setForm({ ...form, lifecycleStage: e.target.value as AccountLifecycleStage })}
                className="mt-1 block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
              >
                {lifecycleStages.map((s) => (
                  <option key={s} value={s}>
                    {lifecycleLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="editWebsite">Website</Label>
            <Input
              id="editWebsite"
              value={form.website ?? ""}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editBilling">Billing address</Label>
            <Input
              id="editBilling"
              value={form.billingAddress ?? ""}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="editTax">Tax ID</Label>
            <Input
              id="editTax"
              value={form.taxId ?? ""}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="editIsPublic"
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="editIsPublic" className="text-sm font-normal">
              Public profile
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={update.isPending}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
