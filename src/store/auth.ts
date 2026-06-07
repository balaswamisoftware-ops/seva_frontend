import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/types';

interface AuthEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: Role;
  mobileNumber: string;
  email?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  employee: AuthEmployee | null;
  isAuthenticated: boolean;
  setSession: (a: { accessToken: string; refreshToken: string; employee: AuthEmployee }) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      employee: null,
      isAuthenticated: false,
      setSession: ({ accessToken, refreshToken, employee }) =>
        set({ accessToken, refreshToken, employee, isAuthenticated: true }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, employee: null, isAuthenticated: false }),
    }),
    { name: 'seva-erp-auth' },
  ),
);

export const isSuperAdmin = () => useAuthStore.getState().employee?.role === 'SUPER_ADMIN';
