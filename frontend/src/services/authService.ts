import { request } from './api';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      localStorage.setItem('fundtrace_token', data.access_token);
    }
    return data;
  },

  async register(user: { email: string; password: string; full_name?: string; role?: string }): Promise<User> {
    return await request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      return await request<User>('/auth/me');
    } catch {
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem('fundtrace_token');
  },
};

