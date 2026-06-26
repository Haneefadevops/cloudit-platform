"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, Organization } from "@/types";
import { me, logout, switchOrganization, getStoredUser, getStoredOrganization, getStoredOrganizations } from "@/lib/auth";

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
        setOrganization(data.organization);
        setOrganizations(data.organizations);
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

  const handleSwitchOrg = useCallback(async (orgId: string) => {
    const data = await switchOrganization(orgId);
    setUser(data.user);
    setOrganization(data.organization);
    window.location.reload();
  }, []);

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
