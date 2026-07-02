import { Routes, Route, Navigate } from "react-router-dom";
import { PublicShell } from "@/components/layout/public-shell";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { LandingPage } from "@/app/page";
import { LoginPage } from "@/app/login/page";
import { RegisterPage } from "@/app/register/page";
import { DashboardLayout } from "@/app/dashboard/layout";
import { DashboardHomePage } from "@/app/dashboard/page";
import { ProfilePage } from "@/app/dashboard/profile/page";
import { SchedulingLayout } from "@/app/dashboard/scheduling/layout";
import { SchedulingPage } from "@/app/dashboard/scheduling/page";
import { MeetingTypesPage } from "@/app/dashboard/scheduling/meeting-types/page";
import { AvailabilityPage } from "@/app/dashboard/scheduling/availability/page";
import { BookingsPage } from "@/app/dashboard/scheduling/bookings/page";
import { CalendarPage } from "@/app/dashboard/scheduling/calendar/page";
import { UpgradePage } from "@/app/dashboard/upgrade/page";
import { SettingsPage } from "@/app/dashboard/settings/page";
import { CRMSettingsPage } from "@/app/dashboard/settings/crm/page";
import { AnalyticsPage } from "@/app/dashboard/analytics/page";
import { PublicProfilePage } from "@/app/p/[slug]/page";
import { BookingPage } from "@/app/book/[slug]/page";
import { RatePage } from "@/app/rate/[slug]/page";
import { FeedbackPage } from "@/app/feedback/[token]/page";
import { PublicAccountPage } from "@/app/a/[slug]/page";
import { DirectoryPage } from "@/app/directory/page";
import { NotFoundPage } from "@/app/not-found/page";
import { AcceptInvitePage } from "@/app/accept-invite/page";
import { OrganizationPage } from "@/app/dashboard/organization/page";
import { OrganizationMembersPage } from "@/app/dashboard/organization/members/page";
import { CustomersPage } from "@/app/dashboard/customers/page";
import { PipelinePage } from "@/app/dashboard/customers/pipeline";
import { CustomerDetailPage } from "@/app/dashboard/customers/detail";
import { DuplicatesPage } from "@/app/dashboard/customers/duplicates/page";
import { AccountsPage } from "@/app/dashboard/accounts/page";
import { AccountDetailPage } from "@/app/dashboard/accounts/detail";
import { useAuth } from "@/hooks/useAuth";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (state.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell header={<MarketingHeader />} />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/p/:slug" element={<PublicProfilePage />} />
      <Route path="/book/:slug" element={<BookingPage />} />
      <Route path="/rate/:slug" element={<RatePage />} />
      <Route path="/feedback/:token" element={<FeedbackPage />} />
      <Route path="/a/:slug" element={<PublicAccountPage />} />
      <Route path="/directory" element={<DirectoryPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="scheduling" element={<SchedulingLayout />}>
          <Route index element={<SchedulingPage />} />
          <Route path="meeting-types" element={<MeetingTypesPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
        <Route path="upgrade" element={<UpgradePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/pipeline" element={<PipelinePage />} />
        <Route path="customers/duplicates" element={<DuplicatesPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="organization/members" element={<OrganizationMembersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/crm" element={<CRMSettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
