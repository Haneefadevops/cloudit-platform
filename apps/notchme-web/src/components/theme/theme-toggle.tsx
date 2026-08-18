import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

const themes = ["system", "light", "dark"] as const;

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const Icon = resolvedTheme === "dark" ? Moon : Sun;
  const label = theme === "system" ? `System (${resolvedTheme})` : theme;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      aria-label={`Current theme: ${label}. Click to cycle.`}
      title={`Theme: ${label}`}
      className="h-9 w-9 px-0"
    >
      {theme === "system" ? (
        <Monitor className="h-4 w-4" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </Button>
  );
}
