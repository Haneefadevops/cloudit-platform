import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TransactionalEmailService {
  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(
      this.config.get<string>("RESEND_API_KEY")?.trim() &&
      this.config.get<string>("NOTCHME_EMAIL_FROM")?.trim() &&
      this.webUrl(),
    );
  }

  verificationRequired(): boolean {
    return (
      this.config.get<string>("NOTCHME_REQUIRE_EMAIL_VERIFICATION") === "true"
    );
  }

  async sendVerification(email: string, name: string, token: string) {
    await this.send({
      to: email,
      subject: "Verify your NotchMe email",
      text: `Hello ${name},\n\nVerify your NotchMe email:\n${this.webUrl()}/verify-email?token=${encodeURIComponent(token)}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this message.`,
    });
  }

  async sendPasswordReset(email: string, name: string, token: string) {
    await this.send({
      to: email,
      subject: "Reset your NotchMe password",
      text: `Hello ${name},\n\nReset your NotchMe password:\n${this.webUrl()}/reset-password?token=${encodeURIComponent(token)}\n\nThis link expires in one hour. If you did not request it, you can ignore this message.`,
    });
  }

  private webUrl(): string | null {
    const value = this.config.get<string>("NOTCHME_WEB_URL")?.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
        return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  private async send(input: { to: string; subject: string; text: string }) {
    const key = this.config.get<string>("RESEND_API_KEY")?.trim();
    const from = this.config.get<string>("NOTCHME_EMAIL_FROM")?.trim();
    if (!key || !from || !this.webUrl()) {
      throw new ServiceUnavailableException(
        "Transactional email is not configured.",
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, ...input }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("provider rejected request");
    } catch {
      throw new ServiceUnavailableException(
        "Transactional email is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
