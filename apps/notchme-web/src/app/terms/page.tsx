import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PublicShell } from "@/components/layout/public-shell";

export default function TermsPage() {
  return (
    <PublicShell>
      <LegalPage
        title="Terms of service"
        summary="The proposed terms for using the NotchMe professional relationship workspace."
      >
        <LegalSection title="Service and accounts">
          <p>
            NotchMe provides professional pages, contact exchange, booking,
            people records, next actions, insights, and optional AI-assisted
            recap drafts. You are responsible for accurate account information,
            safeguarding access, and using the service lawfully.
          </p>
        </LegalSection>
        <LegalSection title="People and relationship data">
          <p>
            You must have an appropriate lawful basis for personal data you add,
            import, or share. Do not upload special-category, highly sensitive,
            unlawful, or irrelevant data. Public-page visitors must provide only
            information they are entitled to share.
          </p>
        </LegalSection>
        <LegalSection title="AI assistance">
          <p>
            AI output may be incomplete or wrong. You must review every
            suggestion. NotchMe does not autonomously finalize recaps, create
            follow-ups, or send communications.
          </p>
        </LegalSection>
        <LegalSection title="Plans, trials, and cancellation">
          <p>
            Free, Founding Pro, and Teams features and limits are shown before
            checkout. Applicable VAT is calculated during hosted checkout.
            Eligible first-time billing scopes may receive a 14-day trial. Paid
            subscriptions renew for the selected period until cancelled through
            the billing portal, subject to the final cancellation and refund
            policy.
          </p>
        </LegalSection>
        <LegalSection title="Availability and acceptable use">
          <p>
            Do not probe, disrupt, reverse engineer, misuse access controls,
            send unsolicited bulk communications, or use NotchMe to harm others.
            Service levels, liability limits, governing law, dispute terms, and
            consumer withdrawal wording require legal approval before these
            terms become active.
          </p>
        </LegalSection>
      </LegalPage>
    </PublicShell>
  );
}
