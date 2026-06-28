"use client";

import { useEffect } from "react";

const DEFAULT_ORG_ID = "seed-organization-001";

export function useInitOrganization() {
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("organizationId")) {
      localStorage.setItem("organizationId", DEFAULT_ORG_ID);
    }
  }, []);
}
