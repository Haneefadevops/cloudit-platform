import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  useOrganizationMembers,
  useInviteStaff,
  useCreateStaffProfile,
  useMyOrganization,
} from "@/hooks/useOrganizations";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Building2, Mail, UserPlus, Users } from "lucide-react";

export function OrganizationMembersPage() {
  const { state } = useAuth();
  const { data: organization, isLoading: orgLoading } = useMyOrganization();
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
  } = useOrganizationMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);

  const user = state.status === "authenticated" ? state.user : null;
  const isAdmin = user?.role === "admin";

  if (orgLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Team members</h1>
          <p className="text-muted">Admins, staff, and invited users.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create an organization first
            </CardTitle>
            <CardDescription>
              To invite staff or create user profiles, you need to set up an organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard/organization">Set up organization</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Team members</h1>
          <p className="text-muted">Admins, staff, and invited users.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Invite
            </Button>
            <Button size="sm" onClick={() => setStaffOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add staff
            </Button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <Card className="border-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <p className="text-sm">
              Only organization admins can invite staff or create user profiles.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <InviteForm onClose={() => setInviteOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff profile</DialogTitle>
          </DialogHeader>
          <StaffForm onClose={() => setStaffOpen(false)} />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {membersLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : membersError ? (
            <p className="text-sm text-error">
              Could not load members. Make sure you are an admin of an organization.
            </p>
          ) : members?.length === 0 ? (
            <p className="text-muted">No members yet.</p>
          ) : (
            members?.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <Avatar src={member.profile?.avatarUrl} fallback={member.user.fullName} size="sm" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{member.user.fullName}</p>
                  <p className="text-sm text-muted">{member.user.email}</p>
                </div>
                <Badge variant={member.user.role === "admin" ? "secondary" : "outline"}>
                  {member.user.role}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const invite = useInviteStaff();
  const form = useForm({ defaultValues: { email: "", role: "staff" as const } });

  async function onSubmit(values: { email: string; role: "staff" | "admin" }) {
    await invite.mutateAsync(values);
    onClose();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inviteEmail">Email</Label>
        <Input id="inviteEmail" type="email" {...form.register("email", { required: true })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inviteRole">Role</Label>
        <select
          id="inviteRole"
          {...form.register("role")}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {invite.isError && <p className="text-sm text-error">{invite.error?.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={invite.isPending}>
          Send invite
        </Button>
      </div>
    </form>
  );
}

function StaffForm({ onClose }: { onClose: () => void }) {
  const create = useCreateStaffProfile();
  const form = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      jobTitle: "",
      department: "",
    },
  });

  async function onSubmit(values: { fullName: string; email: string; jobTitle: string; department: string }) {
    await create.mutateAsync({
      fullName: values.fullName,
      email: values.email,
      jobTitle: values.jobTitle || null,
      department: values.department || null,
    });
    onClose();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="staffName">Full name</Label>
        <Input id="staffName" {...form.register("fullName", { required: true })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="staffEmail">Email</Label>
        <Input id="staffEmail" type="email" {...form.register("email", { required: true })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="staffJobTitle">Job title</Label>
          <Input id="staffJobTitle" {...form.register("jobTitle")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staffDepartment">Department</Label>
          <Input id="staffDepartment" {...form.register("department")} />
        </div>
      </div>
      {create.isError && <p className="text-sm text-error">{create.error?.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={create.isPending}>
          Create staff
        </Button>
      </div>
    </form>
  );
}
