import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PublicShell } from "@/components/layout/public-shell";

export default function PrivacyPage() {
  return (
    <PublicShell>
      <LegalPage
        title="Privacy notice"
        summary="How NotchMe handles account, professional-page, relationship, booking, billing, and optional AI recap data."
      >
        <LegalSection title="Data we handle">
          <p>
            Account details include your name, email, authentication records,
            workspace role, and plan state. Professional pages may contain the
            details and links you choose to publish.
          </p>
          <p>
            Relationship workflows contain people, contact details, notes,
            activities, next actions, bookings, and meeting recaps entered by
            workspace users or voluntarily submitted through a published page.
          </p>
        </LegalSection>
        <LegalSection title="Why we use it">
          <p>
            We use this data to provide authentication, public pages, contact
            exchange, scheduling, relationship follow-up, account support,
            security, billing, and factual product analytics. We do not sell
            personal data or use relationship content for advertising.
          </p>
        </LegalSection>
        <LegalSection title="Optional AI processing">
          <p>
            AI recap assistance runs only after explicit per-upload consent. A
            private audio note and its transcript are processed to create an
            editable draft; NotchMe does not retain the source audio or
            transcript. AI cannot finalize a recap, create an action, or send a
            message.
          </p>
        </LegalSection>
        <LegalSection title="Processors and international transfers">
          <p>
            Stripe processes checkout, invoices, taxes, and payment methods when
            billing is enabled. OpenAI processes a voice note only when AI
            assistance is enabled and requested. Hosting and transactional-email
            processors will be named here before launch, together with
            applicable transfer safeguards.
          </p>
        </LegalSection>
        <LegalSection title="Retention and control">
          <p>
            You can export your authorized account data and permanently delete
            your account in Settings. AI usage metadata contains operational
            counts—not recap content. Billing lifecycle records may be retained
            where tax or accounting law requires it. Final retention periods
            require legal approval before launch.
          </p>
        </LegalSection>
        <LegalSection title="Your rights">
          <p>
            Depending on applicable law, you may request access, correction,
            deletion, restriction, portability, or objection, and may complain
            to a competent data-protection authority. An official privacy
            contact and controller identity will be published before launch.
          </p>
        </LegalSection>
      </LegalPage>
    </PublicShell>
  );
}
