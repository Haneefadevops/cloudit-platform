import { CloudItLogo } from "../../../components/logo";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  invalid: "The email, password, or authentication code was not accepted.",
  throttled: "Too many sign-in attempts. Please wait a few minutes before trying again.",
  configuration: "Secure sign-in is temporarily unavailable.",
};

export default function LoginPage({ searchParams }: { searchParams: { error?: string; status?: string; returnTo?: string } }) {
  const mfaRequired = process.env.OPERATIONS_MFA_REQUIRED !== "false";
  const message = searchParams.error ? messages[searchParams.error] : null;
  return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <CloudItLogo />
      <div className="login-heading"><p>PRIVATE OPERATIONS PORTAL</p><h1 id="login-title">Sign in securely</h1><span>Authorized CloudIT maintainers only.</span></div>
      {message ? <div className="auth-message error" role="alert">{message}</div> : null}
      {searchParams.status === "signed-out" ? <div className="auth-message success" role="status">You have been signed out.</div> : null}
      <form action="/api/session" method="post">
        <input type="hidden" name="returnTo" value={searchParams.returnTo ?? "/overview"} />
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {mfaRequired ? <label>Authentication code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} required /></label> : null}
        <button type="submit">Sign in securely</button>
      </form>
      <div className="security-note"><ShieldIcon /><span><strong>Protected session</strong><small>HTTP-only cookie · strict same-site policy · automatic expiry</small></span></div>
    </section>
  </main>;
}

function ShieldIcon() { return <span className="shield-icon" aria-hidden="true">S</span>; }
