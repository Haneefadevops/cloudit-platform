"use client";

import { useIsFeatureEnabled } from "@/hooks/useOrganizationConfig";

interface FeatureFlagGuardProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlagGuard({ featureKey, children, fallback = null }: FeatureFlagGuardProps) {
  const enabled = useIsFeatureEnabled(featureKey);
  return enabled ? <>{children}</> : <>{fallback}</>;
}
