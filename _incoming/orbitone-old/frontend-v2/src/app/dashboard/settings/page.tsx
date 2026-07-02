import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Mail, Shield, LogOut, Sparkles, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";

export function SettingsPage() {
  const { state, logout } = useAuth();

  if (state.status === "loading") {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status !== "authenticated") {
    return (
      <div className="p-6">
        <p className="text-muted">Please log in to view settings.</p>
      </div>
    );
  }

  const { user } = state;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Avatar fallback={user.fullName} size="sm" />
            Account
          </CardTitle>
          <CardDescription>Your account details and current plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Full name</p>
              <p className="text-sm font-medium text-foreground">{user.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Email</p>
              <p className="text-sm font-medium text-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Role</p>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted" />
                <p className="text-sm font-medium capitalize text-foreground">{user.role}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Plan</p>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted" />
                <Badge variant="outline" className="capitalize">
                  {user.plan.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link to="/dashboard/upgrade">
                <Sparkles className="mr-2 h-4 w-4" />
                Manage plan
              </Link>
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            CRM configuration
          </CardTitle>
          <CardDescription>Customize fields and pipeline stages.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/dashboard/settings/crm">Open CRM settings</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Support
          </CardTitle>
          <CardDescription>Need help? Contact the OrbitOne team.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            For account and billing questions, reach out to your OrbitOne administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
