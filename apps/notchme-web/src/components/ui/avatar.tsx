import Image from "next/image";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeToPx = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function Avatar({
  className,
  src,
  alt,
  fallback,
  size = "md",
  ...props
}: AvatarProps) {
  const initials = fallback
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full bg-surface text-foreground ring-1 ring-border",
        {
          "h-8 w-8 text-xs": size === "sm",
          "h-10 w-10 text-sm": size === "md",
          "h-14 w-14 text-base": size === "lg",
          "h-20 w-20 text-xl": size === "xl",
        },
        className,
      )}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? fallback ?? "Avatar"}
          width={sizeToPx[size]}
          height={sizeToPx[size]}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span className="font-medium">{initials}</span>
      )}
    </div>
  );
}
