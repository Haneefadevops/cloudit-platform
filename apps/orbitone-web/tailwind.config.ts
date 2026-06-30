import type { Config } from "tailwindcss";
import uiConfig from "@cloudit/ui/tailwind.config";

const config: Config = {
  darkMode: uiConfig.darkMode,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ...uiConfig.theme?.extend,
      colors: {
        ...uiConfig.theme?.extend?.colors,
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          2: "var(--accent-2)",
        },
        muted: {
          DEFAULT: "var(--muted)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
          subtle: "var(--success-subtle)",
        },
        error: {
          DEFAULT: "var(--error)",
          foreground: "var(--error-foreground)",
          subtle: "var(--error-subtle)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
          subtle: "var(--warning-subtle)",
        },
        info: {
          DEFAULT: "var(--info)",
          foreground: "var(--info-foreground)",
          subtle: "var(--info-subtle)",
        },
        ring: "var(--ring)",
        "ring-offset": "var(--ring-offset)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans Sinhala",
          "Noto Sans Tamil",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        dropdown: "var(--shadow-dropdown)",
        dialog: "var(--shadow-dialog)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
      keyframes: {
        "sun-rise": {
          "0%": { transform: "translateY(12px)", opacity: "0.6" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "sun-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.05)", opacity: "0.95" },
        },
        "sun-set": {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(8px)", opacity: "0.85" },
        },
        "moon-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "sun-rise": "sun-rise 1.2s ease-out forwards",
        "sun-pulse": "sun-pulse 3s ease-in-out infinite",
        "sun-set": "sun-set 1.2s ease-out forwards",
        "moon-float": "moon-float 3s ease-in-out infinite",
        twinkle: "twinkle 2s ease-in-out infinite",
        "twinkle-delayed": "twinkle 2s ease-in-out 0.5s infinite",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
      },
    },
  },
  plugins: uiConfig.plugins,
};

export default config;
