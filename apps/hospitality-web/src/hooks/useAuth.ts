import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("organizationId");
      window.location.href = "/login";
    }
  }, []);

  return {
    isLoading,
    isAuthenticated,
    logout,
  };
}
