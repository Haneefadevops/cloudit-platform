"use client";

import * as React from "react";
import { useWhiteLabel } from "@/hooks/useOrganizationConfig";

export function WhiteLabelInjector() {
  const { data: config } = useWhiteLabel();

  React.useEffect(() => {
    if (!config) return;
    const root = document.documentElement;

    if (config.primaryColor) {
      root.style.setProperty("--primary", config.primaryColor);
    }

    if (config.logoUrl) {
      // Expose the logo URL as a CSS variable so layouts can reference it.
      root.style.setProperty("--organization-logo-url", `url(${config.logoUrl})`);
    }
  }, [config]);

  return null;
}
