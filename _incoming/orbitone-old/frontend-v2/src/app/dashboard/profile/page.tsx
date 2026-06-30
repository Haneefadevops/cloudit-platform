import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { useMyProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Upload, X } from "lucide-react";

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB

const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  headline: z.string().max(160).optional(),
  company: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  bio: z.string().max(600).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  xUrl: z.string().url().optional().or(z.literal("")),
  avatarUrl: z.string().optional().or(z.literal("")),
  isPublished: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const update = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      slug: "",
      headline: "",
      company: "",
      location: "",
      bio: "",
      email: "",
      phone: "",
      websiteUrl: "",
      linkedinUrl: "",
      xUrl: "",
      avatarUrl: "",
      isPublished: false,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.fullName,
        slug: profile.slug,
        headline: profile.headline ?? "",
        company: profile.company ?? "",
        location: profile.location ?? "",
        bio: profile.bio ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        websiteUrl: profile.websiteUrl ?? "",
        linkedinUrl: profile.linkedinUrl ?? "",
        xUrl: profile.xUrl ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        isPublished: profile.isPublished,
      });
    }
  }, [profile, form]);

  async function onSubmit(values: ProfileFormValues) {
    await update.mutateAsync(values);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("Avatar must be smaller than 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      form.setValue("avatarUrl", reader.result as string, { shouldDirty: true });
      setAvatarError(null);
    };
    reader.onerror = () => {
      setAvatarError("Could not read the selected file.");
    };
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    form.setValue("avatarUrl", "", { shouldDirty: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const [avatarUrl, fullName, headline] = useWatch({
    control: form.control,
    name: ["avatarUrl", "fullName", "headline"],
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your profile</h1>
      <p className="text-muted">Build your digital business card.</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
        {/* Avatar + preview card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="flex flex-col items-center gap-3">
                <Avatar src={avatarUrl} fallback={fullName || "U"} size="xl" />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                  {avatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearAvatar}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {avatarError && <p className="text-xs text-error">{avatarError}</p>}
                <p className="text-center text-xs text-muted">Max 1MB. JPG or PNG.</p>
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">Profile photo</h2>
                <p className="text-sm text-muted">
                  This photo appears on your public profile, vCard, and QR code page.
                </p>
                <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
                  <div className="mt-3 flex items-center gap-4">
                    <Avatar src={avatarUrl} fallback={fullName || "U"} size="lg" />
                    <div>
                      <p className="font-medium text-foreground">{fullName || "Your name"}</p>
                      <p className="text-sm text-muted">{headline || "Your headline"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile details */}
        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>This information appears on your public profile and vCard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={form.formState.errors.fullName?.message}>
                <Input id="fullName" {...form.register("fullName")} />
              </Field>
              <Field label="Profile slug" error={form.formState.errors.slug?.message}>
                <Input id="slug" {...form.register("slug")} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" error={form.formState.errors.headline?.message}>
                <Input id="headline" {...form.register("headline")} placeholder="e.g. Marketing Consultant" />
              </Field>
              <Field label="Company" error={form.formState.errors.company?.message}>
                <Input id="company" {...form.register("company")} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" error={form.formState.errors.location?.message}>
                <Input id="location" {...form.register("location")} placeholder="e.g. Colombo, Sri Lanka" />
              </Field>
              <Field label="Website" error={form.formState.errors.websiteUrl?.message}>
                <Input id="websiteUrl" type="url" {...form.register("websiteUrl")} placeholder="https://yourwebsite.com" />
              </Field>
            </div>

            <Field label="Bio" error={form.formState.errors.bio?.message}>
              <Textarea id="bio" {...form.register("bio")} rows={4} placeholder="A short introduction..." />
            </Field>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>How people can reach you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact email" error={form.formState.errors.email?.message}>
                <Input id="email" type="email" {...form.register("email")} />
              </Field>
              <Field label="Phone" error={form.formState.errors.phone?.message}>
                <Input id="phone" {...form.register("phone")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Social */}
        <Card>
          <CardHeader>
            <CardTitle>Social links</CardTitle>
            <CardDescription>Link your professional profiles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="LinkedIn" error={form.formState.errors.linkedinUrl?.message}>
                <Input id="linkedinUrl" type="url" {...form.register("linkedinUrl")} placeholder="https://linkedin.com/in/..." />
              </Field>
              <Field label="X / Twitter" error={form.formState.errors.xUrl?.message}>
                <Input id="xUrl" type="url" {...form.register("xUrl")} placeholder="https://x.com/..." />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Visibility */}
        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
            <CardDescription>Control who can see your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
              <div>
                <Label htmlFor="isPublished" className="cursor-pointer font-medium text-foreground">
                  Publish profile
                </Label>
                <p className="text-sm text-muted">Make your profile visible to the public.</p>
              </div>
              <Switch id="isPublished" {...form.register("isPublished")} />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="sticky bottom-4 rounded-2xl border border-border bg-surface-elevated p-4 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {update.isError && <p className="text-sm text-error">{update.error?.message ?? "Could not save profile."}</p>}
              {update.isSuccess && <p className="text-sm text-success">Profile saved successfully.</p>}
            </div>
            <Button type="submit" isLoading={update.isPending}>
              Save profile
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const id = (children as React.ReactElement<{ id?: string }>)?.props?.id;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
