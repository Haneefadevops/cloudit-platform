import { User } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

export function Avatar({
  src,
  alt = "",
  fallback,
  initials,
  size = "md",
  className = "",
}: AvatarProps) {
  const fallbackText = fallback || initials;
  const letters = fallbackText
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={[
        "relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-primary text-white ring-2 ring-border",
        sizes[size],
        className,
      ].join(" ")}
      aria-label={alt || fallbackText || "Avatar"}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || fallbackText || "Avatar"}
          className="h-full w-full object-cover"
        />
      ) : letters ? (
        <span className="font-semibold">{letters}</span>
      ) : (
        <User className="h-1/2 w-1/2 opacity-80" />
      )}
    </div>
  );
}
