import { Clock3, Database, LockKeyhole, ShieldCheck } from "lucide-react";

const content: Record<string, { title: string; description: string }> = {
  overview: { title: "Operations overview", description: "All clients · live service and evidence health" },
  clients: { title: "Clients", description: "Tenants, environments and publishing status" },
  workflows: { title: "Workflow health", description: "Curated automation status · never an editable n8n canvas" },
  infrastructure: { title: "Infrastructure", description: "Website, PostgreSQL and connection evidence" },
  vercel: { title: "Vercel analytics", description: "Supported API evidence only" },
  imagekit: { title: "ImageKit analytics", description: "Usage, quota and delivery health" },
  backups: { title: "Backup centre", description: "Encrypted archive and isolated restore evidence" },
  reports: { title: "Reports", description: "Private monthly maintenance reports" },
  incidents: { title: "Incidents", description: "Active and resolved operational findings" },
  "audit-log": { title: "Audit log", description: "Append-only administrative and report history" },
  settings: { title: "Settings", description: "Owner-only controls and policy visibility" },
};

export function FoundationPage({ section, detail }: { section: string; detail?: string[] }) {
  const page = content[section] ?? { title: "Not found", description: "This protected portal route does not exist." };
  return <div className="page-wrap">
    <header className="page-header"><div><p className="eyebrow">PHASE 2 · PROTECTED FOUNDATION</p><h1>{detail?.length ? `${page.title} detail` : page.title}</h1><p>{page.description}</p></div><span className="status-pill"><span />NO DATA</span></header>
    <section className="foundation-card" aria-labelledby="foundation-title">
      <div className="foundation-icon"><ShieldCheck aria-hidden="true" /></div>
      <div><h2 id="foundation-title">Secure foundation is ready</h2><p>Operational evidence is intentionally not connected during Phase 2. This protected route proves the approved responsive shell without displaying mock production data.</p></div>
    </section>
    <div className="foundation-grid">
      <article><LockKeyhole aria-hidden="true" /><h2>Protected route</h2><p>Every request requires a valid, signed, unexpired owner session.</p></article>
      <article><Database aria-hidden="true" /><h2>Database isolated</h2><p>The future <code>operations</code> database and role are deferred to Phase 3.</p></article>
      <article><Clock3 aria-hidden="true" /><h2>Evidence unavailable</h2><p>NO DATA is explicit and cannot be mistaken for healthy source evidence.</p></article>
    </div>
  </div>;
}
