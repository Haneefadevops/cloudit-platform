export type AuthOrganization = {
  id: string;
  slug: string;
  name: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthContext = SessionUser & {
  role: string;
  organizationId: string;
  organization: AuthOrganization | null;
};

export type JwtPayload = {
  sub: string;
  email: string;
  sid: string;
};
