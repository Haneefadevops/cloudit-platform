"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, Archive, BarChart3, Building2, CircleGauge, FileClock, Image, ListTree, Menu, ScrollText, Settings, TriangleAlert } from "lucide-react";
import { CloudItLogo } from "./logo";

const navigation = [
  ["/overview", "Overview", CircleGauge], ["/clients", "Clients", Building2], ["/workflows", "Workflows", ListTree],
  ["/infrastructure", "Infrastructure", Activity], ["/vercel", "Vercel", BarChart3], ["/imagekit", "ImageKit", Image],
  ["/backups", "Backups", Archive], ["/reports", "Reports", ScrollText], ["/incidents", "Incidents", TriangleAlert],
  ["/audit-log", "Audit log", FileClock], ["/settings", "Settings", Settings],
] as const;

const primaryMobile = navigation.slice(0, 3);
const secondaryMobile = navigation.slice(3);

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return <div className="shell">
    <aside className="sidebar">
      <CloudItLogo />
      <nav aria-label="Primary navigation">{navigation.map(([href, label, Icon]) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon aria-hidden="true" />{label}</Link>)}</nav>
      <div className="owner-card"><span className="healthy-dot" /><div><strong>{email}</strong><small>Cloud owner</small></div><form action="/api/logout" method="post"><button type="submit">Sign out</button></form></div>
    </aside>
    <main id="main-content">{children}</main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {primaryMobile.map(([href, label, Icon]) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
      <details><summary><Menu aria-hidden="true" /><span>More</span></summary><div className="more-menu">{secondaryMobile.map(([href,label,Icon])=><Link key={href} href={href}><Icon aria-hidden="true" />{label}</Link>)}</div></details>
    </nav>
  </div>;
}
