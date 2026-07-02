"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LoadingState, ErrorState } from "@/components/empty-states";
import type { CalendarAccount, CalendarProvider } from "@/lib/contracts";
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

const providerNames: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Outlook",
  zoho: "Zoho Calendar",
};

const oauthErrorMessages: Record<string, string> = {
  google_oauth_denied:
    "Google Calendar access was denied. You can try again when you are ready.",
  google_oauth_invalid_request:
    "The connection request was invalid. Please try again.",
  google_oauth_invalid_state:
    "The connection session expired or was invalid. Please try again.",
  google_oauth_failed:
    "Could not complete Google Calendar connection. Please try again later.",
  zoho_oauth_denied:
    "Zoho Calendar access was denied. You can try again when you are ready.",
  zoho_oauth_invalid_request:
    "The Zoho connection request was invalid. Please try again.",
  zoho_oauth_invalid_state:
    "The Zoho connection session expired or was invalid. Please try again.",
  zoho_token_exchange_failed:
    "Could not exchange the Zoho authorization code. Please try again.",
  zoho_account_lookup_failed:
    "Could not read the connected Zoho account details. Please try again.",
  zoho_oauth_failed:
    "Could not complete Zoho Calendar connection. Please try again later.",
};

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<CalendarAccount | null>(null);
  const { show } = useToast();

  const connectedAccount = accounts.find((a) => a.isConnected);

  const oauthConnected = searchParams.get("connected");
  const oauthError = searchParams.get("error");

  useEffect(() => {
    if (oauthConnected === "google" || oauthConnected === "zoho") {
      show(`${providerNames[oauthConnected]} connected`, "success");
    }
    if (oauthError) {
      show(
        oauthErrorMessages[oauthError] ||
          `Could not connect calendar (${oauthError}). Please try again.`,
        "error"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function load() {
      const result = await apiFetch<CalendarAccount[]>(
        "/scheduling/calendar-accounts"
      );
      if (result.ok) {
        setAccounts(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    load();
  }, []);

  async function handleConnect(provider: "google" | "zoho") {
    setConnectingProvider(provider);

    const result = await apiFetch<{ authorizationUrl: string }>(
      `/scheduling/${provider}/connect`,
      {
        method: "POST",
      }
    );

    if (result.ok) {
      window.location.href = result.data.authorizationUrl;
    } else {
      show(`Could not start connection: ${result.error}`, "error");
      setConnectingProvider(null);
    }
  }

  async function handleDisconnect() {
    if (!accountToDisconnect) return;
    const id = accountToDisconnect.id;
    setAccountToDisconnect(null);
    setIsDisconnecting(true);

    const result = await apiFetch(`/scheduling/calendar-accounts/${id}`, {
      method: "DELETE",
    });

    if (result.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      show("Calendar disconnected", "success");
    } else {
      show(`Could not disconnect calendar: ${result.error}`, "error");
    }

    setIsDisconnecting(false);
  }

  if (status === "loading") {
    return <LoadingState message="Loading calendar status..." />;
  }

  if (status === "error" && accounts.length === 0) {
    return (
      <ErrorState
        title="Could not load calendar status"
        message={error || "Something went wrong."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Connected calendar
        </h1>
        <p className="text-muted">
          Link a calendar so OrbitOne can check busy times and create events.
        </p>
      </div>

      {connectedAccount ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {providerNames[connectedAccount.provider]}
                  </h3>
                  <Badge variant="success">Connected</Badge>
                </div>
                {connectedAccount.email && (
                  <p className="text-sm text-muted">
                    {connectedAccount.email}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">
                  Connected on{" "}
                  {new Date(connectedAccount.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setAccountToDisconnect(connectedAccount)}
              isLoading={isDisconnecting}
              className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Disconnect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-muted">
              <Calendar className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">
                No calendar connected
              </h3>
              <p className="mx-auto max-w-md text-sm text-muted">
                Connect Google Calendar or Zoho Calendar so OrbitOne can read your busy times
                and automatically create events when someone books a meeting.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button
                onClick={() => handleConnect("google")}
                isLoading={connectingProvider === "google"}
                className="w-full sm:w-auto"
              >
                {connectingProvider === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Connect Google Calendar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConnect("zoho")}
                isLoading={connectingProvider === "zoho"}
                className="w-full sm:w-auto"
              >
                {connectingProvider === "zoho" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Connect Zoho Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Calendar providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProviderRow
            name="Google Calendar"
            status={
              connectedAccount?.provider === "google" ? "connected" : "available"
            }
          />
          <ProviderRow
            name="Microsoft Outlook"
            status={
              connectedAccount?.provider === "microsoft"
                ? "connected"
                : "coming_soon"
            }
          />
          <ProviderRow
            name="Zoho Calendar"
            status={
              connectedAccount?.provider === "zoho" ? "connected" : "available"
            }
          />
        </CardContent>
      </Card>

      <Dialog
        open={!!accountToDisconnect}
        onOpenChange={(open) => !open && setAccountToDisconnect(null)}
        title="Disconnect calendar"
        description={
          accountToDisconnect
            ? `Disconnect ${providerNames[accountToDisconnect.provider]}${
                accountToDisconnect.email ? ` (${accountToDisconnect.email})` : ""
              }? OrbitOne will no longer be able to read busy times or create events.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setAccountToDisconnect(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisconnect} isLoading={isDisconnecting}>
              Disconnect
            </Button>
          </>
        }
      />
    </div>
  );
}

function ProviderRow({
  name,
  status,
}: {
  name: string;
  status: "connected" | "available" | "coming_soon";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-white p-4">
      <span className="font-medium text-foreground">{name}</span>
      {status === "connected" ? (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
          <Check className="h-4 w-4" />
          Connected
        </span>
      ) : status === "coming_soon" ? (
        <span className="inline-flex items-center gap-1 text-sm text-muted">
          <X className="h-4 w-4" />
          Coming later
        </span>
      ) : (
        <span className="text-sm text-muted">Available</span>
      )}
    </div>
  );
}
