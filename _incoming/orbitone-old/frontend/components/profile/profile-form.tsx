"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { Profile, ProfileInput } from "@/lib/contracts";
import { Upload, X } from "lucide-react";

const MAX_AVATAR_BYTES = 1024 * 1024;

interface ProfileFormProps {
  profile: Profile | null;
  onSubmit: (input: ProfileInput) => Promise<void>;
  isLoading: boolean;
}

function createInitialState(profile: Profile | null) {
  return {
    slug: profile?.slug || "",
    fullName: profile?.fullName || "",
    headline: profile?.headline || "",
    company: profile?.company || "",
    location: profile?.location || "",
    bio: profile?.bio || "",
    avatarUrl: profile?.avatarUrl || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    websiteUrl: profile?.websiteUrl || "",
    linkedinUrl: profile?.linkedinUrl || "",
    xUrl: profile?.xUrl || "",
    isPublished: profile?.isPublished || false,
  };
}

export function ProfileForm({
  profile,
  onSubmit,
  isLoading,
}: ProfileFormProps) {
  const [values, setValues] = useState(() => createInitialState(profile));
  const [isDragging, setIsDragging] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slugError = useMemo(() => {
    if (!values.slug) return undefined;
    if (values.slug.length < 3) return "Slug must be at least 3 characters.";
    if (!/^[a-z0-9-]+$/.test(values.slug))
      return "Slug can only contain lowercase letters, numbers, and hyphens.";
    return undefined;
  }, [values.slug]);

  const update = <K extends keyof typeof values>(
    key: K,
    value: typeof values[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  function readFile(file: File) {
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(
        "Please upload an image smaller than 1MB until file storage is added."
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      update("avatarUrl", String(e.target?.result || ""));
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (slugError) return;
    await onSubmit({
      ...values,
      headline: values.headline || null,
      company: values.company || null,
      location: values.location || null,
      bio: values.bio || null,
      avatarUrl: values.avatarUrl || null,
      email: values.email || null,
      phone: values.phone || null,
      websiteUrl: values.websiteUrl || null,
      linkedinUrl: values.linkedinUrl || null,
      xUrl: values.xUrl || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium text-foreground">Profile visibility</h3>
            <p className="text-sm text-muted">
              Publish your profile to make it discoverable via your public URL.
            </p>
          </div>
          <Switch
            label={values.isPublished ? "Published" : "Draft"}
            checked={values.isPublished}
            onCheckedChange={(checked) => update("isPublished", checked)}
          />
        </div>
        {values.isPublished && (
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="success" dot>
              Live
            </Badge>
            <span className="text-sm text-muted">
              Your public URL is active.
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="fullName">Full name *</Label>
          <Input
            id="fullName"
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            required
            placeholder="Saman Perera"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="slug">Profile URL slug *</Label>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-muted">
              orbitone.com/u/
            </span>
            <Input
              id="slug"
              value={values.slug}
              onChange={(e) =>
                update(
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                )
              }
              required
              pattern="[a-z0-9-]{3,40}"
              placeholder="saman-perera"
              className="flex-1"
              error={slugError}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Lowercase letters, numbers, and hyphens only. 3-40 characters.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Label optional>Avatar</Label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar
              src={values.avatarUrl}
              alt={values.fullName}
              initials={values.fullName}
              size="xl"
            />
            <div className="flex-1">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                className={[
                  "cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
                  isDragging
                    ? "border-secondary bg-secondary/5"
                    : "border-border bg-background hover:border-secondary/50",
                ].join(" ")}
              >
                <Upload className="mx-auto h-5 w-5 text-muted" />
                <p className="mt-1 text-sm text-foreground">
                  <span className="font-medium">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-muted">PNG, JPG, WEBP up to 1MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </div>
              {values.avatarUrl && (
                <button
                  type="button"
                  onClick={() => update("avatarUrl", "")}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-error"
                >
                  <X className="h-3 w-3" />
                  Remove avatar
                </button>
              )}
              {avatarError && (
                <p className="mt-2 text-xs text-error">{avatarError}</p>
              )}
              <p className="mt-2 text-xs text-muted">
                For production, ask Codex to add a dedicated avatar upload
                endpoint; large base64 images are stored as data URLs for now.
              </p>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={values.headline}
            onChange={(e) => update("headline", e.target.value)}
            placeholder="Software Engineer · Founder · Consultant"
          />
        </div>

        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="Acme Lanka (Pvt) Ltd"
          />
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={values.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Colombo, Sri Lanka"
          />
        </div>

        <div>
          <Label htmlFor="email">Public email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+94 77 123 4567"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={values.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="Tell people a little about yourself and how you can help..."
            showCount
            maxLength={500}
            autoResize
          />
        </div>

        <div className="sm:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Links
          </h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <Label htmlFor="websiteUrl">Website</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={values.websiteUrl}
                onChange={(e) => update("websiteUrl", e.target.value)}
                placeholder="https://yoursite.com"
              />
            </div>
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn</Label>
              <Input
                id="linkedinUrl"
                type="url"
                value={values.linkedinUrl}
                onChange={(e) => update("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <Label htmlFor="xUrl">X / Twitter</Label>
              <Input
                id="xUrl"
                type="url"
                value={values.xUrl}
                onChange={(e) => update("xUrl", e.target.value)}
                placeholder="https://x.com/..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isLoading}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
