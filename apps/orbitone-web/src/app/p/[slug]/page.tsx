"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL } from "@/lib/api";
import { usePublicProfile } from "@/hooks/useProfile";
import { usePublicBookingProfile } from "@/hooks/usePublicBooking";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Link as LinkIcon,
  AtSign,
  Download,
  Calendar,
  Clock,
  Video,
  Phone as PhoneIcon,
  MapPin as MapPinIcon,
  User,
  Share2,
  Copy,
  QrCode,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: profile, isLoading, error } = usePublicProfile(slug ?? "");
  const { data: bookingProfile } = usePublicBookingProfile(slug ?? "");

  const publicUrl = `${window.location.origin}/p/${slug}`;
  const activeMeetingTypes = bookingProfile?.meetingTypes.filter((mt) => mt.isActive) ?? [];

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: profile?.fullName ?? "OrbitOne", url: publicUrl });
    } else {
      await navigator.clipboard.writeText(publicUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-surface px-4 py-8">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="mx-auto mt-4 h-7 w-40" />
            <Skeleton className="mx-auto mt-2 h-4 w-56" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-surface px-4 py-8">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <p className="text-error">Profile not found or not published.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background to-surface px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl animate-fade-in-up space-y-6">
        {/* Hero card */}
        <Card className="relative overflow-hidden border border-border/60 shadow-lg">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-secondary/10 to-transparent" />
          <CardContent className="relative px-6 pb-6 pt-10 text-center">
            <div className="relative mx-auto inline-block">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-secondary to-accent opacity-30 blur-xl" />
              <Avatar
                src={profile.avatarUrl}
                fallback={profile.fullName}
                size="xl"
                className="relative mx-auto h-28 w-28 border-4 border-surface-elevated text-3xl shadow-card"
              />
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
              {profile.fullName}
            </h1>
            {profile.headline && <p className="mt-1 text-muted">{profile.headline}</p>}

            {(profile.company || profile.location) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {profile.company && (
                  <Badge variant="outline" className="border-border/60 bg-surface">
                    <Briefcase className="mr-1 h-3 w-3" />
                    {profile.company}
                  </Badge>
                )}
                {profile.location && (
                  <Badge variant="outline" className="border-border/60 bg-surface">
                    <MapPin className="mr-1 h-3 w-3" />
                    {profile.location}
                  </Badge>
                )}
              </div>
            )}

            {/* Primary CTA */}
            <Button className="mt-6 w-full" size="lg" asChild>
              <Link href={`/book/${slug}`}>
                <Calendar className="mr-2 h-5 w-5" />
                Book a meeting
              </Link>
            </Button>

            {/* Action row */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface p-2">
              <ActionButton
                href={`${API_BASE_URL}/v2/profiles/${slug}/vcard`}
                download={`${slug}.vcf`}
                icon={<Download className="h-4 w-4" />}
                label="Save contact"
              />
              <div className="h-6 w-px bg-border" />
              <ActionButton
                onClick={handleShare}
                icon={<Share2 className="h-4 w-4" />}
                label="Share"
              />
              <div className="h-6 w-px bg-border" />
              <ActionButton
                onClick={() => navigator.clipboard.writeText(publicUrl)}
                icon={<Copy className="h-4 w-4" />}
                label="Copy link"
              />
            </div>

            {/* QR code */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-surface p-5">
              <h2 className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <QrCode className="h-3.5 w-3.5" />
                Scan to connect
              </h2>
              <div className="flex justify-center rounded-xl bg-white p-3">
                <QRCode value={publicUrl} size={128} />
              </div>
              <Button variant="outline" className="mt-3 w-full" size="sm" asChild>
                <a href={`${API_BASE_URL}/v2/profiles/${slug}/vcard`} download={`${slug}.vcf`}>
                  <Download className="mr-2 h-4 w-4" />
                  Download vCard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        {profile.bio && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">About</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {/* Book a meeting */}
        {activeMeetingTypes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <Calendar className="h-4 w-4" />
                Book a meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {activeMeetingTypes.map((mt) => (
                <Link
                  key={mt.id}
                  href={`/book/${slug}?type=${mt.slug}`}
                  className="group flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-secondary/40 hover:bg-surface-elevated"
                >
                  <div className="text-left">
                    <p className="font-medium text-foreground group-hover:text-secondary">{mt.title}</p>
                    {mt.description && <p className="text-xs text-muted">{mt.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {mt.durationMinutes} min
                    </span>
                    <MeetingTypeIcon locationType={mt.locationType} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {profile.email && (
              <ContactRow href={`mailto:${profile.email}`} icon={<Mail className="h-4 w-4" />} label={profile.email} />
            )}
            {profile.phone && (
              <ContactRow href={`tel:${profile.phone}`} icon={<Phone className="h-4 w-4" />} label={profile.phone} />
            )}
            {profile.websiteUrl && (
              <ContactRow
                href={profile.websiteUrl}
                icon={<Globe className="h-4 w-4" />}
                label={profile.websiteUrl}
                external
              />
            )}
            {profile.linkedinUrl && (
              <ContactRow href={profile.linkedinUrl} icon={<LinkIcon className="h-4 w-4" />} label="LinkedIn" external />
            )}
            {profile.xUrl && (
              <ContactRow href={profile.xUrl} icon={<AtSign className="h-4 w-4" />} label="X / Twitter" external />
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="pb-6 text-center text-xs text-muted">
          Powered by <span className="font-medium text-foreground">OrbitOne</span>
        </p>
      </div>
    </div>
  );
}

function ActionButton({
  href,
  download,
  onClick,
  icon,
  label,
}: {
  href?: string;
  download?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const className = cn(
    "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
  );

  if (href) {
    return (
      <a href={href} download={download} className={className}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      {label}
    </button>
  );
}

function ContactRow({
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
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-3 rounded-lg p-2 text-sm text-foreground transition-colors hover:bg-surface"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </a>
  );
}

function MeetingTypeIcon({ locationType }: { locationType: string }) {
  const Icon =
    locationType === "video"
      ? Video
      : locationType === "phone"
      ? PhoneIcon
      : locationType === "in_person"
      ? MapPinIcon
      : User;
  return <Icon className="h-3.5 w-3.5" />;
}
