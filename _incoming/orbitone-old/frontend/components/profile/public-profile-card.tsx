"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicProfile } from "@/lib/contracts";
import {
  MapPin,
  Building2,
  Mail,
  Phone,
  Globe,
  ExternalLink,
} from "lucide-react";

interface PublicProfileCardProps {
  profile: PublicProfile;
  variant?: "default" | "compact";
}

export function PublicProfileCard({
  profile,
  variant = "default",
}: PublicProfileCardProps) {
  if (variant === "compact") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-background p-1 shadow-card">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.fullName}
                width={80}
                height={80}
                className="h-16 w-16 rounded-full object-cover ring-4 ring-surface sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-2xl font-bold text-white ring-4 ring-surface sm:h-20 sm:w-20">
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">
              {profile.fullName}
            </h1>
            {profile.headline && (
              <p className="truncate text-sm font-medium text-secondary sm:text-base">
                {profile.headline}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              {profile.company && (
                <Pill>
                  <Building2 className="h-3.5 w-3.5" />
                  {profile.company}
                </Pill>
              )}
              {profile.location && (
                <Pill>
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </Pill>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
      <div className="gradient-sunset h-24 w-full sm:h-28" />
      <div className="relative -mt-12 flex flex-col items-center px-5 pb-6 text-center sm:-mt-14 sm:px-8 sm:pb-8">
        <div className="rounded-full bg-background p-1.5 shadow-card">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.fullName}
              width={112}
              height={112}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-surface sm:h-28 sm:w-28"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-4xl font-bold text-white ring-4 ring-surface sm:h-28 sm:w-28">
              {profile.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {profile.fullName}
        </h1>

        {profile.headline && (
          <p className="mt-1 text-base font-medium text-secondary sm:text-lg">
            {profile.headline}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          {profile.company && (
            <Pill>
              <Building2 className="h-3.5 w-3.5" />
              {profile.company}
            </Pill>
          )}
          {profile.location && (
            <Pill>
              <MapPin className="h-3.5 w-3.5" />
              {profile.location}
            </Pill>
          )}
        </div>

        {profile.bio && (
          <p className="mt-5 max-w-md leading-relaxed text-foreground">
            {profile.bio}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {profile.email && (
            <IconLink
              href={`mailto:${profile.email}`}
              icon={<Mail className="h-4 w-4" />}
              label="Email"
            />
          )}
          {profile.phone && (
            <IconLink
              href={`tel:${profile.phone}`}
              icon={<Phone className="h-4 w-4" />}
              label="Call"
            />
          )}
          {profile.websiteUrl && (
            <IconLink
              href={profile.websiteUrl}
              icon={<Globe className="h-4 w-4" />}
              label="Website"
              external
            />
          )}
          {profile.linkedinUrl && (
            <IconLink
              href={profile.linkedinUrl}
              icon={<ExternalLink className="h-4 w-4" />}
              label="LinkedIn"
              external
            />
          )}
          {profile.xUrl && (
            <IconLink
              href={profile.xUrl}
              icon={<ExternalLink className="h-4 w-4" />}
              label="X"
              external
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-muted">
      {children}
    </span>
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
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary hover:text-secondary hover:shadow-card"
    >
      {icon}
      {label}
    </Link>
  );
}
