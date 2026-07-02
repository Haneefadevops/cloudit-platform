"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LoadingState,
  ErrorState,
} from "@/components/empty-states";
import { StatusSelector } from "@/components/relationship/status-selector";
import { NotesSection } from "@/components/relationship/notes-section";
import { TagsSection } from "@/components/relationship/tags-section";
import { FollowUpsSection } from "@/components/relationship/follow-ups-section";
import { LifecycleSelector } from "@/components/crm/lifecycle-selector";
import { PrioritySelector } from "@/components/crm/priority-selector";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type {
  Connection,
  ConnectionRelationship,
  ConnectionCRM,
  RelationshipStatus,
  LifecycleStage,
  ConnectionPriority,
  Tag,
  ConnectionActivityType,
  Profile,
} from "@/lib/contracts";
import { ArrowLeft, Mail, Building2, Phone, Globe, ExternalLink, Calendar } from "lucide-react";

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  const [connection, setConnection] = useState<Connection | null>(null);
  const [relationship, setRelationship] = useState<ConnectionRelationship | null>(null);
  const [crm, setCrm] = useState<ConnectionCRM | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingCRM, setSavingCRM] = useState(false);
  const [nextStep, setNextStep] = useState("");
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const [relationshipResult, crmResult, tagsResult, profileResult] = await Promise.all([
        apiFetch<ConnectionRelationship>(`/connections/${connectionId}/relationship`),
        apiFetch<ConnectionCRM>(`/connections/${connectionId}/crm`),
        apiFetch<Tag[]>("/tags"),
        apiFetch<Profile>("/profiles/me"),
      ]);

      if (!relationshipResult.ok || !crmResult.ok) {
        setStatus("error");
        setError(
          (relationshipResult.ok ? "" : relationshipResult.error) ||
            (crmResult.ok ? "" : crmResult.error) ||
            "Unable to load connection details."
        );
        return;
      }

      setRelationship(relationshipResult.data);
      setCrm(crmResult.data);
      setConnection(crmResult.data.connection);
      setNextStep(crmResult.data.connection.nextStep || "");
      setAvailableTags(tagsResult.ok ? tagsResult.data : []);
      if (profileResult.ok) {
        setMyProfile(profileResult.data);
      }
      setStatus("success");
    }

    load();
  }, [connectionId]);

  async function handleStatusChange(newStatus: RelationshipStatus) {
    if (!connection) return;
    setSavingStatus(true);

    const result = await apiFetch(`/connections/${connectionId}/relationship`, {
      method: "PUT",
      body: JSON.stringify({ relationshipStatus: newStatus }),
    });

    if (result.ok) {
      setConnection((prev) => (prev ? { ...prev, relationshipStatus: newStatus } : null));
    }

    setSavingStatus(false);
  }

  async function handleCRMUpdate(updates: {
    lifecycleStage?: LifecycleStage;
    priority?: ConnectionPriority;
    nextStep?: string | null;
  }) {
    if (!connection) return;
    setSavingCRM(true);

    const result = await apiFetch(`/connections/${connectionId}/crm`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    if (result.ok) {
      setConnection((prev) => (prev ? { ...prev, ...updates } : null));
    }

    setSavingCRM(false);
  }

  async function handleNextStepSave() {
    await handleCRMUpdate({ nextStep: nextStep.trim() || null });
  }

  async function handleCreateNote(body: string) {
    const result = await apiFetch(`/connections/${connectionId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });

    if (result.ok && relationship) {
      const refreshed = await apiFetch<ConnectionRelationship>(
        `/connections/${connectionId}/relationship`
      );
      if (refreshed.ok) setRelationship(refreshed.data);
    }
  }

  async function handleDeleteNote(noteId: string) {
    const result = await apiFetch(`/connections/${connectionId}/notes/${noteId}`, {
      method: "DELETE",
    });

    if (result.ok && relationship) {
      setRelationship((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : null
      );
    }
  }

  async function handleCreateTag(name: string, color: string) {
    const result = await apiFetch<Tag>("/tags", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });

    if (result.ok) {
      setAvailableTags((prev) => [...prev, result.data]);
    }
  }

  async function handleAssignTags(tagIds: string[]) {
    const result = await apiFetch(`/connections/${connectionId}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tagIds }),
    });

    if (result.ok && relationship) {
      const refreshed = await apiFetch<ConnectionRelationship>(
        `/connections/${connectionId}/relationship`
      );
      if (refreshed.ok) setRelationship(refreshed.data);
    }
  }

  async function handleDeleteTag(tagId: string) {
    const result = await apiFetch(`/tags/${tagId}`, { method: "DELETE" });

    if (result.ok) {
      setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
      if (relationship) {
        setRelationship((prev) =>
          prev ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) } : null
        );
      }
    }
  }

  async function handleCreateFollowUp(title: string, dueAt: string) {
    const result = await apiFetch(`/connections/${connectionId}/follow-ups`, {
      method: "POST",
      body: JSON.stringify({ title, dueAt }),
    });

    if (result.ok && relationship) {
      const refreshed = await apiFetch<ConnectionRelationship>(
        `/connections/${connectionId}/relationship`
      );
      if (refreshed.ok) setRelationship(refreshed.data);
    }
  }

  async function handleCompleteFollowUp(followUpId: string, completed: boolean) {
    const result = await apiFetch(
      `/connections/${connectionId}/follow-ups/${followUpId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      }
    );

    if (result.ok && relationship) {
      const refreshed = await apiFetch<ConnectionRelationship>(
        `/connections/${connectionId}/relationship`
      );
      if (refreshed.ok) setRelationship(refreshed.data);
    }
  }

  async function handleDeleteFollowUp(followUpId: string) {
    const result = await apiFetch(
      `/connections/${connectionId}/follow-ups/${followUpId}`,
      { method: "DELETE" }
    );

    if (result.ok && relationship) {
      setRelationship((prev) =>
        prev
          ? { ...prev, followUps: prev.followUps.filter((f) => f.id !== followUpId) }
          : null
      );
    }
  }

  async function handleCreateActivity(input: {
    activityType: ConnectionActivityType;
    title: string;
    body: string | null;
    occurredAt: string;
  }) {
    const result = await apiFetch(`/connections/${connectionId}/activities`, {
      method: "POST",
      body: JSON.stringify(input),
    });

    if (result.ok && crm) {
      const refreshed = await apiFetch<ConnectionCRM>(`/connections/${connectionId}/crm`);
      if (refreshed.ok) {
        setCrm(refreshed.data);
        setConnection(refreshed.data.connection);
      }
    }
  }

  async function handleDeleteActivity(activityId: string) {
    const result = await apiFetch(
      `/connections/${connectionId}/activities/${activityId}`,
      { method: "DELETE" }
    );

    if (result.ok && crm) {
      setCrm((prev) =>
        prev
          ? { ...prev, activities: prev.activities.filter((a) => a.id !== activityId) }
          : null
      );
    }
  }

  if (status === "loading") {
    return <LoadingState message="Loading connection details..." />;
  }

  if (status === "error" || !connection || !relationship || !crm) {
    return (
      <ErrorState
        title="Could not load connection"
        message={error || "This connection could not be found."}
        action={
          <Link href="/dashboard/connections">
            <Button>Back to network</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar
                alt={connection.fullName}
                initials={connection.fullName}
                size="xl"
              />
              <div>
                <CardTitle className="text-2xl">{connection.fullName}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                  {connection.headline && <span>{connection.headline}</span>}
                  {connection.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {connection.company}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {connection.email && (
                    <IconLink href={`mailto:${connection.email}`} icon={<Mail className="h-3.5 w-3.5" />} label="Email" />
                  )}
                  {connection.phone && (
                    <IconLink href={`tel:${connection.phone}`} icon={<Phone className="h-3.5 w-3.5" />} label="Call" />
                  )}
                  {connection.websiteUrl && (
                    <IconLink href={connection.websiteUrl} icon={<Globe className="h-3.5 w-3.5" />} label="Website" external />
                  )}
                  {connection.linkedinUrl && (
                    <IconLink href={connection.linkedinUrl} icon={<ExternalLink className="h-3.5 w-3.5" />} label="LinkedIn" external />
                  )}
                  {myProfile?.isPublished && (
                    <IconLink
                      href={`/book/${myProfile.slug}?connectionId=${connection.id}`}
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Book follow-up"
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted">
              Added {new Date(connection.createdAt).toLocaleDateString()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Relationship status
            </h3>
            <StatusSelector
              value={connection.relationshipStatus}
              onChange={handleStatusChange}
              disabled={savingStatus}
            />
          </div>

          <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Lifecycle stage
              </h3>
              <LifecycleSelector
                value={connection.lifecycleStage}
                onChange={(value) => handleCRMUpdate({ lifecycleStage: value })}
                disabled={savingCRM}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Priority
              </h3>
              <PrioritySelector
                value={connection.priority}
                onChange={(value) => handleCRMUpdate({ priority: value })}
                disabled={savingCRM}
              />
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <Label htmlFor="nextStep" className="text-sm font-semibold uppercase tracking-wide text-muted">
              Next step
            </Label>
            <div className="mt-3 flex gap-2">
              <Input
                id="nextStep"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="What is the next action?"
                className="flex-1"
              />
              <Button onClick={handleNextStepSave} isLoading={savingCRM}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <ActivityTimeline
            activities={crm.activities}
            onCreate={handleCreateActivity}
            onDelete={handleDeleteActivity}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <FollowUpsSection
            followUps={relationship.followUps}
            onCreate={handleCreateFollowUp}
            onComplete={handleCompleteFollowUp}
            onDelete={handleDeleteFollowUp}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <TagsSection
            availableTags={availableTags}
            assignedTags={relationship.tags}
            onCreate={handleCreateTag}
            onAssign={handleAssignTags}
            onDeleteTag={handleDeleteTag}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <NotesSection
            notes={relationship.notes}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function IconLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-secondary hover:text-secondary"
    >
      {icon}
      {label}
    </Link>
  );
}
