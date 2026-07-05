"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MoreHorizontal, Plus, RefreshCcw, Settings, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { handleApiError } from "@/lib/api-client";
import {
  onboardingApi,
  type OnboardingOrganization,
  type OrganizationProvisioning,
  formatStatus,
  getStatusBadgeVariant,
} from "@/lib/onboarding";

export default function OnboardingListPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = React.useState<OnboardingOrganization[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionIds, setActionIds] = React.useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const data = await onboardingApi.list();
      setOrganizations(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  function setAction(id: string, active: boolean) {
    setActionIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleResend(orgId: string, product: string) {
    const actionId = `resend-${orgId}-${product}`;
    setAction(actionId, true);
    try {
      await onboardingApi.resend(orgId, product);
      toast.success("Invite resent");
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setAction(actionId, false);
    }
  }

  async function handleRetry(orgId: string, product: string) {
    const actionId = `retry-${orgId}-${product}`;
    setAction(actionId, true);
    try {
      await onboardingApi.retry(orgId, product);
      toast.success("Provisioning retried");
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setAction(actionId, false);
    }
  }

  async function handleRevoke(orgId: string, product: string) {
    const actionId = `revoke-${orgId}-${product}`;
    setAction(actionId, true);
    try {
      await onboardingApi.revoke(orgId, product);
      toast.success("Invite revoked");
      await load();
    } catch (error) {
      handleApiError(error);
    } finally {
      setAction(actionId, false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onboarding Status</h1>
          <p className="text-muted-foreground">Track provisioned organizations and manage invites.</p>
        </div>
        <Button asChild className="min-h-[44px]">
          <Link href="/dashboard/onboarding">
            <Plus className="mr-2 h-4 w-4" />
            New Onboarding
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>Overview of all onboarded clients and their provisioning status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-4 text-center">
              <p className="text-muted-foreground">No organizations onboarded yet.</p>
              <Button asChild>
                <Link href="/dashboard/onboarding">Onboard your first client</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Invited Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) =>
                    (org.provisioning?.length ? org.provisioning : [null]).map((prov, index) => (
                      <TableRow key={`${org.id}-${prov?.product ?? "none"}`}>
                        {index === 0 && (
                          <TableCell rowSpan={org.provisioning?.length || 1} className="font-medium">
                            {org.name}
                            <p className="text-xs text-muted-foreground">{org.slug}</p>
                          </TableCell>
                        )}
                        <TableCell className="capitalize">{prov?.product ?? "—"}</TableCell>
                        <TableCell>{prov?.invitedEmail ?? "—"}</TableCell>
                        <TableCell>
                          {prov ? (
                            <Badge variant={getStatusBadgeVariant(prov.status)}>
                              {formatStatus(prov.status)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No provisioning</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {prov?.invitedAt ? new Date(prov.invitedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {prov && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={actionIds.size > 0}>
                                  {actionIds.has(`resend-${org.id}-${prov.product}`) ||
                                  actionIds.has(`retry-${org.id}-${prov.product}`) ||
                                  actionIds.has(`revoke-${org.id}-${prov.product}`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(prov.status === "pending" ||
                                  prov.status === "provisioned" ||
                                  prov.status === "invite_sent" ||
                                  prov.status === "failed") && (
                                  <DropdownMenuItem
                                    onClick={() => handleResend(org.id, prov.product)}
                                    disabled={actionIds.size > 0}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Resend invite
                                  </DropdownMenuItem>
                                )}
                                {prov.status === "failed" && (
                                  <DropdownMenuItem
                                    onClick={() => handleRetry(org.id, prov.product)}
                                    disabled={actionIds.size > 0}
                                  >
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Retry provisioning
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => router.push(`/dashboard/onboarding/customize?orgId=${org.id}`)}
                                >
                                  <Settings className="mr-2 h-4 w-4" />
                                  Customize
                                </DropdownMenuItem>
                                {(prov.status === "pending" ||
                                  prov.status === "provisioned" ||
                                  prov.status === "invite_sent" ||
                                  prov.status === "failed") && (
                                  <DropdownMenuItem
                                    onClick={() => handleRevoke(org.id, prov.product)}
                                    disabled={actionIds.size > 0}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Revoke invite
                                  </DropdownMenuItem>
                                )}
                                {prov.status === "activated" && (
                                  <DropdownMenuItem disabled>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Activated
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
