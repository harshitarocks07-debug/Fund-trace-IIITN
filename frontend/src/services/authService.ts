import { api, ApiError } from "./api";
import type { AuthResponse, AuthUser, PermissionCheckResponse, Role, RoleCapabilities } from "../types";

const TOKEN_KEY = "fundtrace_auth_token";
const USER_KEY = "fundtrace_auth_user";

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  organization?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface DemoUserOption {
  role: Role;
  name: string;
  email: string;
  password: string;
  organization?: string;
  badge: string;
  description: string;
}

export const DEMO_USERS: DemoUserOption[] = [
  {
    role: "Donor",
    name: "Aarav Mehta",
    email: "donor@aarav.org",
    password: "Password123!",
    badge: "Verified Donor",
    description: "Can track projects, donate to causes, and monitor transparency logs.",
  },
  {
    role: "NGO admin",
    name: "Helping Hands Admin",
    email: "admin@helpinghands.org",
    password: "Password123!",
    organization: "Helping Hands Foundation",
    badge: "NGO Lead",
    description: "Can create projects, submit expense claims, and upload receipt fingerprints.",
  },
  {
    role: "Auditor",
    name: "Priya Nair",
    email: "auditor@trustcheck.org",
    password: "Password123!",
    organization: "TrustCheck Independent Auditors",
    badge: "Independent Auditor",
    description: "Can review expenses, verify SHA-256 hashes, approve/reject claims, and audit history.",
  },
];

export function getRoleCapabilities(role: Role): RoleCapabilities {
  switch (role) {
    case "NGO admin":
      return {
        can_create_project: true,
        can_submit_expense: true,
        can_review_expense: false,
        can_donate: false,
        can_verify_receipts: true,
        can_view_audit_log: true,
      };
    case "Auditor":
      return {
        can_create_project: false,
        can_submit_expense: false,
        can_review_expense: true,
        can_donate: false,
        can_verify_receipts: true,
        can_view_audit_log: true,
      };
    case "Donor":
    default:
      return {
        can_create_project: false,
        can_submit_expense: false,
        can_review_expense: false,
        can_donate: true,
        can_verify_receipts: false,
        can_view_audit_log: false,
      };
  }
}

export const authService = {
  getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrentUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  setSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async login(payload: LoginPayload): Promise<AuthUser> {
    try {
      const response = await api.post<AuthResponse>("/auth/login", payload);
      this.setSession(response.access_token, response.user);
      return response.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // Backend offline fallback: check demo credentials
        const demo = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === payload.email.toLowerCase().trim() && u.password === payload.password
        );
        if (demo) {
          const fallbackUser: AuthUser = {
            id: `offline-${demo.role.toLowerCase()}`,
            email: demo.email,
            full_name: demo.name,
            role: demo.role,
            organization: demo.organization,
            is_active: true,
            token: "offline-demo-jwt-token",
          };
          this.setSession("offline-demo-jwt-token", fallbackUser);
          return fallbackUser;
        }
        throw new Error("Invalid email or password (or backend server unreachable).");
      }
      throw err;
    }
  },

  async register(payload: RegisterPayload): Promise<AuthUser> {
    try {
      const response = await api.post<AuthResponse>("/auth/register", payload);
      this.setSession(response.access_token, response.user);
      return response.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // Backend offline fallback
        const fallbackUser: AuthUser = {
          id: `offline-${Date.now()}`,
          email: payload.email,
          full_name: payload.full_name,
          role: payload.role,
          organization: payload.organization,
          is_active: true,
          token: "offline-demo-jwt-token",
        };
        this.setSession("offline-demo-jwt-token", fallbackUser);
        return fallbackUser;
      }
      throw err;
    }
  },

  async fetchMe(): Promise<AuthUser | null> {
    const token = this.getStoredToken();
    if (!token) return null;
    try {
      const user = await api.get<AuthUser>("/auth/me");
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch {
      return this.getCurrentUser();
    }
  },

  async fetchPermissions(): Promise<PermissionCheckResponse | null> {
    try {
      return await api.get<PermissionCheckResponse>("/auth/permissions");
    } catch {
      const current = this.getCurrentUser();
      if (!current) return null;
      return {
        role: current.role,
        permissions: [],
        capabilities: getRoleCapabilities(current.role),
      };
    }
  },

  getDemoUsers(): DemoUserOption[] {
    return DEMO_USERS;
  },
};

