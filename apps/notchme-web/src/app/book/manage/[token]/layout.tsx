import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage booking",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function GuestManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
