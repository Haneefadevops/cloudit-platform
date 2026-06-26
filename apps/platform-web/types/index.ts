export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'admin' | 'user' | 'owner';
  status: 'active' | 'inactive' | 'pending';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  orgName: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface DashboardStats {
  usersCount: number;
  orgsCount: number;
  activeUsers: number;
  pendingInvites: number;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  resource: string;
  details: string;
  timestamp: string;
}
