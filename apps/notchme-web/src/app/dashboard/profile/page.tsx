"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, ExternalLink, QrCode, Upload, X } from "lucide-react";
import { ActivationChecklist } from "@/components/activation/activation-checklist";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMyProfile, useUpdateProfile } from "@/hooks/useProfile";

const MAX_AVATAR_SIZE = 1024 * 1024;

const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(120),
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
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

const emptyProfile: ProfileFormValues = {
  fullName: "", slug: "", headline: "", company: "", location: "", bio: "", email: "", phone: "", websiteUrl: "", linkedinUrl: "", xUrl: "", avatarUrl: "", isPublished: false,
};

export default function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();
  const update = useUpdateProfile();
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: emptyProfile });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) form.reset({
      fullName: profile.fullName, slug: profile.slug, headline: profile.headline ?? "", company: profile.company ?? "", location: profile.location ?? "", bio: profile.bio ?? "", email: profile.email ?? "", phone: profile.phone ?? "", websiteUrl: profile.websiteUrl ?? "", linkedinUrl: profile.linkedinUrl ?? "", xUrl: profile.xUrl ?? "", avatarUrl: profile.avatarUrl ?? "", isPublished: profile.isPublished,
    });
  }, [profile, form]);

  const values = useWatch({ control: form.control }) as ProfileFormValues;
  const savedPublicUrl = typeof window === "undefined" || !profile?.isPublished || !profile.slug ? "" : `${window.location.origin}/p/${profile.slug}`;

  async function onSubmit(input: ProfileFormValues) {
    await update.mutateAsync(input);
  }

  async function publishProfile() {
    form.setValue("isPublished", true, { shouldDirty: true });
    await form.handleSubmit(onSubmit)();
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
    reader.onerror = () => setAvatarError("Could not read the selected file.");
    reader.readAsDataURL(file);
  }

  if (isLoading) return <div className="p-6 md:p-8"><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-[38rem] w-full" /></div>;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        eyebrow="Your professional presence"
        title="My Page"
        description="Make it easy for people to understand your work, get in touch, and book time with you."
        actions={<>
          {savedPublicUrl ? <Button size="sm" variant="outline" asChild><a href={savedPublicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Preview page</a></Button> : <Button size="sm" variant="outline" type="button" onClick={publishProfile} isLoading={update.isPending}>Publish page</Button>}
          {savedPublicUrl && <Button size="sm" type="button" onClick={() => void navigator.clipboard?.writeText(savedPublicUrl)?.catch(() => undefined)}><Copy className="h-4 w-4" />Copy link</Button>}
        </>}
      />

      <ActivationChecklist className="mt-6" />

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>How your page looks</CardTitle>
            <CardDescription>This preview updates as you edit. Save changes before publishing them.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <Avatar src={values.avatarUrl} fallback={values.fullName || "U"} size="xl" />
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />Upload photo</Button>
                    {values.avatarUrl && <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("avatarUrl", "", { shouldDirty: true })}><X className="h-4 w-4" />Remove</Button>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
                  <p className="mt-2 text-sm text-muted">JPG or PNG, up to 1MB.</p>
                  {avatarError && <p className="mt-2 text-sm text-error">{avatarError}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={form.formState.errors.fullName?.message}><Input id="fullName" {...form.register("fullName")} /></Field>
                <Field label="Page address" error={form.formState.errors.slug?.message}><Input id="slug" {...form.register("slug")} /><p className="text-xs text-muted">Used in your public page link.</p></Field>
                <Field label="Headline" error={form.formState.errors.headline?.message}><Input id="headline" placeholder="e.g. Independent consultant" {...form.register("headline")} /></Field>
                <Field label="Company" error={form.formState.errors.company?.message}><Input id="company" {...form.register("company")} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location" error={form.formState.errors.location?.message}><Input id="location" placeholder="e.g. City, Country" {...form.register("location")} /></Field>
                <Field label="Website" error={form.formState.errors.websiteUrl?.message}><Input id="websiteUrl" type="url" placeholder="https://yourwebsite.com" {...form.register("websiteUrl")} /></Field>
              </div>
              <Field label="About" error={form.formState.errors.bio?.message}><Textarea id="bio" rows={4} placeholder="A short introduction to your work and the people you help." {...form.register("bio")} /></Field>
            </div>
            <MobilePagePreview values={values} savedIsPublished={Boolean(profile?.isPublished)} savedPublicUrl={savedPublicUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact and links</CardTitle><CardDescription>Choose the details people can use to continue the conversation.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact email" error={form.formState.errors.email?.message}><Input id="email" type="email" {...form.register("email")} /></Field>
              <Field label="Phone" error={form.formState.errors.phone?.message}><Input id="phone" {...form.register("phone")} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="LinkedIn" error={form.formState.errors.linkedinUrl?.message}><Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/in/..." {...form.register("linkedinUrl")} /></Field>
              <Field label="X" error={form.formState.errors.xUrl?.message}><Input id="xUrl" type="url" placeholder="https://x.com/..." {...form.register("xUrl")} /></Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Publish and share</CardTitle><CardDescription>Publishing makes your page visible. You can return to edit it at any time.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
              <div><Label htmlFor="isPublished" className="cursor-pointer font-medium text-foreground">Publish My Page</Label><p className="mt-1 text-sm text-muted">Allow people with your page link to view your details.</p></div>
              <Switch id="isPublished" {...form.register("isPublished")} />
            </div>
            {savedPublicUrl && <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">Your public page is ready</p><p className="mt-1 truncate text-sm text-foreground/75">{savedPublicUrl}</p></div><div className="flex items-center gap-3"><div className="rounded-lg bg-white p-2"><QRCode value={savedPublicUrl} size={64} /></div><Button size="sm" variant="outline" asChild><Link href="/dashboard/scheduling"><QrCode className="h-4 w-4" />Booking setup</Link></Button></div></div>}
          </CardContent>
        </Card>

        <div className="sticky bottom-4 z-10 rounded-2xl border border-border bg-surface-elevated/95 p-4 shadow-card backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className="text-sm">{update.isError ? <span className="text-error">{update.error?.message ?? "Could not save My Page."}</span> : update.isSuccess ? <span className="text-success">Changes saved.</span> : form.formState.isDirty ? <span className="text-muted">You have unsaved changes.</span> : <span className="text-muted">Your page is up to date.</span>}</p>
            <Button type="submit" isLoading={update.isPending}>Save My Page</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MobilePagePreview({ values, savedIsPublished, savedPublicUrl }: { values: ProfileFormValues; savedIsPublished: boolean; savedPublicUrl: string }) {
  return (
    <aside className="mx-auto w-full max-w-[18rem] rounded-[2rem] border-[6px] border-foreground bg-surface-elevated p-4 shadow-card lg:sticky lg:top-6">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Live mobile preview</p>
      <div className="mt-5 text-center">
        <div className="mx-auto w-fit rounded-full border-2 border-secondary p-1"><Avatar src={values.avatarUrl} fallback={values.fullName || "U"} size="lg" /></div>
        <h2 className="mt-3 truncate text-lg font-semibold text-foreground">{values.fullName || "Your name"}</h2>
        <p className="mt-1 max-h-12 overflow-hidden text-sm text-foreground/75">{values.headline || "Your professional headline"}</p>
        {values.company && <p className="mt-1 truncate text-xs text-muted">{values.company}</p>}
      </div>
      <div className="mt-5 space-y-2">
        {(values.email || values.phone || values.websiteUrl) ? <Button type="button" className="w-full" size="sm">Contact</Button> : <div className="rounded-lg bg-surface p-3 text-center text-xs text-muted">Add a contact method to make your page more useful.</div>}
        <Button type="button" className="w-full" size="sm" variant="outline">Book a meeting</Button>
      </div>
      {values.bio && <p className="mt-5 max-h-20 overflow-hidden text-xs leading-5 text-foreground/75">{values.bio}</p>}
      <div className="mt-5 border-t border-border pt-3 text-center"><p className="text-[11px] text-muted">{savedIsPublished ? "Published" : values.isPublished ? "Publishing changes are not saved" : "Draft — save and publish when ready"}</p>{savedPublicUrl && <p className="mt-1 truncate text-[10px] text-primary">/{values.slug}</p>}</div>
    </aside>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = (children as React.ReactElement<{ id?: string }>).props?.id;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{error && <p className="text-sm text-error">{error}</p>}</div>;
}
