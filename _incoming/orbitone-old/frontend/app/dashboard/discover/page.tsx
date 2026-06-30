"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type { NetworkProfile } from "@/lib/contracts";
import { Search, ArrowRight } from "lucide-react";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setStatus("loading");
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      params.set("limit", "20");

      const result = await apiFetch<NetworkProfile[]>(
        `/profiles?${params.toString()}`
      );
      if (result.ok) {
        setProfiles(result.data);
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }

    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discover</h1>
        <p className="text-muted">
          Find and connect with other OrbitOne professionals.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, headline, company, or location..."
          className="pl-10"
        />
      </div>

      {status === "loading" && <LoadingState message="Searching profiles..." />}

      {status === "error" && (
        <ErrorState
          title="Could not load profiles"
          message={error || "Unable to discover profiles right now."}
          action={
            <Button onClick={() => window.location.reload()}>Try again</Button>
          }
        />
      )}

      {status === "success" && profiles.length === 0 && (
        <EmptyState
          title="No profiles found"
          message={
            query
              ? "Try a different search term."
              : "No published profiles to discover yet."
          }
        />
      )}

      {status === "success" && profiles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((item) => (
            <ProfileCard key={item.profile.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({ item }: { item: NetworkProfile }) {
  const { profile, connectionStatus } = item;

  const statusConfig: Record<typeof connectionStatus, { label: string; variant: "default" | "secondary" | "accent" | "warning" | "outline" }> = {
    none: { label: "Not in network", variant: "outline" },
    saved: { label: "Saved by you", variant: "secondary" },
    saved_me: { label: "Saved you", variant: "warning" },
    mutual: { label: "Mutual connection", variant: "secondary" },
  };

  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.fullName}
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <Avatar
              initials={profile.fullName}
              alt={profile.fullName}
              size="lg"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">
              {profile.fullName}
            </h3>
            {profile.headline && (
              <p className="truncate text-sm text-muted">{profile.headline}</p>
            )}
            {profile.company && (
              <p className="truncate text-xs text-muted">{profile.company}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Badge variant={statusConfig[connectionStatus].variant}>
            {statusConfig[connectionStatus].label}
          </Badge>
          <Link href={`/u/${profile.slug}`}>
            <Button variant="outline" size="sm">
              View profile
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
