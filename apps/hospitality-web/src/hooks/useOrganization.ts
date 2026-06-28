"use client";

import { useState, useEffect } from "react";

export function useOrganization() {
  const [organizationId, setOrganizationId] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("organizationId");
    if (stored) {
      setOrganizationId(stored);
    }
  }, []);

  const setOrg = (id: string) => {
    localStorage.setItem("organizationId", id);
    setOrganizationId(id);
  };

  return { organizationId, setOrganizationId: setOrg };
}
