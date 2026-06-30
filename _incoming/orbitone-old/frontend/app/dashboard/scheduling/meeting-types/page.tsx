"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, APP_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/empty-states";
import type {
  MeetingLocationType,
  MeetingType,
  Profile,
} from "@/lib/contracts";
import {
  ArrowRight,
  Check,
  Copy,
  Plus,
  Trash2,
  Video,
  Phone,
  MapPin,
  Link as LinkIcon,
} from "lucide-react";

const locationOptions: { value: MeetingLocationType; label: string }[] = [
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone call" },
  { value: "in_person", label: "In person" },
  { value: "custom", label: "Custom" },
];

const durationOptions = [15, 30, 45, 60, 90, 120];

export default function MeetingTypesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [meetingTypeToDelete, setMeetingTypeToDelete] = useState<MeetingType | null>(null);
  const { show } = useToast();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [locationType, setLocationType] = useState<MeetingLocationType>("video");
  const [locationValue, setLocationValue] = useState("");
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(0);
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(60);
  const [bookingWindowDays, setBookingWindowDays] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    async function load() {
      const [profileResult, meetingTypesResult] = await Promise.all([
        apiFetch<Profile>("/profiles/me"),
        apiFetch<MeetingType[]>("/scheduling/meeting-types"),
      ]);

      if (!profileResult.ok) {
        setStatus("error");
        setError(profileResult.error);
        return;
      }

      if (!meetingTypesResult.ok) {
        setStatus("error");
        setError(meetingTypesResult.error);
        return;
      }

      setProfile(profileResult.data);
      setMeetingTypes(meetingTypesResult.data);
      setStatus("success");
    }

    load();
  }, []);

  function resetForm() {
    setTitle("");
    setSlug("");
    setDescription("");
    setDurationMinutes(30);
    setLocationType("video");
    setLocationValue("");
    setBufferBeforeMinutes(0);
    setBufferAfterMinutes(0);
    setMinNoticeMinutes(60);
    setBookingWindowDays(30);
    setIsActive(true);
    setRequiresApproval(false);
    setEditingId(null);
  }

  function startEdit(meetingType: MeetingType) {
    setEditingId(meetingType.id);
    setTitle(meetingType.title);
    setSlug(meetingType.slug);
    setDescription(meetingType.description || "");
    setDurationMinutes(meetingType.durationMinutes);
    setLocationType(meetingType.locationType);
    setLocationValue(meetingType.locationValue || "");
    setBufferBeforeMinutes(meetingType.bufferBeforeMinutes);
    setBufferAfterMinutes(meetingType.bufferAfterMinutes);
    setMinNoticeMinutes(meetingType.minNoticeMinutes);
    setBookingWindowDays(meetingType.bookingWindowDays);
    setIsActive(meetingType.isActive);
    setRequiresApproval(meetingType.requiresApproval);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    const body = {
      title,
      slug: slug || undefined,
      description: description || null,
      durationMinutes,
      locationType,
      locationValue: locationValue || null,
      bufferBeforeMinutes,
      bufferAfterMinutes,
      minNoticeMinutes,
      bookingWindowDays,
      isActive,
      requiresApproval,
    };

    if (editingId) {
      const result = await apiFetch<MeetingType>(
        `/scheduling/meeting-types/${editingId}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );

      if (result.ok) {
        setMeetingTypes((prev) =>
          prev.map((mt) => (mt.id === editingId ? result.data : mt))
        );
        resetForm();
        setShowForm(false);
      }
    } else {
      const result = await apiFetch<MeetingType>("/scheduling/meeting-types", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (result.ok) {
        setMeetingTypes((prev) => [result.data, ...prev]);
        resetForm();
        setShowForm(false);
      }
    }

    setIsSaving(false);
  }

  async function handleDelete() {
    if (!meetingTypeToDelete) return;
    const id = meetingTypeToDelete.id;
    setMeetingTypeToDelete(null);

    const result = await apiFetch(`/scheduling/meeting-types/${id}`, {
      method: "DELETE",
    });

    if (result.ok) {
      setMeetingTypes((prev) => prev.filter((mt) => mt.id !== id));
      show("Meeting type deleted", "success");
    } else {
      show(`Could not delete meeting type: ${result.error}`, "error");
    }
  }

  async function handleToggleActive(meetingType: MeetingType) {
    const result = await apiFetch<MeetingType>(
      `/scheduling/meeting-types/${meetingType.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ isActive: !meetingType.isActive }),
      }
    );

    if (result.ok) {
      setMeetingTypes((prev) =>
        prev.map((mt) => (mt.id === meetingType.id ? result.data : mt))
      );
    }
  }

  if (status === "loading") {
    return <LoadingState message="Loading meeting types..." />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Could not load meeting types"
        message={error || "Something went wrong."}
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meeting types</h1>
          <p className="text-muted">
            Create the meetings people can book with you.
          </p>
        </div>
        <Button
          onClick={() => {
            if (showForm && editingId) {
              resetForm();
            }
            setShowForm(!showForm);
          }}
          className="w-full sm:w-auto"
          variant={showForm ? "outline" : "primary"}
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create meeting type"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit meeting type" : "Create meeting type"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Introductory call"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="slug">URL slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-sm text-muted">
                      /book/{profile?.slug || "you"}/
                    </span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                        )
                      }
                      pattern="[a-z0-9-]{2,60}"
                      placeholder="intro-call"
                      className="flex-1"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Leave blank to auto-generate from the title.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will you cover in this meeting?"
                    className="flex w-full rounded-lg border border-border bg-white px-4 py-3 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <select
                    id="duration"
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value))
                    }
                    className="flex h-11 w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  >
                    {durationOptions.map((d) => (
                      <option key={d} value={d}>
                        {d} minutes
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="locationType">Location type</Label>
                  <select
                    id="locationType"
                    value={locationType}
                    onChange={(e) =>
                      setLocationType(e.target.value as MeetingLocationType)
                    }
                    className="flex h-11 w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  >
                    {locationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="locationValue">
                    Location details
                    {locationType === "video" && " (e.g. Zoom link)"}
                    {locationType === "phone" && " (e.g. phone number)"}
                    {locationType === "in_person" && " (e.g. address)"}
                  </Label>
                  <Input
                    id="locationValue"
                    value={locationValue}
                    onChange={(e) => setLocationValue(e.target.value)}
                    placeholder={
                      locationType === "video"
                        ? "https://zoom.us/j/..."
                        : locationType === "custom"
                        ? "Any details you want to share"
                        : ""
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="minNotice">Minimum notice (minutes)</Label>
                  <Input
                    id="minNotice"
                    type="number"
                    min={0}
                    value={minNoticeMinutes}
                    onChange={(e) =>
                      setMinNoticeMinutes(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="bookingWindow">
                    Booking window (days)
                  </Label>
                  <Input
                    id="bookingWindow"
                    type="number"
                    min={1}
                    max={365}
                    value={bookingWindowDays}
                    onChange={(e) =>
                      setBookingWindowDays(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="bufferBefore">
                    Buffer before (minutes)
                  </Label>
                  <Input
                    id="bufferBefore"
                    type="number"
                    min={0}
                    value={bufferBeforeMinutes}
                    onChange={(e) =>
                      setBufferBeforeMinutes(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="bufferAfter">Buffer after (minutes)</Label>
                  <Input
                    id="bufferAfter"
                    type="number"
                    min={0}
                    value={bufferAfterMinutes}
                    onChange={(e) =>
                      setBufferAfterMinutes(Number(e.target.value))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-4">
                    <div>
                      <p className="font-medium text-foreground">
                        Active meeting type
                      </p>
                      <p className="text-sm text-muted">
                        Inactive types are hidden from your public booking page.
                      </p>
                    </div>
                    <div
                      className={[
                        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                        isActive ? "bg-secondary" : "bg-slate-300",
                      ].join(" ")}
                      onClick={() => setIsActive(!isActive)}
                    >
                      <span
                        className={[
                          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                          isActive ? "translate-x-5" : "translate-x-0.5",
                        ].join(" ")}
                      />
                    </div>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <Switch
                      label="Requires approval"
                      checked={requiresApproval}
                      onCheckedChange={setRequiresApproval}
                    />
                    <p className="mt-2 text-sm text-muted">
                      New bookings will be held as pending until you approve
                      them.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  {editingId ? "Save changes" : "Create meeting type"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {meetingTypes.length === 0 && !showForm ? (
        <EmptyState
          title="No meeting types yet"
          message="Create your first meeting type so people can book time with you."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Create meeting type
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {meetingTypes.map((meetingType) => (
            <MeetingTypeCard
              key={meetingType.id}
              meetingType={meetingType}
              profileSlug={profile?.slug}
              isPublished={profile?.isPublished ?? false}
              onEdit={() => startEdit(meetingType)}
              onDelete={() => setMeetingTypeToDelete(meetingType)}
              onToggleActive={() => handleToggleActive(meetingType)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!meetingTypeToDelete}
        onOpenChange={(open) => !open && setMeetingTypeToDelete(null)}
        title="Delete meeting type"
        description={
          meetingTypeToDelete
            ? `Are you sure you want to delete "${meetingTypeToDelete.title}"? This cannot be undone.`
            : ""
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setMeetingTypeToDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}

function MeetingTypeCard({
  meetingType,
  profileSlug,
  isPublished,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  meetingType: MeetingType;
  profileSlug?: string;
  isPublished: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const bookingUrl = useMemo(() => {
    if (!profileSlug) return "";
    const base = APP_BASE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/book/${profileSlug}/${meetingType.slug}`;
  }, [profileSlug, meetingType.slug]);

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const LocationIcon =
    {
      video: Video,
      phone: Phone,
      in_person: MapPin,
      custom: LinkIcon,
    }[meetingType.locationType] || Video;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {meetingType.title}
              </h3>
              {meetingType.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              )}
              {meetingType.requiresApproval && (
                <Badge variant="warning">Approval required</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {meetingType.durationMinutes} min ·{" "}
              {locationOptions.find((o) => o.value === meetingType.locationType)
                ?.label || meetingType.locationType}
            </p>
          </div>
          <button
            onClick={onToggleActive}
            className={[
              "relative h-7 w-12 rounded-full transition-colors",
              meetingType.isActive ? "bg-secondary" : "bg-slate-300",
            ].join(" ")}
            aria-label={meetingType.isActive ? "Deactivate" : "Activate"}
          >
            <span
              className={[
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                meetingType.isActive ? "translate-x-5" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </div>

        {meetingType.description && (
          <p className="text-sm text-muted line-clamp-2">
            {meetingType.description}
          </p>
        )}

        {meetingType.locationValue && (
          <p className="flex items-start gap-2 text-sm text-muted">
            <LocationIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{meetingType.locationValue}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Min notice: {meetingType.minNoticeMinutes}m</span>
          <span>·</span>
          <span>Window: {meetingType.bookingWindowDays} days</span>
          {(meetingType.bufferBeforeMinutes > 0 ||
            meetingType.bufferAfterMinutes > 0) && (
            <>
              <span>·</span>
              <span>
                Buffer{" "}
                {meetingType.bufferBeforeMinutes > 0 &&
                  `+${meetingType.bufferBeforeMinutes}m`}
                {meetingType.bufferBeforeMinutes > 0 &&
                  meetingType.bufferAfterMinutes > 0 &&
                  " / "}
                {meetingType.bufferAfterMinutes > 0 &&
                  `+${meetingType.bufferAfterMinutes}m`}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" onClick={onEdit}>
            Edit
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={copyLink}
            disabled={!isPublished || !bookingUrl}
            title={
              !isPublished
                ? "Publish your profile to share a booking link"
                : "Copy public booking link"
            }
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy link
              </>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Delete meeting type
        </Button>
      </CardContent>
    </Card>
  );
}
