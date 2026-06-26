"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, Organization } from "@/types";
import { me, logout, getStoredUser, getStoredOrganization, getStoredOrganizations } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedOrg = getStoredOrganization();
    const storedOrgs = getStoredOrganizations();
    setUser(storedUser);
    setOrganization(storedOrg);
    setOrganizations(storedOrgs);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await me();
      if (data) {
        setUser(data.user);
        setOrganizations(data.organizations);
        const currentOrg = data.organizations[0] || null;
        setOrganization(currentOrg);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setOrganization(null);
    setOrganizations([]);
    window.location.href = "/login";
  }, []);

  const handleSwitchOrg = useCallback((orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org && typeof window !== "undefined") {
      localStorage.setItem("organization", JSON.stringify(org));
      setOrganization(org);
      window.location.reload();
    }
  }, [organizations]);

  return {
    user,
    organization,
    organizations,
    isLoading,
    isAuthenticated: !!user,
    refresh,
    logout: handleLogout,
    switchOrg: handleSwitchOrg,
  };
}
