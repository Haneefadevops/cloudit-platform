import { User } from "../common/contracts/orbitone.v2";

export type AuthOrganization = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  planStatus: string;
  trialEndsAt: Date | null;
};

export type AuthContext = User & {
  organization: AuthOrganization | null;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
  sid: string;
};
