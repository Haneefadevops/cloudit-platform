"use client";

import { useState, useEffect } from "react";
import { Input, Button } from "@cloudit/ui";

export function OrganizationSelector() {
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("organizationId") || "";
    setOrgId(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem("organizationId", orgId);
    window.location.reload();
  };

  return (
    <div className="space-y-2 p-2">
      <label className="text-xs font-medium text-muted-foreground">
        Organization ID
      </label>
      <Input
        value={orgId}
        onChange={(e) => setOrgId(e.target.value)}
        placeholder="Org ID"
        className="h-8 text-xs"
      />
      <Button size="sm" className="w-full" onClick={handleSave}>
        Set Org
      </Button>
    </div>
  );
}
