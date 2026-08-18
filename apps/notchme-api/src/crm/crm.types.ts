import { AuthContext } from "../auth/types";

export type CRMScope = {
  organizationId: string | null;
  ownerUserId: string | null;
};

export function getCRMScope(user: AuthContext): CRMScope {
  return {
    organizationId: user.organizationId,
    ownerUserId: user.organizationId ? null : user.id,
  };
}
