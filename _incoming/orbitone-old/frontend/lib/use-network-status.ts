/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import type { Connection, NetworkProfile, NetworkConnectionStatus } from "./contracts";

export function useNetworkStatus(profileId: string | null) {
  const [status, setStatus] = useState<NetworkConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(!!profileId);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    async function load() {
      const [connectionsResult, inboundResult, mutualResult] = await Promise.all([
        apiFetch<Connection[]>("/connections"),
        apiFetch<NetworkProfile[]>("/network/inbound"),
        apiFetch<NetworkProfile[]>("/network/mutual"),
      ]);

      const savedByMe = connectionsResult.ok
        ? connectionsResult.data.some((c) => c.connectedProfileId === profileId)
        : false;

      const savedMe = inboundResult.ok
        ? inboundResult.data.some((n) => n.profile.id === profileId)
        : false;

      const mutual = mutualResult.ok
        ? mutualResult.data.some((n) => n.profile.id === profileId)
        : false;

      if (mutual || (savedByMe && savedMe)) {
        setStatus("mutual");
      } else if (savedByMe) {
        setStatus("saved");
      } else if (savedMe) {
        setStatus("saved_me");
      } else {
        setStatus("none");
      }

      setIsLoading(false);
    }

    load();
  }, [profileId]);

  return { status, isLoading };
}
