import { useContext } from "react";
import { ThemeContext } from "@/providers/theme-context";
import type { Theme, ThemeContextValue } from "@/providers/theme-context";

export type { Theme, ThemeContextValue };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
