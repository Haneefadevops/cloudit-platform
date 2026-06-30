import { HTMLAttributes } from "react";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={["animate-pulse rounded-xl bg-muted/20", className].join(" ")}
      {...props}
    />
  );
}
