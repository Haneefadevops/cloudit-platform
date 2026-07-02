"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { Connection, NetworkProfile, RelationshipStatus } from "@/lib/contracts";
import { Mail, Building2, Trash2, ArrowRight } from "lucide-react";

type Tab = "saved" | "inbound" | "mutual";

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "saved";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const [savedConnections, setSavedConnections] = useState<Connection[]>([]);
  const [inbound, setInbound] = useState<NetworkProfile[]>([]);
  const [mutual, setMutual] = useState<NetworkProfile[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [savedResult, inboundResult, mutualResult] = await Promise.all([
        apiFetch<Connection[]>("/connections"),
        apiFetch<NetworkProfile[]>("/network/inbound"),
        apiFetch<NetworkProfile[]>("/network/mutual"),
      ]);

      if (!savedResult.ok) {
        setStatus("error");
        return;
      }

      setSavedConnections(savedResult.data);
      setInbound(inboundResult.ok ? inboundResult.data : []);
      setMutual(mutualResult.ok ? mutualResult.data : []);
      setStatus("success");
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await apiFetch(`/connections/${id}`, { method: "DELETE" });
    if (result.ok) {
      setSavedConnections((prev) => prev.filter((c) => c.id !== id));
    }
    setDeletingId(null);
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "saved", label: "Saved by me", count: savedConnections.length },
    { key: "inbound", label: "Saved me", count: inbound.length },
    { key: "mutual", label: "Mutual", count: mutual.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Network</h1>
        <p className="text-muted">
          Manage your connections and discover who has saved your profile.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-secondary text-secondary"
                : "border-transparent text-muted hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-foreground">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {status === "loading" && <LoadingState message="Loading network..." />}

      {status === "error" && (
        <ErrorState
          title="Could not load network"
          message="We were unable to load your network. Please try again."
          action={
            <Button onClick={() => window.location.reload()}>Try again</Button>
          }
        />
      )}

      {status === "success" && activeTab === "saved" && (
        <SavedConnectionsList
          connections={savedConnections}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}

      {status === "success" && activeTab === "inbound" && (
        <NetworkProfileList
          title="People who saved your profile"
          items={inbound}
          emptyMessage="No one has saved your profile yet. Share your public URL to get discovered."
        />
      )}

      {status === "success" && activeTab === "mutual" && (
        <NetworkProfileList
          title="Mutual connections"
          items={mutual}
          emptyMessage="You don't have any mutual connections yet."
        />
      )}
    </div>
  );
}

function SavedConnectionsList({
  connections,
  onDelete,
  deletingId,
}: {
  connections: Connection[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (connections.length === 0) {
    return (
      <EmptyState
        title="No saved connections"
        message="Profiles you add to your network will appear here."
        action={
          <Link href="/dashboard/discover">
            <Button>Discover profiles</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <Card key={connection.id} className="transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar
                alt={connection.fullName}
                initials={connection.fullName}
                size="lg"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {connection.fullName}
                  </h3>
                  <RelationshipStatusBadge status={connection.relationshipStatus} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                  {connection.headline && <span>{connection.headline}</span>}
                  {connection.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {connection.company}
                    </span>
                  )}
                  {connection.email && (
                    <a
                      href={`mailto:${connection.email}`}
                      className="inline-flex items-center gap-1 hover:text-secondary"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {connection.email}
                    </a>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Added {new Date(connection.createdAt).toLocaleDateString()} ·{" "}
                  {connection.source.replace("_", " ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 self-start">
              <Link href={`/dashboard/connections/${connection.id}`}>
                <Button variant="outline" size="sm">
                  Manage
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(connection.id)}
                isLoading={deletingId === connection.id}
                className="text-error hover:bg-error-subtle hover:text-error"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RelationshipStatusBadge({
  status,
}: {
  status: RelationshipStatus;
}) {
  const config: Record<RelationshipStatus, { label: string; variant: "default" | "secondary" | "accent" | "warning" | "muted" }> = {
    new: { label: "New", variant: "default" },
    active: { label: "Active", variant: "secondary" },
    follow_up: { label: "Follow up", variant: "warning" },
    opportunity: { label: "Opportunity", variant: "accent" },
    archived: { label: "Archived", variant: "muted" },
  };

  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}

function NetworkProfileList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: NetworkProfile[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState title="Nothing here yet" message={emptyMessage} />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {items.map((item) => (
        <NetworkProfileCard key={item.profile.id} item={item} />
      ))}
    </div>
  );
}

function NetworkProfileCard({ item }: { item: NetworkProfile }) {
  const { profile } = item;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between p-5">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.fullName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-2xl object-cover"
            />
          ) : (
            <Avatar
              initials={profile.fullName}
              alt={profile.fullName}
              size="lg"
            />
          )}
          <div>
            <h3 className="font-semibold text-foreground">{profile.fullName}</h3>
            {profile.headline && (
              <p className="text-sm text-muted">{profile.headline}</p>
            )}
            {profile.company && (
              <p className="text-xs text-muted">{profile.company}</p>
            )}
          </div>
        </div>
        <Link href={`/u/${profile.slug}`}>
          <Button variant="outline" size="sm">
            View profile
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
