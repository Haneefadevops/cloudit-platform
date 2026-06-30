"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const toast = useToast();
  const initialMode =
    searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const auth = useAuth();

  const isRegister = mode === "register";

  function switchMode(next: "login" | "register") {
    setMode(next);
    setFormError(null);
    router.replace(`/login?mode=${next}`, { scroll: false });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);

    try {
      if (mode === "register") {
        await auth.register(fullName, email, password);
        toast.show("Account created. Welcome to OrbitOne!", "success");
      } else {
        await auth.login(email, password);
        toast.show("Welcome back!", "success");
      }
      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      setFormError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-semibold text-foreground">
        {isRegister ? t("createAccount") : t("welcomeBack")}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {isRegister ? t("registerSubtitle") : t("signInSubtitle")}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {isRegister && (
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete={isRegister ? "email" : "username"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {formError && (
          <div className="flex items-start gap-2 rounded-lg bg-error/10 p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full"
          size="lg"
        >
          {isRegister ? t("createAccountBtn") : t("signIn")}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted">
          {isRegister ? t("alreadyHaveAccount") : t("noAccount")}
        </span>{" "}
        <button
          type="button"
          onClick={() => switchMode(isRegister ? "login" : "register")}
          className="font-medium text-secondary hover:underline"
        >
          {isRegister ? t("signIn") : t("getStartedFree")}
        </button>
      </div>
    </div>
  );
}
