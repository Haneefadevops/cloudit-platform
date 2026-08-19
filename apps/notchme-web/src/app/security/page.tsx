import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PublicShell } from "@/components/layout/public-shell";

export default function SecurityPage() {
  return (
    <PublicShell>
      <LegalPage
        title="Security and trust"
        summary="Current safeguards, honest boundaries, and the checks still required before launch."
      >
        <LegalSection title="Current controls">
          <p>
            NotchMe uses hashed passwords, HTTP-only sessions, server-derived
            organization scope, authorization checks, input validation, rate
            limits, security headers, bounded uploads, transactional database
            changes, and redaction of sensitive guest-management paths.
          </p>
          <p>
            Payment details stay in Lemon Squeezy-hosted surfaces. AI credentials
            stay on the API server; voice-note audio and transcripts are not
            retained by NotchMe. Account exports exclude credentials, tokens,
            secrets, and card data.
          </p>
        </LegalSection>
        <LegalSection title="Production requirements">
          <p>
            Production must use HTTPS, strong rotated secrets, encrypted
            calendar tokens, restricted database and Redis access, monitored
            backups, verified email delivery, Lemon Squeezy webhook verification,
            dependency and container scanning, alerting, and tested restoration
            and incident procedures.
          </p>
        </LegalSection>
        <LegalSection title="Reporting a concern">
          <p>
            A monitored security contact and vulnerability-reporting process
            will be published before launch. Do not include passwords, access
            tokens, private relationship content, or payment details in a
            report.
          </p>
        </LegalSection>
      </LegalPage>
    </PublicShell>
  );
}
