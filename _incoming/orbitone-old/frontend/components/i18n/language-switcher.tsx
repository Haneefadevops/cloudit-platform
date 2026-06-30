"use client";

import { useI18n, type Locale } from "./i18n-provider";

const options: { value: Locale; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "si", label: "Sinhala", native: "සිංහල" },
  { value: "ta", label: "Tamil", native: "தமிழ்" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setLocale(option.value)}
          className={[
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            locale === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          ].join(" ")}
          aria-pressed={locale === option.value}
          title={option.label}
        >
          {compact ? option.native : option.label}
        </button>
      ))}
    </div>
  );
}
