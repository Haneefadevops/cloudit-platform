"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerFeedback, useCreateFeedbackRequest } from "@/hooks/useFeedback";
import type { FeedbackRequest, FeedbackStatus, FeedbackChannel } from "@/lib/contracts";
import { MessageSquare, Plus, Copy, CheckCircle, Mail, Smartphone } from "lucide-react";

const channelIcons: Record<FeedbackChannel, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageSquare,
};

const statusVariant: Record<FeedbackStatus, BadgeProps["variant"]> = {
  pending: "outline",
  sent: "secondary",
  opened: "accent",
  completed: "success",
};

export function FeedbackTab({ customerId }: { customerId: string }) {
  const { data: requests = [], isLoading, error } = useCustomerFeedback(customerId);
  const create = useCreateFeedbackRequest(customerId);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCreate = async () => {
    await create.mutateAsync({ channel: "email" });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/feedback/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-error">Failed to load feedback requests.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Feedback</h2>
        <Button size="sm" onClick={handleCreate} isLoading={create.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Request feedback
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted">
            No feedback requests yet. Send one after a meeting or closed deal.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <FeedbackCard key={request.id} request={request} copiedToken={copiedToken} onCopy={copyLink} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({
  request,
  copiedToken,
  onCopy,
}: {
  request: FeedbackRequest;
  copiedToken: string | null;
  onCopy: (token: string) => void;
}) {
  const Icon = channelIcons[request.channel];
  const link = `${window.location.origin}/feedback/${request.token}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Feedback request</CardTitle>
              <p className="text-xs text-muted">
                {request.channel} • {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant[request.status]}>{request.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {request.ratingId && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="h-4 w-4" />
            Rating submitted
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onCopy(request.token)}>
            {copiedToken === request.token ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy link
              </>
            )}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={link} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
