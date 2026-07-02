import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useMyOrganization,
  useCreateOrganization,
  useUpdateOrganization,
} from "@/hooks/useOrganizations";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Users } from "lucide-react";

export function OrganizationPage() {
  const { data: organization, isLoading } = useMyOrganization();
  const { state } = useAuth();
  const isAdmin = state.status === "authenticated" && state.user.role === "admin";

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organization</h1>
        <p className="text-muted">Manage your business account.</p>
      </div>

      {organization ? (
        <>
          <OrganizationDetails organization={organization} />
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team members
                </CardTitle>
                <CardDescription>
                  Invite staff or create staff profiles for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/dashboard/organization/members">Manage team</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <CreateOrganizationForm />
      )}
    </div>
  );
}

function OrganizationDetails({ organization }: { organization: { slug: string; name: string; industry: string | null; plan: string; planStatus: string } }) {
  const update = useUpdateOrganization();
  const form = useForm({
    defaultValues: {
      name: organization.name,
      industry: organization.industry ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: organization.name,
      industry: organization.industry ?? "",
    });
  }, [organization, form]);

  async function onSubmit(values: { name: string; industry: string }) {
    await update.mutateAsync({
      name: values.name,
      industry: values.industry || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {organization.name}
        </CardTitle>
        <CardDescription>
          <Badge variant="secondary">{organization.plan.replace(/_/g, " ")}</Badge>
          <span className="ml-2 text-muted">/{organization.slug}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input id="industry" {...form.register("industry")} />
          </div>
          {update.isError && <p className="text-sm text-error">{update.error?.message}</p>}
          {update.isSuccess && <p className="text-sm text-success">Organization updated.</p>}
          <Button type="submit" isLoading={update.isPending}>
            Save changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateOrganizationForm() {
  const create = useCreateOrganization();
  const form = useForm({
    defaultValues: {
      slug: "",
      name: "",
      industry: "",
    },
  });

  async function onSubmit(values: { slug: string; name: string; industry: string }) {
    await create.mutateAsync({
      slug: values.slug,
      name: values.name,
      industry: values.industry || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create organization</CardTitle>
        <CardDescription>
          Convert your freelancer account into a business account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" {...form.register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...form.register("slug", { required: true })} placeholder="your-business" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry (optional)</Label>
            <Input id="industry" {...form.register("industry")} />
          </div>
          {create.isError && <p className="text-sm text-error">{create.error?.message}</p>}
          <Button type="submit" isLoading={create.isPending}>
            Create organization
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
