import type { PublicProfile } from "../common/contracts/orbitone.v2";

export function generateVCard(profile: PublicProfile) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.fullName}`,
    profile.company ? `ORG:${profile.company}` : null,
    profile.headline ? `TITLE:${profile.headline}` : null,
    profile.email ? `EMAIL;TYPE=INTERNET:${profile.email}` : null,
    profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : null,
    profile.websiteUrl ? `URL:${profile.websiteUrl}` : null,
    profile.linkedinUrl
      ? `X-SOCIALPROFILE;TYPE=linkedin:${profile.linkedinUrl}`
      : null,
    profile.xUrl ? `X-SOCIALPROFILE;TYPE=x:${profile.xUrl}` : null,
    "END:VCARD",
  ];

  return lines.filter(Boolean).join("\r\n");
}
