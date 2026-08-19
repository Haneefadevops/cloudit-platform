import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PublicShell } from "@/components/layout/public-shell";

export default function CookiesPage() {
  return (
    <PublicShell>
      <LegalPage
        title="Cookie notice"
        summary="The storage NotchMe currently uses and why it is necessary."
      >
        <LegalSection title="Essential session cookie">
          <p>
            NotchMe uses an HTTP-only, SameSite session cookie to keep a
            signed-in user authenticated. In production it is marked Secure. It
            is required for the account workspace and is removed on logout.
          </p>
        </LegalSection>
        <LegalSection title="Local preferences">
          <p>
            The interface may store a theme preference in browser local storage.
            This preference is not used for advertising or cross-site tracking.
          </p>
        </LegalSection>
        <LegalSection title="Analytics and marketing cookies">
          <p>
            The current implementation does not set advertising cookies or
            third-party browser analytics cookies. Product events are tied to
            the authenticated profile or aggregated public actions and do not
            justify claiming consent for tooling that has not been deployed.
            This notice and any consent control must be updated before adding
            non-essential browser storage.
          </p>
        </LegalSection>
      </LegalPage>
    </PublicShell>
  );
}
